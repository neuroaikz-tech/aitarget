import axios from 'axios';
import FormData from 'form-data';

const FB_API_BASE = 'https://graph.facebook.com/v19.0';

export class FacebookAdsService {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private async get(endpoint: string, params: Record<string, any> = {}) {
        const response = await axios.get(`${FB_API_BASE}${endpoint}`, {
            params: {
                access_token: this.accessToken,
                ...params,
            },
        });
        return response.data;
    }

    private async post(endpoint: string, data: Record<string, any> = {}) {
        const formData = new URLSearchParams();
        formData.append('access_token', this.accessToken);
        
        for (const key in data) {
            if (data[key] !== undefined && data[key] !== null) {
                // Если передали объект или массив, нужно превратить его в строку для urlencoded
                if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
                    formData.append(key, JSON.stringify(data[key]));
                } else if (Array.isArray(data[key])) {
                     formData.append(key, JSON.stringify(data[key]));
                } else {
                    formData.append(key, String(data[key]));
                }
            }
        }

        const response = await axios.post(`${FB_API_BASE}${endpoint}`, formData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return response.data;
    }

    private async delete(endpoint: string) {
        const response = await axios.delete(`${FB_API_BASE}${endpoint}`, {
            params: { access_token: this.accessToken },
        });
        return response.data;
    }

    // Получить рекламные аккаунты
    async getAdAccounts() {
        const data = await this.get('/me/adaccounts', {
            fields: 'id,name,currency,timezone_name,account_status,balance,spend_cap',
        });
        return data.data || [];
    }

    // Получить кампании аккаунта
    async getCampaigns(adAccountId: string) {
        const data = await this.get(`/act_${adAccountId}/campaigns`, {
            fields: 'id,name,status,objective,created_time,updated_time,start_time,stop_time,budget_remaining,daily_budget,lifetime_budget,buying_type,special_ad_categories',
            limit: 100,
        });
        return data.data || [];
    }

    // Получить страницы (включая linked WhatsApp и Instagram)
    async getPages() {
        const data = await this.get('/me/accounts', {
            fields: 'id,name,access_token,whatsapp_number,connected_instagram_account{id,name,username}',
            limit: 25,
        });
        return data.data || [];
    }

    // Создать кампанию
    async createCampaign(adAccountId: string, params: {
        name: string;
        objective: string;
        status: string;
        special_ad_categories?: string[];
        daily_budget?: number;
        lifetime_budget?: number;
        start_time?: string;
        stop_time?: string;
    }) {
        const data = await this.post(`/act_${adAccountId}/campaigns`, {
            name: params.name,
            objective: params.objective,
            status: params.status,
            special_ad_categories: JSON.stringify(params.special_ad_categories || []),
            buying_type: 'AUCTION', // REQUIRED
            ...(params.daily_budget && { daily_budget: params.daily_budget }),
            ...(params.lifetime_budget && { lifetime_budget: params.lifetime_budget }),
            ...(params.start_time && { start_time: params.start_time }),
            ...(params.stop_time && { stop_time: params.stop_time }),
        });
        return data;
    }

    // Создать группу объявлений (Ad Set)
    async createAdSet(adAccountId: string, params: any) {
        const data = await this.post(`/act_${adAccountId}/adsets`, params);
        return data;
    }

    // Загрузить изображение (поддержка Base64)
    async uploadImage(adAccountId: string, base64Data: string) {
        // Убираем префикс data:image/jpeg;base64,
        const b64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(b64, 'base64');
        
        const form = new FormData();
        form.append('access_token', this.accessToken);
        form.append('filename', {
            value: buffer,
            options: {
                filename: 'creative.jpg',
                contentType: 'image/jpeg',
            }
        } as any);

        const response = await axios.post(`${FB_API_BASE}/act_${adAccountId}/adimages`, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        
        return response.data; // { images: { 'creative.jpg': { hash: '...', url: '...' } } }
    }

    // Создать креатив (Ad Creative)
    async createAdCreative(adAccountId: string, params: any) {
        const data = await this.post(`/act_${adAccountId}/adcreatives`, params);
        return data;
    }

    // Создать само объявление (Ad)
    async createAd(adAccountId: string, params: any) {
        const data = await this.post(`/act_${adAccountId}/ads`, params);
        return data;
    }

    // Обновить кампанию
    async updateCampaign(campaignId: string, params: {
        name?: string;
        status?: string;
        daily_budget?: number;
        lifetime_budget?: number;
    }) {
        const response = await axios.post(`${FB_API_BASE}/${campaignId}`, null, {
            params: {
                access_token: this.accessToken,
                ...params,
            },
        });
        return response.data;
    }

    // Удалить кампанию
    async deleteCampaign(campaignId: string) {
        return await this.delete(`/${campaignId}`);
    }

    // Получить статистику кампании
    async getCampaignInsights(campaignId: string, dateRange?: { since: string; until: string }) {
        const params: any = {
            fields: 'impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,cpp,actions',
            level: 'campaign',
        };
        if (dateRange) {
            params.time_range = JSON.stringify(dateRange);
        }
        const data = await this.get(`/${campaignId}/insights`, params);
        return data.data?.[0] || null;
    }

    // Получить группы объявлений
    async getAdSets(campaignId: string) {
        const data = await this.get(`/${campaignId}/adsets`, {
            fields: 'id,name,status,daily_budget,lifetime_budget,targeting,start_time,end_time,optimization_goal,billing_event',
            limit: 100,
        });
        return data.data || [];
    }

    // Получить объявления
    async getAds(adSetId: string) {
        const data = await this.get(`/${adSetId}/ads`, {
            fields: 'id,name,status,creative,created_time,updated_time',
            limit: 100,
        });
        return data.data || [];
    }

    // Получить пиксели рекламного аккаунта
    async getPixels(adAccountId: string) {
        const data = await this.get(`/act_${adAccountId}/adspixels`, {
            fields: 'id,name,last_fired_time,is_created_by_business',
            limit: 50,
        });
        return data.data || [];
    }

    // Получить Instagram аккаунты для всех страниц
    // Данные уже есть в getPages() через connected_instagram_account,
    // но делаем fallback запрос через page token если поле пустое
    async getInstagramAccountsForPages(pages: Array<{ id: string; name: string; access_token?: string; connected_instagram_account?: any }>) {
        const results: Array<{ pageId: string; pageName: string; igId: string; igName: string; igUsername: string }> = [];

        await Promise.allSettled(
            pages.map(async (page) => {
                // Сначала пробуем данные из уже загруженной страницы
                let ig = page.connected_instagram_account || null;

                // Если нет — запрашиваем через page access token (более широкий доступ)
                if (!ig?.id && page.access_token) {
                    try {
                        const pageService = new FacebookAdsService(page.access_token);
                        const data = await pageService['get'](`/${page.id}`, {
                            fields: 'connected_instagram_account{id,name,username},instagram_business_account{id,name,username}',
                        });
                        ig = data.connected_instagram_account || data.instagram_business_account || null;
                    } catch { }
                }

                if (ig?.id) {
                    results.push({
                        pageId: page.id,
                        pageName: page.name,
                        igId: ig.id,
                        igName: ig.name || ig.username || ig.id,
                        igUsername: ig.username || '',
                    });
                }
            })
        );
        return results;
    }

    // Получить Lead Forms для Facebook страницы
    async getLeadForms(pageId: string, pageAccessToken?: string) {
        // Lead forms требуют page access token, а не user token
        const token = pageAccessToken || this.accessToken;
        try {
            const response = await axios.get(`${FB_API_BASE}/${pageId}/leadgen_forms`, {
                params: {
                    access_token: token,
                    fields: 'id,name,status,created_time,leads_count,question_page_custom_headline',
                    limit: 50,
                },
            });
            return response.data?.data || [];
        } catch {
            return [];
        }
    }

    // Получить WhatsApp номера из страниц (linked profiles + WABA)
    async getWhatsAppNumbers(pages?: Array<{ id: string; name: string; access_token?: string; whatsapp_number?: string }>) {
        const results: Array<{ id: string; display_phone_number: string; verified_name: string }> = [];

        // Источник 1: whatsapp_number уже в данных страницы (linked WhatsApp)
        const pageList = pages || (await this.get('/me/accounts', {
            fields: 'id,name,access_token,whatsapp_number',
            limit: 25,
        })).data || [];

        for (const page of pageList) {
            if (page.whatsapp_number) {
                results.push({
                    id: `page_${page.id}`,
                    display_phone_number: page.whatsapp_number,
                    verified_name: page.name,
                });
            }
        }

        // Источник 2: запрос через page token — иногда whatsapp_number доступен только так
        await Promise.allSettled(
            pageList
                .filter((p: any) => !p.whatsapp_number && p.access_token)
                .map(async (page: any) => {
                    try {
                        const pageService = new FacebookAdsService(page.access_token);
                        const data = await pageService['get'](`/${page.id}`, {
                            fields: 'whatsapp_number',
                        });
                        if (data.whatsapp_number && !results.find(r => r.display_phone_number === data.whatsapp_number)) {
                            results.push({
                                id: `page_${page.id}`,
                                display_phone_number: data.whatsapp_number,
                                verified_name: page.name,
                            });
                        }
                    } catch { }
                })
        );

        // Источник 3: WABA через Business Manager (для крупных аккаунтов с WABA API)
        try {
            const bizData = await this.get('/me/businesses', { fields: 'id,name', limit: 10 });
            await Promise.allSettled(
                (bizData.data || []).map(async (biz: any) => {
                    try {
                        const wabaData = await this.get(`/${biz.id}/whatsapp_business_accounts`, { fields: 'id,name', limit: 10 });
                        await Promise.allSettled(
                            (wabaData.data || []).map(async (waba: any) => {
                                try {
                                    const phonesData = await this.get(`/${waba.id}/phone_numbers`, {
                                        fields: 'id,display_phone_number,verified_name',
                                        limit: 50,
                                    });
                                    for (const phone of (phonesData.data || [])) {
                                        if (!results.find(r => r.display_phone_number === phone.display_phone_number)) {
                                            results.push({
                                                id: phone.id,
                                                display_phone_number: phone.display_phone_number,
                                                verified_name: phone.verified_name || waba.name,
                                            });
                                        }
                                    }
                                } catch { }
                            })
                        );
                    } catch { }
                })
            );
        } catch { }

        return results;
    }

    // Получить приложения пользователя
    async getApps() {
        try {
            const data = await this.get('/me/applications', {
                fields: 'id,name,icon_url',
                limit: 50,
            });
            return data.data || [];
        } catch {
            return [];
        }
    }
}
