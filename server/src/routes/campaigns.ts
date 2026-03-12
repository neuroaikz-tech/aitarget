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

        const { 
            name, objective, status, special_ad_categories, daily_budget, lifetime_budget, start_time, stop_time,
            targeting, placements, destination, image, adText
        } = req.body;

        if (!name || !objective) {
            return res.status(400).json({ error: 'Название и цель обязательны' });
        }

        const service = new FacebookAdsService(token);
        
        // 1. Создаем кампанию
        // CBO (Campaign Budget Optimization) отключен, бюджет задается на уровне AdSet (ABO).
        // Поэтому мы НЕ передаем daily_budget и lifetime_budget на уровень кампании.
        const campaign = await service.createCampaign(req.params.adAccountId as string, {
            name,
            objective,
            status: status || 'PAUSED',
            special_ad_categories,
            start_time,
            stop_time,
        });

        if (!campaign || !campaign.id) {
            throw new Error('Не удалось создать кампанию');
        }

        try {
            // Пытаемся получить Facebook Page ID для рекламы в ленте (нужна для Ad Creative)
            const pages = await service.getPages();
            const pageId = pages.length > 0 ? pages[0].id : null;

            // 2. Создаем AdSet
            let publisher_platforms = [];
            let facebook_positions = [];
            let instagram_positions = [];
            
            if (placements?.fb_feed) {
                publisher_platforms.push('facebook');
                facebook_positions.push('feed');
            }
            if (placements?.fb_stories) {
                if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook');
                facebook_positions.push('story');
            }
            if (placements?.ig_feed) {
                publisher_platforms.push('instagram');
                instagram_positions.push('stream');
            }
            if (placements?.ig_reels) {
                if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
                instagram_positions.push('reels');
            }
            if (publisher_platforms.length === 0) publisher_platforms = ['facebook', 'instagram'];

            const optimizedGoal = objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' 
                                : objective === 'OUTCOME_ENGAGEMENT' ? 'POST_ENGAGEMENT'
                                : 'REACH';

            let promotedObject = undefined;
            if (pageId && (objective === 'OUTCOME_ENGAGEMENT' || destination !== 'WEBSITE')) {
                // Вовлеченность или трафик в мессенджеры часто требует привязки к странице на уровне AdSet
                promotedObject = JSON.stringify({ page_id: pageId });
            }

            const adSetParams: any = {
                campaign_id: campaign.id,
                name: `${name} - AdSet`,
                optimization_goal: optimizedGoal,
                billing_event: 'IMPRESSIONS',
                daily_budget: daily_budget || 500, // Минимум для FB API ($5)
                status: 'PAUSED',
                targeting: JSON.stringify({
                    geo_locations: {
                        countries: [targeting?.location || 'KZ']
                    },
                    age_min: targeting?.ageMin ? parseInt(targeting.ageMin) : 18,
                    age_max: targeting?.ageMax ? parseInt(targeting.ageMax) : 65,
                    ...(targeting?.gender === 'MALE' ? { genders: [1] } : targeting?.gender === 'FEMALE' ? { genders: [2] } : {}),
                    publisher_platforms: publisher_platforms,
                    facebook_positions: facebook_positions.length > 0 ? facebook_positions : undefined,
                    instagram_positions: instagram_positions.length > 0 ? instagram_positions : undefined,
                    device_platforms: ['mobile', 'desktop'],
                })
            };

            if (promotedObject) adSetParams.promoted_object = promotedObject;

            const adSet = await service.createAdSet(req.params.adAccountId as string, adSetParams);

            // 3. Загружаем изображение и создаем объявление (если есть pageId и image)
            if (adSet?.id && pageId && image && image.startsWith('data:image')) {
                const uploadedData = await service.uploadImage(req.params.adAccountId as string, image);
                const imageHash = uploadedData?.images?.[Object.keys(uploadedData.images)[0]]?.hash;

                if (imageHash) {
                    const creative = await service.createAdCreative(req.params.adAccountId as string, {
                        name: `${name} - Creative`,
                        object_story_spec: JSON.stringify({
                            page_id: pageId,
                            link_data: {
                                image_hash: imageHash,
                                link: destination === 'WHATSAPP' ? 'https://whatsapp.com' : 'https://example.com',
                                message: adText || 'Новое предложение от нас!'
                            }
                        })
                    });

                    if (creative?.id) {
                        await service.createAd(req.params.adAccountId as string, {
                            name: `${name} - Ad`,
                            adset_id: adSet.id,
                            creative: JSON.stringify({ creative_id: creative.id }),
                            status: 'PAUSED'
                        });
                    }
                }
            }

        } catch (e: any) {
            console.error('Ошибка при создании AdSet/Ad (кампания создана):', e?.response?.data || e);
            // Возвращаем ошибку на фронтенд, чтобы понять, из-за чего Facebook отклоняет создание
            return res.status(400).json({ 
                error: `Кампания создана, но Группа объявлений не прошла валидацию: ${e?.response?.data?.error?.message || e.message}` 
            });
        }

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
