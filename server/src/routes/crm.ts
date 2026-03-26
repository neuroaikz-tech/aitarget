import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const router = Router();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getFbToken(userId: string): string | null {
    const db = getDb();
    const account = db.prepare(
        'SELECT access_token, system_user_token FROM facebook_accounts WHERE user_id = ? LIMIT 1'
    ).get(userId) as any;
    return account?.system_user_token || account?.access_token || null;
}

// ─────────────────────────────────────────────────────────────
// GET /api/crm/leads — список лидов
// ─────────────────────────────────────────────────────────────
router.get('/leads', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const { status, search, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM leads WHERE user_id = ?';
    const params: any[] = [req.user.id];

    if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
    }
    if (search) {
        query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const leads = db.prepare(query).all(...params);
    const total = (db.prepare(
        'SELECT COUNT(*) as cnt FROM leads WHERE user_id = ?' +
        (status && status !== 'all' ? ' AND status = ?' : '')
    ).get(...(status && status !== 'all' ? [req.user.id, status] : [req.user.id])) as any).cnt;

    res.json({ leads, total });
});

// ─────────────────────────────────────────────────────────────
// POST /api/crm/leads — создать лид вручную
// ─────────────────────────────────────────────────────────────
router.post('/leads', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const { name, phone, email, notes, fb_campaign_name, fb_campaign_id, deal_value } = req.body;

    if (!name && !phone && !email) {
        return res.status(400).json({ error: 'Укажите хотя бы имя, телефон или email' });
    }

    const lead = {
        id: uuidv4(),
        user_id: req.user.id,
        name: name || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        fb_campaign_name: fb_campaign_name || null,
        fb_campaign_id: fb_campaign_id || null,
        status: 'new',
        deal_value: deal_value || null,
    };

    db.prepare(`
        INSERT INTO leads (id, user_id, name, phone, email, notes, fb_campaign_name, fb_campaign_id, status, deal_value)
        VALUES (@id, @user_id, @name, @phone, @email, @notes, @fb_campaign_name, @fb_campaign_id, @status, @deal_value)
    `).run(lead);

    res.json({ lead });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/crm/leads/:id — обновить статус / данные лида
// ─────────────────────────────────────────────────────────────
router.patch('/leads/:id', authenticate, async (req: AuthRequest, res: Response) => {
    const db = getDb();
    const { id } = req.params;
    const { status, notes, deal_value, name, phone, email } = req.body;

    const lead = db.prepare('SELECT * FROM leads WHERE id = ? AND user_id = ?').get(id, req.user.id) as any;
    if (!lead) return res.status(404).json({ error: 'Лид не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (deal_value !== undefined) { updates.push('deal_value = ?'); params.push(deal_value); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.user.id);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

    // Если статус изменился на "bought" — отправить Purchase событие в Facebook CAPI
    if (status === 'bought' && lead.status !== 'bought') {
        const token = getFbToken(req.user.id);
        if (token) {
            sendCapiPurchaseEvent(req.user.id, lead, deal_value ?? lead.deal_value, token, db).catch(e => {
                console.error('[CAPI] Failed to send Purchase event:', e?.response?.data || e.message);
            });
        }
    }

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    res.json({ lead: updated });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/crm/leads/:id
// ─────────────────────────────────────────────────────────────
router.delete('/leads/:id', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Лид не найден' });
    res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// POST /api/crm/sync — синхронизировать лиды из Facebook Lead Ads
// ─────────────────────────────────────────────────────────────
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
    const token = getFbToken(req.user.id);
    if (!token) return res.status(403).json({ error: 'Facebook аккаунт не подключён' });

    const db = getDb();
    let synced = 0;
    let errors: string[] = [];

    try {
        // Получаем страницы
        const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: { fields: 'id,name,access_token', limit: 25, access_token: token }
        });
        const pages = pagesRes.data?.data || [];

        for (const page of pages) {
            const pageToken = page.access_token || token;
            try {
                // Получаем лид-формы страницы
                const formsRes = await axios.get(`https://graph.facebook.com/v21.0/${page.id}/leadgen_forms`, {
                    params: { fields: 'id,name', limit: 25, access_token: pageToken }
                });
                const forms = formsRes.data?.data || [];

                for (const form of forms) {
                    try {
                        // Получаем лиды формы
                        const leadsRes = await axios.get(`https://graph.facebook.com/v21.0/${form.id}/leads`, {
                            params: {
                                fields: 'id,created_time,field_data,campaign_id,campaign_name,adset_id,ad_id',
                                limit: 100,
                                access_token: pageToken
                            }
                        });
                        const fbLeads = leadsRes.data?.data || [];

                        for (const fbLead of fbLeads) {
                            // Проверяем — уже есть в БД?
                            const exists = db.prepare('SELECT id FROM leads WHERE fb_lead_id = ?').get(fbLead.id);
                            if (exists) continue;

                            // Парсим поля лида
                            const fields: Record<string, string> = {};
                            for (const f of (fbLead.field_data || [])) {
                                fields[f.name?.toLowerCase()] = f.values?.[0] || '';
                            }

                            const name = fields['full_name'] || fields['name'] || fields['имя'] || null;
                            const phone = fields['phone_number'] || fields['phone'] || fields['телефон'] || null;
                            const email = fields['email'] || fields['почта'] || null;

                            db.prepare(`
                                INSERT INTO leads (
                                    id, user_id, fb_lead_id, fb_form_id,
                                    fb_campaign_id, fb_campaign_name, fb_adset_id, fb_ad_id,
                                    name, phone, email, status, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
                            `).run(
                                uuidv4(), req.user.id, fbLead.id, form.id,
                                fbLead.campaign_id || null, fbLead.campaign_name || null,
                                fbLead.adset_id || null, fbLead.ad_id || null,
                                name, phone, email,
                                fbLead.created_time || new Date().toISOString()
                            );
                            synced++;
                        }
                    } catch (e: any) {
                        errors.push(`Form ${form.id}: ${e?.response?.data?.error?.message || e.message}`);
                    }
                }
            } catch (e: any) {
                errors.push(`Page ${page.id}: ${e?.response?.data?.error?.message || e.message}`);
            }
        }
    } catch (e: any) {
        return res.status(500).json({ error: e?.response?.data?.error?.message || e.message });
    }

    res.json({ synced, errors: errors.length > 0 ? errors : undefined });
});

// ─────────────────────────────────────────────────────────────
// GET /api/crm/stats — статистика по лидам
// ─────────────────────────────────────────────────────────────
router.get('/stats', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const userId = req.user.id;

    const stats = db.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
            SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
            SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified_count,
            SUM(CASE WHEN status = 'bought' THEN 1 ELSE 0 END) as bought_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
            SUM(CASE WHEN status = 'bought' THEN COALESCE(deal_value, 0) ELSE 0 END) as total_revenue,
            COUNT(DISTINCT fb_campaign_id) as campaigns_count
        FROM leads WHERE user_id = ?
    `).get(userId);

    // Конверсия по кампаниям
    const byCampaign = db.prepare(`
        SELECT
            fb_campaign_name,
            fb_campaign_id,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'bought' THEN 1 ELSE 0 END) as bought,
            SUM(CASE WHEN status = 'bought' THEN COALESCE(deal_value, 0) ELSE 0 END) as revenue
        FROM leads
        WHERE user_id = ? AND fb_campaign_id IS NOT NULL
        GROUP BY fb_campaign_id
        ORDER BY total DESC
        LIMIT 10
    `).all(userId);

    res.json({ stats, by_campaign: byCampaign });
});

// ─────────────────────────────────────────────────────────────
// CAPI: отправить Purchase событие в Facebook
// ─────────────────────────────────────────────────────────────
async function sendCapiPurchaseEvent(
    userId: string,
    lead: any,
    dealValue: number | null,
    token: string,
    db: any
) {
    // Нужен Pixel ID — берём первый доступный из ad_accounts через FB API
    const account = db.prepare(
        'SELECT fb_account_id FROM ad_accounts WHERE user_id = ? LIMIT 1'
    ).get(userId) as any;
    if (!account?.fb_account_id) return;

    // Получаем пиксели аккаунта
    const pixelsRes = await axios.get(
        `https://graph.facebook.com/v21.0/act_${account.fb_account_id}/adspixels`,
        { params: { fields: 'id', limit: 1, access_token: token } }
    );
    const pixelId = pixelsRes.data?.data?.[0]?.id;
    if (!pixelId) return;

    const eventId = uuidv4();
    const eventTime = Math.floor(Date.now() / 1000);

    // Хешируем данные (SHA256 — требование Meta CAPI)
    const crypto = require('crypto');
    const hash = (val: string) => val
        ? crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex')
        : undefined;

    const userData: any = {};
    if (lead.email) userData.em = [hash(lead.email)];
    if (lead.phone) {
        const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
        userData.ph = [hash(cleanPhone)];
    }

    const payload = {
        data: [{
            event_name: 'Purchase',
            event_time: eventTime,
            event_id: eventId,
            action_source: 'crm',
            user_data: userData,
            custom_data: {
                currency: 'KZT',
                value: dealValue || 0,
                order_id: lead.id,
            },
        }],
        access_token: token,
    };

    await axios.post(
        `https://graph.facebook.com/v21.0/${pixelId}/events`,
        payload
    );

    // Сохраняем event_id
    db.prepare('UPDATE leads SET capi_event_id = ?, capi_sent_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(eventId, lead.id);

    console.log(`[CAPI] Purchase event sent for lead ${lead.id}, pixel ${pixelId}`);
}

export default router;
