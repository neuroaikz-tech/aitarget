import cron from 'node-cron';
import { getDb } from '../db/database';
import { FacebookAdsService } from './facebookAds';
import { analyzeCampaigns } from './aiAnalyst';
import { sendAnalysisToTelegram } from './telegram';

// Храним результаты анализа в памяти (можно вынести в БД)
const analysisCache: Map<string, any> = new Map();

export function getLatestAnalysis(userId: string): any | null {
    return analysisCache.get(userId) || null;
}

export function storeAnalysis(userId: string, analysis: any): void {
    analysisCache.set(userId, analysis);
}

// Запустить анализ для конкретного пользователя
export async function runAnalysisForUser(userId: string): Promise<any | null> {
    const db = getDb();

    // Берём первый FB аккаунт пользователя
    const fbAccount = db
        .prepare('SELECT * FROM facebook_accounts WHERE user_id = ? LIMIT 1')
        .get(userId) as any;

    if (!fbAccount) return null;

    // Берём настройки AI для пользователя
    const settings = db
        .prepare('SELECT * FROM ai_settings WHERE user_id = ?')
        .get(userId) as any;

    try {
        const service = new FacebookAdsService(fbAccount.access_token);
        const adAccountsRes = await service.getAdAccounts();
        const adAccounts = adAccountsRes?.data || [];

        if (adAccounts.length === 0) return null;

        const adAccount = adAccounts[0];
        const adAccountId = adAccount.id.replace('act_', '');

        // Получаем кампании
        const campaignsRes = await service.getCampaigns(adAccountId);
        const campaigns = campaignsRes?.data || [];

        // Получаем инсайты для каждой активной кампании
        const insights: any[] = [];
        for (const campaign of campaigns.slice(0, 10)) {
            try {
                const insightRes = await service.getCampaignInsights(campaign.id, {
                    since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    until: new Date().toISOString().split('T')[0],
                });
                if (insightRes?.data?.[0]) {
                    insights.push({ ...insightRes.data[0], campaign_id: campaign.id });
                }
            } catch { }
        }

        const analysis = await analyzeCampaigns({
            campaigns,
            insights,
            adAccountName: adAccount.name || adAccount.id,
            period: 'Последние 24 часа',
        });

        storeAnalysis(userId, { ...analysis, adAccountName: adAccount.name });

        // Отправить в Telegram если настроено
        if (settings?.telegram_chat_id) {
            await sendAnalysisToTelegram(settings.telegram_chat_id, analysis, adAccount.name || adAccount.id);
        }

        // Автодействия если включены
        if (settings?.auto_actions_enabled) {
            await applyAutoActions(analysis, adAccountId, fbAccount.access_token, userId);
        }

        return analysis;
    } catch (err) {
        console.error('Scheduler error for user', userId, err);
        return null;
    }
}

// Автоматические действия
async function applyAutoActions(analysis: any, adAccountId: string, token: string, userId: string) {
    const service = new FacebookAdsService(token);
    const db = getDb();
    const settings = db.prepare('SELECT * FROM ai_settings WHERE user_id = ?').get(userId) as any;

    for (const rec of analysis.recommendations) {
        if (!rec.action || rec.action.type === 'none') continue;

        try {
            if (rec.action.type === 'pause_campaign' && rec.action.campaignId && rec.priority === 'high') {
                await service.updateCampaign(rec.action.campaignId, { status: 'PAUSED' });
                console.log(`✅ Auto-paused campaign ${rec.action.campaignId}`);
            }

            if (rec.action.type === 'scale_budget' && rec.action.campaignId && rec.action.value) {
                const maxBudgetIncrease = settings?.max_budget_increase_pct || 20;
                if (rec.action.value <= maxBudgetIncrease) {
                    // Здесь логика масштабирования бюджета
                    console.log(`✅ Auto-scaling budget for ${rec.action.campaignId} by ${rec.action.value}%`);
                }
            }
        } catch (err) {
            console.error('Auto-action error:', err);
        }
    }
}

// Запуск планировщика
export function startScheduler() {
    console.log('🕐 Планировщик ИИ-анализа запущен');

    // Каждые 6 часов анализируем все аккаунты
    cron.schedule('0 */6 * * *', async () => {
        console.log('🤖 Запуск плановго ИИ-анализа кампаний...');
        const db = getDb();
        const users = db.prepare('SELECT DISTINCT user_id FROM facebook_accounts').all() as any[];

        for (const { user_id } of users) {
            await runAnalysisForUser(user_id);
        }
    });
}
