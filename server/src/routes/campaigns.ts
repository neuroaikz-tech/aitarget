import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { FacebookAdsService } from '../services/facebookAds';

const router = Router();

// Получить рекламный токен пользователя
function getFbToken(userId: string, fbAccountId?: string): string | null {
    const db = getDb();
    let account: any;

    if (fbAccountId) {
        account = db.prepare(
            'SELECT access_token FROM facebook_accounts WHERE user_id = ? AND id = ?'
        ).get(userId, fbAccountId);
    } else {
        account = db.prepare(
            'SELECT access_token FROM facebook_accounts WHERE user_id = ? LIMIT 1'
        ).get(userId);
    }

    return account?.access_token || null;
}

// Получить рекламные аккаунты FB
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const service = new FacebookAdsService(token);
        const accounts = await service.getAdAccounts();
        res.json({ accounts });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// Получить кампании
router.get('/accounts/:adAccountId/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const service = new FacebookAdsService(token);
        const campaigns = await service.getCampaigns(req.params.adAccountId as string);
        res.json({ campaigns });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// Создать кампанию
router.post('/accounts/:adAccountId/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const { name, objective, status, special_ad_categories, daily_budget, lifetime_budget, start_time, stop_time } = req.body;

        if (!name || !objective) {
            return res.status(400).json({ error: 'Название и цель обязательны' });
        }

        const service = new FacebookAdsService(token);
        const campaign = await service.createCampaign(req.params.adAccountId as string, {
            name,
            objective,
            status: status || 'PAUSED',
            special_ad_categories,
            daily_budget,
            lifetime_budget,
            start_time,
            stop_time,
        });

        res.status(201).json({ campaign });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка создания кампании' });
    }
});

// Обновить кампанию
router.patch('/campaigns/:campaignId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const { name, status, daily_budget, lifetime_budget } = req.body;
        const service = new FacebookAdsService(token);
        const result = await service.updateCampaign(req.params.campaignId as string, {
            name,
            status,
            daily_budget,
            lifetime_budget,
        });

        res.json({ result });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка обновления кампании' });
    }
});

// Удалить кампанию
router.delete('/campaigns/:campaignId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const service = new FacebookAdsService(token);
        const result = await service.deleteCampaign(req.params.campaignId as string);
        res.json({ result, message: 'Кампания удалена' });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка удаления кампании' });
    }
});

// Получить статистику кампании
router.get('/campaigns/:campaignId/insights', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const { since, until } = req.query as { since?: string; until?: string };
        const service = new FacebookAdsService(token);
        const insights = await service.getCampaignInsights(
            req.params.campaignId as string,
            since && until ? { since, until } : undefined
        );

        res.json({ insights });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка получения статистики' });
    }
});

// Получить группы объявлений
router.get('/campaigns/:campaignId/adsets', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = getFbToken(req.user.id);
        if (!token) {
            return res.status(403).json({ error: 'Facebook аккаунт не подключён' });
        }

        const service = new FacebookAdsService(token);
        const adsets = await service.getAdSets(req.params.campaignId as string);
        res.json({ adsets });
    } catch (err: any) {
        console.error(err?.response?.data || err);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

export default router;
