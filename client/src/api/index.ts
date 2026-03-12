import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Перехватчик для добавления токена
api.interceptors.request.use((config) => {
    const stored = localStorage.getItem('aitarget-auth');
    if (stored) {
        try {
            const { state } = JSON.parse(stored);
            if (state?.token) {
                config.headers.Authorization = `Bearer ${state.token}`;
            }
        } catch { }
    }
    return config;
});

// Auth
export const authApi = {
    register: (data: { email: string; password: string; name: string }) =>
        api.post('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),

    me: () => api.get('/auth/me'),

    getFacebookAccounts: () => api.get('/auth/facebook-accounts'),

    disconnectFacebook: (fbAccountId: string) =>
        api.delete(`/auth/facebook/${fbAccountId}`),

    connectFacebook: () => {
        window.location.href = `${API_URL}/auth/facebook`;
    },
};

// Ads
export const adsApi = {
    getAdAccounts: () => api.get('/api/ads/accounts'),

    getPages: () => api.get('/api/ads/pages'),

    getObjectives: () => api.get('/api/ads/objectives'),

    getPixels: (adAccountId: string) =>
        api.get(`/api/ads/accounts/${adAccountId}/pixels`),

    getInstagramAccounts: () => api.get('/api/ads/instagram-accounts'),

    getWhatsAppAccounts: () => api.get('/api/ads/whatsapp-accounts'),

    getLeadForms: (pageId: string) =>
        api.get(`/api/ads/pages/${pageId}/lead-forms`),

    getApps: () => api.get('/api/ads/apps'),

    getCampaigns: (adAccountId: string) =>
        api.get(`/api/ads/accounts/${adAccountId}/campaigns`),

    createCampaign: (adAccountId: string, data: any) =>
        api.post(`/api/ads/accounts/${adAccountId}/campaigns`, data),

    updateCampaign: (campaignId: string, data: any) =>
        api.patch(`/api/ads/campaigns/${campaignId}`, data),

    deleteCampaign: (campaignId: string) =>
        api.delete(`/api/ads/campaigns/${campaignId}`),

    getCampaignInsights: (campaignId: string, dateRange?: { since: string; until: string }) =>
        api.get(`/api/ads/campaigns/${campaignId}/insights`, { params: dateRange }),

    getAdSets: (campaignId: string) =>
        api.get(`/api/ads/campaigns/${campaignId}/adsets`),
};

export default api;
