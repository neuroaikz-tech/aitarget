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

    // Получить страницы
    async getPages() {
        const data = await this.get('/me/accounts', {
            fields: 'id,name,access_token',
            limit: 10,
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
}
