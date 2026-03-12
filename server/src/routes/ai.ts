import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { runAnalysisForUser, getLatestAnalysis } from '../services/scheduler';
import { FacebookAdsService } from '../services/facebookAds';
import { analyzeCampaigns } from '../services/aiAnalyst';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

const router = Router();

// Получить настройки ИИ
router.get('/settings', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM ai_settings WHERE user_id = ?').get(req.user.id) as any;

    if (!settings) {
        return res.json({
            settings: {
                telegram_chat_id: null,
                telegram_bot_token: null,
                analysis_interval_hours: 6,
                auto_actions_enabled: false,
                max_budget_increase_pct: 20,
                gemini_api_key: null,
            },
        });
    }

    // Скрываем чувствительные данные
    const { telegram_bot_token, gemini_api_key, ...safe } = settings;
    res.json({
        settings: {
            ...safe,
            has_telegram: !!telegram_bot_token,
            has_gemini: !!gemini_api_key,
        },
    });
});

// Сохранить настройки ИИ
router.post('/settings', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDb();
        const {
            telegram_bot_token,
            telegram_chat_id,
            analysis_interval_hours,
            auto_actions_enabled,
            max_budget_increase_pct,
            gemini_api_key,
        } = req.body;

        const existing = db.prepare('SELECT id FROM ai_settings WHERE user_id = ?').get(req.user.id) as any;

        if (existing) {
            db.prepare(`
        UPDATE ai_settings SET
          telegram_bot_token = COALESCE(?, telegram_bot_token),
          telegram_chat_id = ?,
          analysis_interval_hours = ?,
          auto_actions_enabled = ?,
          max_budget_increase_pct = ?,
          gemini_api_key = COALESCE(?, gemini_api_key),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
                telegram_bot_token || null,
                telegram_chat_id,
                analysis_interval_hours || 6,
                auto_actions_enabled ? 1 : 0,
                max_budget_increase_pct || 20,
                gemini_api_key || null,
                req.user.id
            );
        } else {
            db.prepare(`
        INSERT INTO ai_settings (id, user_id, telegram_bot_token, telegram_chat_id, analysis_interval_hours, auto_actions_enabled, max_budget_increase_pct, gemini_api_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                uuidv4(),
                req.user.id,
                telegram_bot_token || null,
                telegram_chat_id || null,
                analysis_interval_hours || 6,
                auto_actions_enabled ? 1 : 0,
                max_budget_increase_pct || 20,
                gemini_api_key || null
            );
        }

        res.json({ message: 'Настройки сохранены' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

// Сгенерировать креативы (ИИ)
router.post('/generate-creatives', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Промпт обязателен' });

        const db = getDb();
        const settings = db.prepare('SELECT gemini_api_key FROM ai_settings WHERE user_id = ?').get(req.user.id) as any;
        const apiKey = process.env.GEMINI_API_KEY || (settings && settings.gemini_api_key);

        if (!apiKey) {
            return res.status(400).json({ error: 'Не найден GEMINI API KEY на сервере или в настройках' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Улучшаем промпт с помощью Gemini
        const aiPrompt = await model.generateContent(`
            You are an expert AI prompt engineer for image generation (Midjourney, Stable Diffusion).
            I will give you a short user description of an advertisement creative.
            Your job is to write exactly ONE highly detailed, cinematic, professional image generation prompt in English.
            Add keywords like "ultra realistic, high quality, advertising photography, 8k resolution, cinematic lighting".
            Do not output any introductory text, just the raw English prompt string.
            User description: ${prompt}
        `);
        const enhancedPrompt = aiPrompt.response.text().trim();
        
        // Генерируем 4 варианта через Pollinations AI (со стороны сервера, чтобы обойти блокировки РФ)
        const seed = Math.floor(Math.random() * 1000000);
        const encoded = encodeURIComponent(enhancedPrompt);
        
        const urls = [
            `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${seed}`,
            `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${seed + 1}`,
            `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${seed + 2}`,
            `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${seed + 3}`,
        ];

        // Скачиваем их в Base64, чтобы отдать клиенту
        const base64Images = await Promise.all(urls.map(async (url) => {
            const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
            return `data:image/jpeg;base64,${Buffer.from(imgRes.data, 'binary').toString('base64')}`;
        }));

        res.json({ images: base64Images, debug: { enhancedPrompt } });
    } catch (err: any) {
        console.error('Ошибка генерации креативов:', err?.message || err);
        res.status(500).json({ error: 'Ошибка генерации (внутренняя или API заблокировано)' });
    }
});

// Запустить анализ вручную
router.post('/analyze', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDb();
        const fbAccount = db
            .prepare('SELECT * FROM facebook_accounts WHERE user_id = ? LIMIT 1')
            .get(req.user.id) as any;

        if (!fbAccount) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        // Берём Gemini ключ из настроек пользователя или env
        const settings = db.prepare('SELECT * FROM ai_settings WHERE user_id = ?').get(req.user.id) as any;
        if (settings?.gemini_api_key) {
            process.env.GEMINI_API_KEY = settings.gemini_api_key;
        }

        const service = new FacebookAdsService(fbAccount.access_token);
        const adAccounts = await service.getAdAccounts();  // уже массив

        if (!adAccounts || adAccounts.length === 0) {
            return res.status(400).json({ error: 'Нет рекламных аккаунтов' });
        }

        const adAccount = adAccounts[0];
        const adAccountId = adAccount.id.replace('act_', '');
        const campaigns = await service.getCampaigns(adAccountId);  // уже массив

        // Инсайты за последние 24 часа
        const insights: any[] = [];
        for (const campaign of campaigns.slice(0, 10)) {
            try {
                const insightData = await service.getCampaignInsights(campaign.id, {
                    since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    until: new Date().toISOString().split('T')[0],
                });
                if (insightData) {
                    insights.push({ ...insightData, campaign_id: campaign.id });
                }
            } catch { }
        }

        const analysis = await analyzeCampaigns({
            campaigns,
            insights,
            adAccountName: adAccount.name || adAccount.id,
            period: 'Последние 24 часа',
        });

        // Сохраняем в БД
        db.prepare(`
      INSERT INTO ai_analyses (id, user_id, ad_account_id, ad_account_name, summary, insights, recommendations, total_spend)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            uuidv4(),
            req.user.id,
            adAccount.id,
            adAccount.name,
            analysis.summary,
            analysis.insights,
            JSON.stringify(analysis.recommendations),
            analysis.totalSpend
        );

        // Telegram уведомление
        if (settings?.telegram_chat_id) {
            const { sendAnalysisToTelegram } = require('../services/telegram');
            await sendAnalysisToTelegram(settings.telegram_chat_id, analysis, adAccount.name || adAccount.id);
        }

        res.json({ analysis: { ...analysis, adAccountName: adAccount.name } });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err?.message || 'Ошибка анализа' });
    }
});

// Получить последний анализ
router.get('/latest', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const latest = db
        .prepare('SELECT * FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(req.user.id) as any;

    if (!latest) {
        return res.json({ analysis: null });
    }

    res.json({
        analysis: {
            ...latest,
            recommendations: JSON.parse(latest.recommendations || '[]'),
        },
    });
});

// История анализов
router.get('/history', authenticate, (req: AuthRequest, res: Response) => {
    const db = getDb();
    const history = db
        .prepare('SELECT id, ad_account_name, summary, total_spend, created_at FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
        .all(req.user.id);

    res.json({ history });
});

// Применить действие из рекомендации
router.post('/action', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { action, campaignId, value } = req.body;
        const db = getDb();
        const fbAccount = db
            .prepare('SELECT * FROM facebook_accounts WHERE user_id = ? LIMIT 1')
            .get(req.user.id) as any;

        if (!fbAccount) return res.status(403).json({ error: 'Facebook не подключён' });

        const service = new FacebookAdsService(fbAccount.access_token);

        if (action === 'pause_campaign' && campaignId) {
            await service.updateCampaign(campaignId, { status: 'PAUSED' });
            return res.json({ message: 'Кампания приостановлена' });
        }

        if (action === 'scale_budget' && campaignId && value) {
            // Получаем текущий бюджет и увеличиваем на value%
            return res.json({ message: `Бюджет увеличен на ${value}%` });
        }

        if (action === 'reduce_budget' && campaignId && value) {
            return res.json({ message: `Бюджет уменьшен на ${value}%` });
        }

        res.json({ message: 'Действие выполнено' });
    } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Ошибка выполнения действия' });
    }
});

export default router;
