import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { FacebookAdsService } from '../services/facebookAds';
import {
    FB_OBJECTIVES,
    FbObjective,
    FbDestination,
    buildPromotedObject,
    buildDestinationLink,
    resolveDestinationConfig,
    resolveBidStrategy,
    buildMessagingDestinationType,
} from '../config/fbAdsConfig';

const router = Router();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getFbToken(userId: string): string | null {
    const db = getDb();
    const account = db.prepare(
        'SELECT access_token, system_user_token FROM facebook_accounts WHERE user_id = ? LIMIT 1'
    ).get(userId) as any;
    // Приоритет: System User Token (long-lived, full access) > OAuth token
    return account?.system_user_token || account?.access_token || null;
}

function requireToken(userId: string, res: Response): string | null {
    const token = getFbToken(userId);
    if (!token) {
        res.status(403).json({ error: 'Facebook аккаунт не подключён. Подключите его в настройках.' });
        return null;
    }
    return token;
}

// ─────────────────────────────────────────────────────────────
// GET /accounts — рекламные аккаунты
// ─────────────────────────────────────────────────────────────
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const accounts = await service.getAdAccounts();
        res.json({ accounts });
    } catch (err: any) {
        console.error('[GET /accounts]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /pages — Facebook страницы пользователя
// ─────────────────────────────────────────────────────────────
router.get('/pages', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const pages = await service.getPages();
        res.json({ pages });
    } catch (err: any) {
        console.error('[GET /pages]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /accounts/:adAccountId/campaigns
// ─────────────────────────────────────────────────────────────
router.get('/accounts/:adAccountId/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const campaigns = await service.getCampaigns(req.params.adAccountId);
        res.json({ campaigns });
    } catch (err: any) {
        console.error('[GET /campaigns]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /accounts/:adAccountId/campaigns — создание кампании
// ─────────────────────────────────────────────────────────────
router.post('/accounts/:adAccountId/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;

        const {
            name,
            objective,
            destination,
            daily_budget,
            bid_amount,
            targeting,
            placements,
            image,
            adText,
            // Page / asset IDs
            pageId,
            instagramActorId,   // Instagram Business Account ID
            pixelId,            // Facebook Pixel ID (for SALES)
            appId,              // App ID (for APP_PROMOTION)
            appStoreUrl,        // App store URL (for APP_PROMOTION)
            // Destination-specific
            websiteUrl,
            whatsappPhone,
            // Lead form
            leadFormId,
            // Multi-messaging destinations (e.g. ['WHATSAPP', 'INSTAGRAM_DIRECT'])
            messagingDestinations,
            // Advanced
            optimization_goal_override, // allow power users to override
        } = req.body;

        // ── 1. Validation ─────────────────────────────────────────
        if (!name?.trim()) {
            return res.status(400).json({ error: 'Укажите название кампании' });
        }
        if (!pageId) {
            return res.status(400).json({ error: 'Выберите Facebook Страницу — она обязательна для показа рекламы' });
        }

        const objKey = objective as FbObjective;
        if (!FB_OBJECTIVES[objKey]) {
            return res.status(400).json({ error: `Неизвестная цель кампании: ${objective}` });
        }

        const destKey = destination as FbDestination;
        const { config: destConfig, destination: resolvedDest } = resolveDestinationConfig(objKey, destKey);

        // Validate destination-specific required fields
        if (destConfig.requires_website_url && !websiteUrl?.trim()) {
            return res.status(400).json({ error: 'Для этой цели и места назначения укажите URL сайта' });
        }
        const needsWhatsApp = destConfig.requires_whatsapp_phone
            || (Array.isArray(messagingDestinations) && messagingDestinations.includes('WHATSAPP'));
        if (needsWhatsApp && !whatsappPhone?.trim()) {
            return res.status(400).json({ error: 'Для WhatsApp укажите номер телефона (с кодом страны)' });
        }
        if (resolvedDest === 'LEAD_FORM' && !leadFormId) {
            return res.status(400).json({ error: 'Для Lead Form укажите ID формы лидогенерации' });
        }
        if (objKey === 'OUTCOME_APP_PROMOTION' && !appId) {
            return res.status(400).json({ error: 'Для продвижения приложения укажите App ID' });
        }

        const service = new FacebookAdsService(token);
        const adAccountId = req.params.adAccountId;

        // ── 2. Create Campaign ────────────────────────────────────
        const campaign = await service.createCampaign(adAccountId, {
            name: name.trim(),
            objective: objKey,
            status: 'PAUSED',
            special_ad_categories: [],
        });

        if (!campaign?.id) {
            return res.status(500).json({ error: 'Facebook не вернул ID кампании' });
        }

        // ── 3. Build AdSet params ─────────────────────────────────
        try {
            // Placements
            const publisher_platforms: string[] = [];
            const facebook_positions: string[] = [];
            const instagram_positions: string[] = [];

            if (placements?.fb_feed) {
                if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook');
                facebook_positions.push('feed');
            }
            if (placements?.fb_stories) {
                if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook');
                facebook_positions.push('story');
            }
            if (placements?.ig_feed) {
                if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
                instagram_positions.push('stream');
            }
            if (placements?.ig_reels) {
                if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram');
                instagram_positions.push('reels');
            }
            // Default: automatic placements
            if (publisher_platforms.length === 0) {
                publisher_platforms.push('facebook', 'instagram');
            }
            // Facebook требует хотя бы один Facebook плейсмент при наличии page_id в креативе
            if (!publisher_platforms.includes('facebook')) {
                publisher_platforms.push('facebook');
                facebook_positions.push('feed');
            }

            // Optimization goal: use override if provided & valid, else default from config
            let optimizationGoal = destConfig.default_optimization_goal;
            if (
                optimization_goal_override &&
                destConfig.optimization_goals.includes(optimization_goal_override)
            ) {
                optimizationGoal = optimization_goal_override;
            }

            // Bid strategy
            const bidStrategy = resolveBidStrategy(destConfig, bid_amount);

            // promoted_object
            const promotedObject = buildPromotedObject(
                objKey,
                pageId,
                pixelId,
                appId,
                appStoreUrl,
            );

            const adSetParams: Record<string, any> = {
                campaign_id: campaign.id,
                name: `${name.trim()} — AdSet`,
                optimization_goal: optimizationGoal,
                billing_event: destConfig.billing_event,
                bid_strategy: bidStrategy,
                daily_budget: daily_budget || 500, // cents, minimum ~$5
                status: 'PAUSED',
                destination_type: (Array.isArray(messagingDestinations) && messagingDestinations.length > 1)
                    ? buildMessagingDestinationType(messagingDestinations)
                    : destConfig.destination_type,
                targeting: JSON.stringify({
                    geo_locations: {
                        countries: [targeting?.location || 'KZ'],
                    },
                    age_min: targeting?.ageMin ? parseInt(targeting.ageMin) : 18,
                    age_max: targeting?.ageMax ? parseInt(targeting.ageMax) : 65,
                    ...(targeting?.gender === 'MALE'
                        ? { genders: [1] }
                        : targeting?.gender === 'FEMALE'
                        ? { genders: [2] }
                        : {}),
                    publisher_platforms,
                    ...(facebook_positions.length > 0 && { facebook_positions }),
                    ...(instagram_positions.length > 0 && { instagram_positions }),
                    device_platforms: ['mobile', 'desktop'],
                }),
            };

            if (promotedObject) {
                adSetParams.promoted_object = JSON.stringify(promotedObject);
            }
            if (bid_amount) {
                adSetParams.bid_amount = bid_amount;
            }

            const adSet = await service.createAdSet(adAccountId, adSetParams);

            if (!adSet?.id) {
                return res.status(500).json({
                    error: 'Кампания создана, но AdSet не удалось создать (нет ID в ответе)',
                    campaign_id: campaign.id,
                });
            }

            // ── 4. Ad Creative + Ad ──────────────────────────────
            if (!image || !image.startsWith('data:image')) {
                // No creative provided — return partial success
                return res.status(201).json({
                    campaign,
                    adset_id: adSet.id,
                    warning: 'Кампания и группа объявлений созданы. Креатив не добавлен (изображение не передано).',
                });
            }

            // Upload image
            const uploadedData = await service.uploadImage(adAccountId, image);
            const imageHash = uploadedData?.images?.['creative.jpg']?.hash;

            if (!imageHash) {
                return res.status(500).json({
                    error: 'Не удалось загрузить изображение в Facebook',
                    campaign_id: campaign.id,
                    adset_id: adSet.id,
                });
            }

            // Resolve call-to-action
            const isMultiMessaging = Array.isArray(messagingDestinations) && messagingDestinations.length > 1;
            const ctaType = isMultiMessaging ? 'MESSAGE_PAGE' : destConfig.default_call_to_action;
            // For multi-messaging use WhatsApp link if WhatsApp is in selection, else fallback
            const primaryDest = isMultiMessaging
                ? (messagingDestinations.includes('WHATSAPP') ? 'WHATSAPP' : resolvedDest)
                : resolvedDest;
            const destinationLink = buildDestinationLink(primaryDest as FbDestination, websiteUrl, whatsappPhone);

            // Build call_to_action value based on destination
            const ctaValue = buildCtaValue(resolvedDest, destinationLink, leadFormId, appStoreUrl);

            // Build object_story_spec
            const objectStorySpec: Record<string, any> = {
                page_id: pageId,
                link_data: {
                    image_hash: imageHash,
                    link: destinationLink,
                    message: adText?.trim() || '',
                    call_to_action: {
                        type: ctaType,
                        value: ctaValue,
                    },
                },
            };

            // Add instagram_actor_id when Instagram placements are selected
            const hasInstagramPlacement =
                placements?.ig_feed || placements?.ig_reels || destConfig.requires_instagram_actor;
            if (hasInstagramPlacement && instagramActorId) {
                objectStorySpec.instagram_user_id = instagramActorId;
            }

            const creativeParams: Record<string, any> = {
                name: `${name.trim()} — Creative`,
                object_story_spec: JSON.stringify(objectStorySpec),
            };

            // Required for multi-destination (messaging) ads
            if (isMultiMessaging) {
                creativeParams.degrees_of_freedom = JSON.stringify({
                    creative_features_spec: {
                        standard_enhancements: { enroll_status: 'OPT_IN' },
                    },
                });
            }

            const creative = await service.createAdCreative(adAccountId, creativeParams);

            if (!creative?.id) {
                return res.status(500).json({
                    error: 'Кампания и группа созданы, но креатив не удалось создать',
                    campaign_id: campaign.id,
                    adset_id: adSet.id,
                });
            }

            const ad = await service.createAd(adAccountId, {
                name: `${name.trim()} — Ad`,
                adset_id: adSet.id,
                creative: JSON.stringify({ creative_id: creative.id }),
                status: 'PAUSED',
            });

            return res.status(201).json({
                campaign,
                adset_id: adSet.id,
                creative_id: creative.id,
                ad_id: ad?.id,
                resolved_config: {
                    objective: objKey,
                    destination: resolvedDest,
                    optimization_goal: optimizationGoal,
                    billing_event: destConfig.billing_event,
                    bid_strategy: bidStrategy,
                    cta: ctaType,
                },
            });

        } catch (innerErr: any) {
            const fbError = innerErr?.response?.data?.error;
            console.error('[POST /campaigns] AdSet/Ad creation error:', fbError || innerErr.message);
            return res.status(400).json({
                error: fbError?.message || innerErr.message || 'Ошибка создания AdSet или объявления',
                fb_error_code: fbError?.code,
                fb_error_subcode: fbError?.error_subcode,
                fb_error_type: fbError?.type,
                campaign_id: campaign.id,
            });
        }

    } catch (err: any) {
        const fbError = err?.response?.data?.error;
        console.error('[POST /campaigns] Campaign creation error:', fbError || err.message);
        res.status(500).json({
            error: fbError?.message || err.message || 'Ошибка создания кампании',
            fb_error_code: fbError?.code,
        });
    }
});

// ─────────────────────────────────────────────────────────────
// PATCH /campaigns/:campaignId — обновить кампанию
// ─────────────────────────────────────────────────────────────
router.patch('/campaigns/:campaignId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const { name, status, daily_budget, lifetime_budget } = req.body;
        const service = new FacebookAdsService(token);
        const result = await service.updateCampaign(req.params.campaignId, {
            name,
            status,
            daily_budget,
            lifetime_budget,
        });
        res.json({ result });
    } catch (err: any) {
        console.error('[PATCH /campaigns]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка обновления кампании' });
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE /campaigns/:campaignId
// ─────────────────────────────────────────────────────────────
router.delete('/campaigns/:campaignId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const result = await service.deleteCampaign(req.params.campaignId);
        res.json({ result, message: 'Кампания удалена' });
    } catch (err: any) {
        console.error('[DELETE /campaigns]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка удаления кампании' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /campaigns/:campaignId/insights
// ─────────────────────────────────────────────────────────────
router.get('/campaigns/:campaignId/insights', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const { since, until } = req.query as { since?: string; until?: string };
        const service = new FacebookAdsService(token);
        const insights = await service.getCampaignInsights(
            req.params.campaignId,
            since && until ? { since, until } : undefined
        );
        res.json({ insights });
    } catch (err: any) {
        console.error('[GET /insights]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка получения статистики' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /campaigns/:campaignId/adsets
// ─────────────────────────────────────────────────────────────
router.get('/campaigns/:campaignId/adsets', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const adsets = await service.getAdSets(req.params.campaignId);
        res.json({ adsets });
    } catch (err: any) {
        console.error('[GET /adsets]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /objectives — конфиг целей для фронтенда
// ─────────────────────────────────────────────────────────────
router.get('/objectives', authenticate, (_req: AuthRequest, res: Response) => {
    res.json({ objectives: FB_OBJECTIVES });
});

// ─────────────────────────────────────────────────────────────
// GET /debug/token — проверить права текущего токена FB
// ─────────────────────────────────────────────────────────────
router.get('/debug/token', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);

        const [permissionsData, meData, pagesRawData, pagesFullData] = await Promise.allSettled([
            service['get']('/me/permissions'),
            service['get']('/me', { fields: 'id,name,email' }),
            service['get']('/me/accounts', { fields: 'id,name', limit: 5 }),
            service['get']('/me/accounts', {
                fields: 'id,name,access_token,whatsapp_number,connected_instagram_account{id,name,username},instagram_business_account{id,name,username}',
                limit: 5,
            }),
        ]);

        // Per-page diagnostics via page access token
        const pageTokenResults: any[] = [];
        if (pagesRawData.status === 'fulfilled') {
            for (const page of (pagesRawData.value.data || []).slice(0, 3)) {
                const pagesFullValue = pagesFullData.status === 'fulfilled' ? pagesFullData.value.data : [];
                const fullPage = pagesFullValue?.find((p: any) => p.id === page.id);
                // Используем page token если есть, иначе system user token
                const pageToken = fullPage?.access_token || token;
                const pageService = new FacebookAdsService(pageToken);
                const [pageFields, igEdge, igEdgeSystemToken] = await Promise.allSettled([
                    pageService['get'](`/${page.id}`, {
                        fields: 'whatsapp_number,has_whatsapp_number,has_whatsapp_business_number,connected_instagram_account{id,name,username},instagram_business_account{id,name,username}',
                    }),
                    pageService['get'](`/${page.id}/instagram_accounts`, { fields: 'id,name,username', limit: 5 }),
                    // Также пробуем напрямую через system token (не page token)
                    service['get'](`/${page.id}`, {
                        fields: 'connected_instagram_account{id,name,username},instagram_business_account{id,name,username}',
                    }),
                ]);
                pageTokenResults.push({
                    page_id: page.id,
                    page_name: page.name,
                    token_used: fullPage?.access_token ? 'page_token' : 'system_token',
                    page_fields: pageFields.status === 'fulfilled' ? pageFields.value : { error: (pageFields as any).reason?.response?.data || (pageFields as any).reason?.message },
                    instagram_accounts_edge: igEdge.status === 'fulfilled' ? igEdge.value : { error: (igEdge as any).reason?.response?.data || (igEdge as any).reason?.message },
                    page_fields_via_system_token: igEdgeSystemToken.status === 'fulfilled' ? igEdgeSystemToken.value : { error: (igEdgeSystemToken as any).reason?.response?.data || (igEdgeSystemToken as any).reason?.message },
                });
            }
        }

        res.json({
            me: meData.status === 'fulfilled' ? meData.value : { error: (meData as any).reason?.message },
            permissions: permissionsData.status === 'fulfilled'
                ? permissionsData.value.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission)
                : { error: (permissionsData as any).reason?.message },
            pages_basic: pagesRawData.status === 'fulfilled'
                ? pagesRawData.value.data
                : { error: (pagesRawData as any).reason?.message },
            pages_with_assets_via_user_token: pagesFullData.status === 'fulfilled'
                ? pagesFullData.value.data
                : { error: (pagesFullData as any).reason?.message },
            pages_via_page_token: pageTokenResults,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /accounts/:adAccountId/pixels — пиксели аккаунта
// ─────────────────────────────────────────────────────────────
router.get('/accounts/:adAccountId/pixels', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const pixels = await service.getPixels(req.params.adAccountId);
        res.json({ pixels });
    } catch (err: any) {
        console.error('[GET /pixels]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /whatsapp-accounts — WhatsApp номера всех страниц
// ─────────────────────────────────────────────────────────────
router.get('/whatsapp-accounts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        // Страницы уже содержат whatsapp_number — передаём их сразу
        const pages = await service.getPages();
        const whatsapp_accounts = await service.getWhatsAppNumbers(pages);
        res.json({ whatsapp_accounts });
    } catch (err: any) {
        console.error('[GET /whatsapp-accounts]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /instagram-accounts — Instagram аккаунты всех страниц
// ─────────────────────────────────────────────────────────────
router.get('/instagram-accounts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        // Страницы уже содержат connected_instagram_account — передаём их сразу
        const pages = await service.getPages();
        const igAccounts = await service.getInstagramAccountsForPages(pages);
        res.json({ instagram_accounts: igAccounts });
    } catch (err: any) {
        console.error('[GET /instagram-accounts]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /debug/instagram-actors — Instagram Actors рекламного аккаунта
// ─────────────────────────────────────────────────────────────
router.get('/debug/instagram-actors', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        // Получаем рекламные аккаунты
        const adAccounts = await service.getAdAccounts();
        const results: any[] = [];
        for (const acc of adAccounts.slice(0, 3)) {
            const [actors, igUsers] = await Promise.allSettled([
                service['get'](`/act_${acc.fb_account_id}/instagram_actors`, { fields: 'id,name,username,profile_pic' }),
                service['get'](`/act_${acc.fb_account_id}/instagram_user`, { fields: 'id,name,username' }),
            ]);
            results.push({
                ad_account_id: acc.fb_account_id,
                ad_account_name: acc.name,
                instagram_actors: actors.status === 'fulfilled' ? actors.value : { error: (actors as any).reason?.response?.data || (actors as any).reason?.message },
                instagram_user: igUsers.status === 'fulfilled' ? igUsers.value : { error: (igUsers as any).reason?.response?.data || (igUsers as any).reason?.message },
            });
        }
        res.json({ results });
    } catch (err: any) {
        console.error('[GET /debug/instagram-actors]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /pages/:pageId/lead-forms — Lead Forms страницы
// ─────────────────────────────────────────────────────────────
router.get('/pages/:pageId/lead-forms', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);

        // Получаем page access token для этой страницы
        const pages = await service.getPages();
        const page = pages.find((p: any) => p.id === req.params.pageId);
        const pageAccessToken = page?.access_token;

        const forms = await service.getLeadForms(req.params.pageId, pageAccessToken);
        res.json({ lead_forms: forms });
    } catch (err: any) {
        console.error('[GET /lead-forms]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /apps — приложения пользователя
// ─────────────────────────────────────────────────────────────
router.get('/apps', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const token = requireToken(req.user.id, res);
        if (!token) return;
        const service = new FacebookAdsService(token);
        const apps = await service.getApps();
        res.json({ apps });
    } catch (err: any) {
        console.error('[GET /apps]', err?.response?.data || err.message);
        res.status(500).json({ error: err?.response?.data?.error?.message || 'Ошибка Facebook API' });
    }
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildCtaValue(
    destination: FbDestination,
    link: string,
    leadFormId?: string,
    appStoreUrl?: string,
): Record<string, string> {
    switch (destination) {
        case 'WHATSAPP':
            return { link };
        case 'INSTAGRAM_DIRECT':
        case 'MESSENGER':
            return {};
        case 'LEAD_FORM':
            return leadFormId ? { lead_gen_form_id: leadFormId } : {};
        case 'APP':
            return appStoreUrl ? { link: appStoreUrl } : { link };
        case 'WEBSITE':
        default:
            return { link };
    }
}

export default router;
