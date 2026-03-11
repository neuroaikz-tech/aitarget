import { Bot, InlineKeyboard } from 'grammy';
import { getDb } from '../db/database';
import { FacebookAdsService } from './facebookAds';
import { analyzeCampaigns } from './aiAnalyst';

let bot: Bot | null = null;

export function startBot(token: string) {
    if (bot) return bot;

    bot = new Bot(token);

    // /start — приветствие + кнопка Mini App
    bot.command('start', async (ctx) => {
        const miniAppUrl = process.env.CLIENT_URL || 'https://aitarget.vercel.app';
        const keyboard = new InlineKeyboard()
            .webApp('🚀 Открыть AITarget', miniAppUrl)
            .row()
            .text('📊 Отчёт по кампаниям', 'report')
            .text('⚙️ Настройки', 'settings');

        await ctx.reply(
            `👋 Привет, ${ctx.from?.first_name}!\n\n` +
            `Я *ИИ Таргетолог* — слежу за твоими рекламными кампаниями 24/7.\n\n` +
            `Что умею:\n` +
            `• 📊 Анализирую кампании по запросу\n` +
            `• 🚨 Уведомляю об аномалиях\n` +
            `• 💡 Даю рекомендации\n` +
            `• 🤖 Отвечаю на вопросы о таргете\n\n` +
            `Просто напиши мне что-нибудь или нажми кнопку!`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
        );
    });

    // Кнопка "Отчёт"
    bot.callbackQuery('report', async (ctx) => {
        await ctx.answerCallbackQuery();
        await handleReport(ctx);
    });

    // /report команда
    bot.command('report', async (ctx) => {
        await handleReport(ctx);
    });

    // Любое текстовое сообщение → ИИ отвечает
    bot.on('message:text', async (ctx) => {
        const text = ctx.message.text;
        const telegramId = String(ctx.from.id);

        // Ищем пользователя по telegram_id
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;

        if (!user) {
            const miniAppUrl = process.env.CLIENT_URL || 'https://aitarget.vercel.app';
            const keyboard = new InlineKeyboard().webApp('🔗 Привязать аккаунт', miniAppUrl);
            return ctx.reply(
                '⚠️ Твой Telegram не привязан к аккаунту.\nОткрой Mini App и войди через Facebook.',
                { reply_markup: keyboard }
            );
        }

        // Отправляем "печатает..."
        await ctx.replyWithChatAction('typing');

        // Получаем контекст кампаний
        let campaignContext = '';
        try {
            const fbAccount = db.prepare('SELECT * FROM facebook_accounts WHERE user_id = ?').get(user.id) as any;
            if (fbAccount) {
                const service = new FacebookAdsService(fbAccount.access_token);
                const adAccounts = await service.getAdAccounts();
                if (adAccounts.length > 0) {
                    const adAccountId = adAccounts[0].id.replace('act_', '');
                    const campaigns = await service.getCampaigns(adAccountId);
                    campaignContext = `\n\nДанные кампаний пользователя:\n${campaigns.slice(0, 5).map((c: any) =>
                        `• ${c.name} — статус: ${c.status}`
                    ).join('\n')}`;
                }
            }
        } catch { }

        // Отправляем в Gemini
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return ctx.reply('❌ GEMINI_API_KEY не настроен');
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const prompt = `Ты опытный таргетолог и ИИ-помощник для Facebook Ads.
Отвечай кратко, по делу, на русском языке.
${campaignContext}

Вопрос пользователя: ${text}`;

            const result = await model.generateContent(prompt);
            const response = result.response.text();

            await ctx.reply(response, { parse_mode: 'Markdown' });
        } catch (err: any) {
            await ctx.reply('❌ Ошибка ИИ: ' + (err?.message || 'Попробуй позже'));
        }
    });

    bot.start();
    console.log('🤖 Telegram бот запущен');
    return bot;
}

// Отправить отчёт пользователю
async function handleReport(ctx: any) {
    const telegramId = String(ctx.from.id);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;

    if (!user) {
        return ctx.reply('⚠️ Привяжи аккаунт через Mini App сначала.');
    }

    await ctx.reply('⏳ Собираю данные и анализирую...');

    try {
        const fbAccount = db.prepare('SELECT * FROM facebook_accounts WHERE user_id = ?').get(user.id) as any;
        if (!fbAccount) {
            return ctx.reply('❌ Facebook аккаунт не подключён. Зайди в Mini App → Настройки.');
        }

        const service = new FacebookAdsService(fbAccount.access_token);
        const adAccounts = await service.getAdAccounts();
        if (!adAccounts.length) {
            return ctx.reply('❌ Рекламные аккаунты не найдены.');
        }

        const adAccountId = adAccounts[0].id.replace('act_', '');
        const campaigns = await service.getCampaigns(adAccountId);

        const insights: any[] = [];
        for (const campaign of campaigns.slice(0, 5)) {
            try {
                const insight = await service.getCampaignInsights(campaign.id, {
                    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    until: new Date().toISOString().split('T')[0],
                });
                if (insight) insights.push({ ...insight, campaign_name: campaign.name });
            } catch { }
        }

        const analysis = await analyzeCampaigns({
            campaigns,
            insights,
            adAccountName: adAccounts[0].name || adAccounts[0].id,
            period: 'Последние 7 дней',
        });

        const keyboard = new InlineKeyboard()
            .webApp('📱 Открыть приложение', process.env.CLIENT_URL || 'https://aitarget.vercel.app');

        await ctx.reply(
            `📊 *Отчёт по кампаниям*\n\n${analysis.summary}\n\n` +
            (analysis.recommendations?.slice(0, 3).map((r: any, i: number) =>
                `${i + 1}. ${r.title}\n   _${r.description}_`
            ).join('\n\n') || ''),
            { parse_mode: 'Markdown', reply_markup: keyboard }
        );
    } catch (err: any) {
        await ctx.reply('❌ Ошибка: ' + (err?.message || 'Попробуй позже'));
    }
}

// Отправить уведомление конкретному пользователю
export async function sendTelegramMessage(telegramId: string, message: string) {
    if (!bot) return;
    try {
        await bot.api.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('Ошибка отправки TG сообщения:', err);
    }
}
