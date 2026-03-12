/**
 * Facebook Marketing API — Production Configuration
 *
 * Defines valid combinations of:
 * - Campaign objective → optimization_goal, billing_event
 * - Destination type compatibility per objective
 * - promoted_object requirements per objective
 * - Creative requirements per destination
 * - bid_strategy restrictions
 *
 * Sources: Facebook Marketing API v19.0 official docs
 */

export type FbObjective =
    | 'OUTCOME_AWARENESS'
    | 'OUTCOME_TRAFFIC'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_APP_PROMOTION'
    | 'OUTCOME_SALES';

export type FbDestination =
    | 'WEBSITE'
    | 'WHATSAPP'
    | 'INSTAGRAM_DIRECT'
    | 'MESSENGER'
    | 'LEAD_FORM'
    | 'APP';

export type FbOptimizationGoal =
    | 'REACH'
    | 'IMPRESSIONS'
    | 'LINK_CLICKS'
    | 'LANDING_PAGE_VIEWS'
    | 'POST_ENGAGEMENT'
    | 'VIDEO_VIEWS'
    | 'CONVERSATIONS'
    | 'LEAD_GENERATION'
    | 'QUALITY_LEAD'
    | 'APP_INSTALLS'
    | 'OFFSITE_CONVERSIONS'
    | 'VALUE';

export type FbBillingEvent =
    | 'IMPRESSIONS'
    | 'LINK_CLICKS'
    | 'POST_ENGAGEMENT'
    | 'PAGE_LIKES'
    | 'APP_INSTALLS'
    | 'VIDEO_VIEWS';

export type FbBidStrategy =
    | 'LOWEST_COST_WITHOUT_CAP'
    | 'COST_CAP'
    | 'LOWEST_COST_WITH_BID_CAP';

export type FbCallToAction =
    | 'LEARN_MORE'
    | 'SHOP_NOW'
    | 'SIGN_UP'
    | 'DOWNLOAD'
    | 'GET_QUOTE'
    | 'CONTACT_US'
    | 'SEND_WHATSAPP_MESSAGE'
    | 'SEND_MESSAGE'
    | 'SUBSCRIBE'
    | 'APPLY_NOW'
    | 'BOOK_TRAVEL'
    | 'ORDER_NOW'
    | 'GET_OFFER'
    | 'WATCH_MORE'
    | 'NO_BUTTON';

export interface DestinationConfig {
    destination_type: string;
    optimization_goals: FbOptimizationGoal[];
    default_optimization_goal: FbOptimizationGoal;
    billing_event: FbBillingEvent;
    /** Whether COST_CAP bid strategy is allowed */
    allow_cost_cap: boolean;
    call_to_actions: FbCallToAction[];
    default_call_to_action: FbCallToAction;
    /** Requires a website URL from the user */
    requires_website_url: boolean;
    /** Requires a WhatsApp phone number */
    requires_whatsapp_phone: boolean;
    /** Requires instagram_actor_id in creative */
    requires_instagram_actor: boolean;
}

export interface ObjectiveConfig {
    label: string;
    description: string;
    /** Valid destinations for this objective */
    destinations: FbDestination[];
    default_destination: FbDestination;
    /** promoted_object type required at AdSet level */
    promoted_object_type: 'page_id' | 'pixel_id' | 'app_id' | 'none';
    /** Per-destination configuration */
    destination_configs: Partial<Record<FbDestination, DestinationConfig>>;
}

/**
 * Master configuration for all Facebook campaign objectives.
 * Each objective defines what destinations are valid, and each destination
 * defines the exact API parameters required.
 */
export const FB_OBJECTIVES: Record<FbObjective, ObjectiveConfig> = {

    OUTCOME_AWARENESS: {
        label: 'Охват / Узнаваемость',
        description: 'Показать рекламу максимальному числу людей',
        destinations: ['WEBSITE'],
        default_destination: 'WEBSITE',
        promoted_object_type: 'page_id',
        destination_configs: {
            WEBSITE: {
                destination_type: 'WEBSITE',
                optimization_goals: ['REACH', 'IMPRESSIONS', 'VIDEO_VIEWS'],
                default_optimization_goal: 'REACH',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['LEARN_MORE', 'WATCH_MORE', 'NO_BUTTON'],
                default_call_to_action: 'LEARN_MORE',
                requires_website_url: true,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },

    OUTCOME_TRAFFIC: {
        label: 'Трафик',
        description: 'Привлечь посетителей на сайт или в мессенджер',
        destinations: ['WEBSITE', 'WHATSAPP', 'INSTAGRAM_DIRECT', 'MESSENGER'],
        default_destination: 'WEBSITE',
        promoted_object_type: 'page_id',
        destination_configs: {
            WEBSITE: {
                destination_type: 'WEBSITE',
                optimization_goals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
                default_optimization_goal: 'LINK_CLICKS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['LEARN_MORE', 'SHOP_NOW', 'GET_QUOTE', 'CONTACT_US', 'APPLY_NOW', 'BOOK_TRAVEL', 'ORDER_NOW', 'GET_OFFER'],
                default_call_to_action: 'LEARN_MORE',
                requires_website_url: true,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
            WHATSAPP: {
                destination_type: 'WHATSAPP',
                optimization_goals: ['LINK_CLICKS', 'CONVERSATIONS'],
                default_optimization_goal: 'LINK_CLICKS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false, // COST_CAP не работает с CONVERSATIONS
                call_to_actions: ['SEND_WHATSAPP_MESSAGE', 'CONTACT_US'],
                default_call_to_action: 'SEND_WHATSAPP_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: true,
                requires_instagram_actor: false,
            },
            INSTAGRAM_DIRECT: {
                destination_type: 'INSTAGRAM_DIRECT',
                optimization_goals: ['LINK_CLICKS', 'CONVERSATIONS'],
                default_optimization_goal: 'LINK_CLICKS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE', 'CONTACT_US'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: true,
            },
            MESSENGER: {
                destination_type: 'MESSENGER',
                optimization_goals: ['LINK_CLICKS', 'CONVERSATIONS'],
                default_optimization_goal: 'LINK_CLICKS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE', 'CONTACT_US'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },

    OUTCOME_ENGAGEMENT: {
        label: 'Вовлечённость',
        description: 'Получить лайки, комментарии, сообщения в мессенджер',
        destinations: ['WEBSITE', 'WHATSAPP', 'INSTAGRAM_DIRECT', 'MESSENGER'],
        default_destination: 'WHATSAPP',
        promoted_object_type: 'page_id',
        destination_configs: {
            WEBSITE: {
                destination_type: 'WEBSITE',
                optimization_goals: ['POST_ENGAGEMENT', 'LINK_CLICKS'],
                default_optimization_goal: 'POST_ENGAGEMENT',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['LEARN_MORE', 'CONTACT_US', 'GET_OFFER'],
                default_call_to_action: 'LEARN_MORE',
                requires_website_url: true,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
            WHATSAPP: {
                destination_type: 'WHATSAPP',
                optimization_goals: ['CONVERSATIONS'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_WHATSAPP_MESSAGE'],
                default_call_to_action: 'SEND_WHATSAPP_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: true,
                requires_instagram_actor: false,
            },
            INSTAGRAM_DIRECT: {
                destination_type: 'INSTAGRAM_DIRECT',
                optimization_goals: ['CONVERSATIONS'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: true,
            },
            MESSENGER: {
                destination_type: 'MESSENGER',
                optimization_goals: ['CONVERSATIONS'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },

    OUTCOME_LEADS: {
        label: 'Лиды',
        description: 'Собирать заявки через форму Facebook/Instagram или сайт',
        destinations: ['LEAD_FORM', 'WEBSITE', 'WHATSAPP', 'MESSENGER'],
        default_destination: 'LEAD_FORM',
        promoted_object_type: 'page_id',
        destination_configs: {
            LEAD_FORM: {
                destination_type: 'ON_AD',
                optimization_goals: ['LEAD_GENERATION', 'QUALITY_LEAD'],
                default_optimization_goal: 'LEAD_GENERATION',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['SIGN_UP', 'APPLY_NOW', 'GET_QUOTE', 'LEARN_MORE', 'SUBSCRIBE', 'DOWNLOAD'],
                default_call_to_action: 'SIGN_UP',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
            WEBSITE: {
                destination_type: 'WEBSITE',
                optimization_goals: ['LEAD_GENERATION', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
                default_optimization_goal: 'LEAD_GENERATION',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['SIGN_UP', 'APPLY_NOW', 'GET_QUOTE', 'LEARN_MORE', 'SUBSCRIBE'],
                default_call_to_action: 'SIGN_UP',
                requires_website_url: true,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
            WHATSAPP: {
                destination_type: 'WHATSAPP',
                optimization_goals: ['CONVERSATIONS', 'LEAD_GENERATION'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_WHATSAPP_MESSAGE', 'GET_QUOTE'],
                default_call_to_action: 'SEND_WHATSAPP_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: true,
                requires_instagram_actor: false,
            },
            MESSENGER: {
                destination_type: 'MESSENGER',
                optimization_goals: ['CONVERSATIONS', 'LEAD_GENERATION'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE', 'GET_QUOTE'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },

    OUTCOME_APP_PROMOTION: {
        label: 'Продвижение приложения',
        description: 'Увеличить установки или активность в мобильном приложении',
        destinations: ['APP'],
        default_destination: 'APP',
        promoted_object_type: 'app_id',
        destination_configs: {
            APP: {
                destination_type: 'APP',
                optimization_goals: ['APP_INSTALLS', 'LINK_CLICKS'],
                default_optimization_goal: 'APP_INSTALLS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['DOWNLOAD', 'LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE'],
                default_call_to_action: 'DOWNLOAD',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },

    OUTCOME_SALES: {
        label: 'Продажи',
        description: 'Увеличить конверсии, продажи на сайте или в мессенджере',
        destinations: ['WEBSITE', 'WHATSAPP', 'MESSENGER'],
        default_destination: 'WEBSITE',
        promoted_object_type: 'pixel_id',
        destination_configs: {
            WEBSITE: {
                destination_type: 'WEBSITE',
                optimization_goals: ['OFFSITE_CONVERSIONS', 'VALUE', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
                default_optimization_goal: 'OFFSITE_CONVERSIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: true,
                call_to_actions: ['SHOP_NOW', 'ORDER_NOW', 'GET_OFFER', 'LEARN_MORE', 'BOOK_TRAVEL', 'GET_QUOTE'],
                default_call_to_action: 'SHOP_NOW',
                requires_website_url: true,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
            WHATSAPP: {
                destination_type: 'WHATSAPP',
                optimization_goals: ['CONVERSATIONS', 'OFFSITE_CONVERSIONS'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_WHATSAPP_MESSAGE', 'ORDER_NOW', 'SHOP_NOW'],
                default_call_to_action: 'SEND_WHATSAPP_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: true,
                requires_instagram_actor: false,
            },
            MESSENGER: {
                destination_type: 'MESSENGER',
                optimization_goals: ['CONVERSATIONS', 'OFFSITE_CONVERSIONS'],
                default_optimization_goal: 'CONVERSATIONS',
                billing_event: 'IMPRESSIONS',
                allow_cost_cap: false,
                call_to_actions: ['SEND_MESSAGE', 'ORDER_NOW', 'SHOP_NOW'],
                default_call_to_action: 'SEND_MESSAGE',
                requires_website_url: false,
                requires_whatsapp_phone: false,
                requires_instagram_actor: false,
            },
        },
    },
};

/**
 * Build the adset promoted_object based on objective and user-provided IDs.
 */
export function buildPromotedObject(
    objective: FbObjective,
    pageId?: string,
    pixelId?: string,
    appId?: string,
    appStoreUrl?: string,
): Record<string, string> | undefined {
    const config = FB_OBJECTIVES[objective];
    if (!config) return undefined;

    switch (config.promoted_object_type) {
        case 'page_id':
            return pageId ? { page_id: pageId } : undefined;
        case 'pixel_id':
            if (!pixelId) return pageId ? { page_id: pageId } : undefined;
            return pageId
                ? { page_id: pageId, pixel_id: pixelId, custom_event_type: 'PURCHASE' }
                : { pixel_id: pixelId, custom_event_type: 'PURCHASE' };
        case 'app_id':
            if (!appId) return undefined;
            return {
                application_id: appId,
                ...(appStoreUrl && { object_store_url: appStoreUrl }),
            };
        default:
            return undefined;
    }
}

/**
 * Build the link_data.link URL based on destination type.
 */
export function buildDestinationLink(
    destination: FbDestination,
    websiteUrl?: string,
    whatsappPhone?: string,
): string {
    switch (destination) {
        case 'WHATSAPP':
            // wa.me format required for WhatsApp click-to-chat
            if (whatsappPhone) {
                const clean = whatsappPhone.replace(/[^0-9]/g, '');
                return `https://wa.me/${clean}`;
            }
            return 'https://wa.me/';
        case 'INSTAGRAM_DIRECT':
        case 'MESSENGER':
            return 'https://m.me/';
        case 'WEBSITE':
        case 'LEAD_FORM':
            return websiteUrl || 'https://www.example.com';
        case 'APP':
            return websiteUrl || 'https://www.example.com';
        default:
            return websiteUrl || 'https://www.example.com';
    }
}

/**
 * Get the resolved destination config for a given objective + destination combo.
 * Falls back to default destination if the combo is invalid.
 */
export function resolveDestinationConfig(
    objective: FbObjective,
    destination: FbDestination,
): { config: DestinationConfig; destination: FbDestination } {
    const objConfig = FB_OBJECTIVES[objective];
    if (!objConfig) throw new Error(`Unknown objective: ${objective}`);

    let resolved = destination;
    if (!objConfig.destinations.includes(destination)) {
        resolved = objConfig.default_destination;
    }

    const destConfig = objConfig.destination_configs[resolved];
    if (!destConfig) {
        const fallback = objConfig.destination_configs[objConfig.default_destination];
        if (!fallback) throw new Error(`No destination config for objective: ${objective}`);
        return { config: fallback, destination: objConfig.default_destination };
    }

    return { config: destConfig, destination: resolved };
}

/**
 * Determine the bid strategy.
 * COST_CAP is not allowed for CONVERSATIONS optimization goal.
 */
export function resolveBidStrategy(
    destConfig: DestinationConfig,
    bidAmount?: number,
): FbBidStrategy {
    if (!bidAmount) return 'LOWEST_COST_WITHOUT_CAP';
    if (!destConfig.allow_cost_cap) return 'LOWEST_COST_WITH_BID_CAP';
    return 'COST_CAP';
}

/**
 * Human-readable CTA labels for UI display.
 */
export const CTA_LABELS: Record<FbCallToAction, string> = {
    LEARN_MORE: 'Узнать больше',
    SHOP_NOW: 'Купить',
    SIGN_UP: 'Зарегистрироваться',
    DOWNLOAD: 'Скачать',
    GET_QUOTE: 'Получить предложение',
    CONTACT_US: 'Связаться с нами',
    SEND_WHATSAPP_MESSAGE: 'Написать в WhatsApp',
    SEND_MESSAGE: 'Написать сообщение',
    SUBSCRIBE: 'Подписаться',
    APPLY_NOW: 'Подать заявку',
    BOOK_TRAVEL: 'Забронировать',
    ORDER_NOW: 'Заказать',
    GET_OFFER: 'Получить скидку',
    WATCH_MORE: 'Смотреть',
    NO_BUTTON: 'Без кнопки',
};

export const DESTINATION_LABELS: Record<FbDestination, string> = {
    WEBSITE: 'Сайт / Лендинг',
    WHATSAPP: 'WhatsApp',
    INSTAGRAM_DIRECT: 'Instagram Direct',
    MESSENGER: 'Messenger',
    LEAD_FORM: 'Моментальная форма (Lead Form)',
    APP: 'Мобильное приложение',
};

export const OPTIMIZATION_GOAL_LABELS: Record<FbOptimizationGoal, string> = {
    REACH: 'Охват',
    IMPRESSIONS: 'Показы',
    LINK_CLICKS: 'Клики по ссылке',
    LANDING_PAGE_VIEWS: 'Просмотры целевой страницы',
    POST_ENGAGEMENT: 'Вовлечённость в публикацию',
    VIDEO_VIEWS: 'Просмотры видео',
    CONVERSATIONS: 'Диалоги',
    LEAD_GENERATION: 'Генерация лидов',
    QUALITY_LEAD: 'Качественные лиды',
    APP_INSTALLS: 'Установки приложения',
    OFFSITE_CONVERSIONS: 'Конверсии',
    VALUE: 'Ценность конверсии (ROAS)',
};
