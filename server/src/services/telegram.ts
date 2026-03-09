import TelegramBot from 'node-telegram-bot-api';
import { AIAnalysisResult, AIRecommendation } from './aiAnalyst';

let bot: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot | null {
    if (!process.env.TELEGRAM_BOT_TOKEN) return null;
    if (!bot) {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    }
    return bot;
}

export async function sendAnalysisToTelegram(
    chatId: string,
    analysis: AIAnalysisResult,
    adAccountName: string,
    onAction?: (action: string, campaignId?: string) => void
): Promise<void> {
    const tgBot = getTelegramBot();
    if (!tgBot) {
        console.warn('Telegram bot not configured');
        return;
    }

    // Иконки для типов
    const typeIcons: Record<string, string> = {
        warning: '⚠️',
        success: '✅',
        action: '🎯',
        prediction: '🔮',
    };
    const priorityIcons: Record<string, string> = {
        high: '🔴',
        medium: '🟡',
        low: '🟢',
    };

    // Главное сообщение
    const totalSpendFormatted = analysis.totalSpend.toFixed(2);
    const date = new Date(analysis.generatedAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

    let message = `🤖 *ИИ-Аналитик AITarget*\n`;
    message += `📊 Аккаунт: *${adAccountName}*\n`;
    message += `🕐 ${date}\n\n`;
    message += `💰 Общие траты: *$${totalSpendFormatted}*\n\n`;
    message += `📝 *Резюме:*\n${analysis.summary}\n\n`;

    if (analysis.topPerformer) {
        message += `🏆 Лучшая кампания: *${analysis.topPerformer}*\n\n`;
    }

    if (analysis.insights) {
        message += `🧠 *Детальный анализ:*\n${analysis.insights}\n`;
    }

    await tgBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    // Отправляем каждую рекомендацию отдельно с кнопками
    const actionableRecs = analysis.recommendations.filter(
        (r: AIRecommendation) => r.action && r.action.type !== 'none'
    );

    for (const rec of analysis.recommendations) {
        const hasAction = rec.action && rec.action.type !== 'none';

        let recMsg = `${typeIcons[rec.type] || '📌'} ${priorityIcons[rec.priority] || ''} *${rec.title}*\n`;
        recMsg += `${rec.description}`;

        if (hasAction) {
            const callbackData = JSON.stringify({
                action: rec.action!.type,
                campaignId: rec.action!.campaignId,
                value: rec.action!.value,
            });

            await tgBot.sendMessage(chatId, recMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `✅ ${rec.action!.label}`, callback_data: callbackData },
                            { text: '❌ Игнорировать', callback_data: JSON.stringify({ action: 'ignore' }) },
                        ],
                    ],
                },
            });
        } else {
            await tgBot.sendMessage(chatId, recMsg, { parse_mode: 'Markdown' });
        }
    }

    if (actionableRecs.length === 0) {
        await tgBot.sendMessage(chatId, '✅ Срочных действий не требуется. Кампании работают нормально.');
    }
}

export async function sendAlert(chatId: string, message: string): Promise<void> {
    const tgBot = getTelegramBot();
    if (!tgBot) return;
    await tgBot.sendMessage(chatId, `🚨 *Алерт AITarget*\n\n${message}`, { parse_mode: 'Markdown' });
}
