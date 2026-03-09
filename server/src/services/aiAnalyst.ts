import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface CampaignAnalysisInput {
    campaigns: any[];
    insights: any[];
    adAccountName: string;
    period: string;
}

export interface AIRecommendation {
    type: 'warning' | 'success' | 'action' | 'prediction';
    title: string;
    description: string;
    action?: {
        type: 'pause_campaign' | 'scale_budget' | 'reduce_budget' | 'none';
        campaignId?: string;
        value?: number;
        label: string;
    };
    priority: 'high' | 'medium' | 'low';
}

export interface AIAnalysisResult {
    summary: string;
    recommendations: AIRecommendation[];
    topPerformer?: string;
    totalSpend: number;
    insights: string;
    generatedAt: string;
}

export async function analyzeCampaigns(input: CampaignAnalysisInput): Promise<AIAnalysisResult> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const campaignsData = input.campaigns.map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseInt(c.daily_budget) / 100 : null,
        insights: input.insights.find((i: any) => i.campaign_id === c.id) || null,
    }));

    const totalSpend = input.insights.reduce((sum: number, i: any) => sum + parseFloat(i.spend || '0'), 0);

    const prompt = `
Ты — опытный таргетолог и аналитик Facebook Ads с 10-летним опытом.
Проанализируй данные рекламных кампаний и дай конкретные рекомендации.

Рекламный аккаунт: ${input.adAccountName}
Период анализа: ${input.period}
Общие траты: $${totalSpend.toFixed(2)}

Данные кампаний (JSON):
${JSON.stringify(campaignsData, null, 2)}

Дай ответ СТРОГО в формате JSON (без markdown, только чистый JSON):
{
  "summary": "краткое резюме в 2-3 предложениях на русском",
  "insights": "детальный анализ на русском (3-5 предложений)",
  "topPerformer": "название лучшей кампании или null",
  "recommendations": [
    {
      "type": "warning|success|action|prediction",
      "title": "краткий заголовок",
      "description": "детальное описание что не так и почему",
      "priority": "high|medium|low",
      "action": {
        "type": "pause_campaign|scale_budget|reduce_budget|none",
        "campaignId": "id кампании или null",
        "value": число_или_null,
        "label": "текст кнопки действия"
      }
    }
  ]
}

Правила:
- Выявляй аномалии в CTR, CPC, CPM
- Если кампания не активна или нет данных — отметь это
- Давай конкретные числа в рекомендациях
- Максимум 5 рекомендаций, самые важные первыми
- Если данных мало — честно скажи об этом в summary
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Убираем markdown если есть
        const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonText);

        return {
            ...parsed,
            totalSpend,
            generatedAt: new Date().toISOString(),
        };
    } catch (err) {
        console.error('AI Analysis error:', err);
        // Возвращаем базовый анализ если Gemini недоступен
        return {
            summary: `Проанализировано ${input.campaigns.length} кампаний. Общие траты: $${totalSpend.toFixed(2)}.`,
            insights: 'Автоматический анализ временно недоступен. Проверьте настройку GEMINI_API_KEY.',
            topPerformer: undefined,
            recommendations: input.campaigns
                .filter((c: any) => c.status === 'ACTIVE')
                .slice(0, 3)
                .map((c: any) => ({
                    type: 'action' as const,
                    title: `Кампания активна: ${c.name}`,
                    description: 'Мониторьте показатели этой кампании',
                    priority: 'medium' as const,
                    action: { type: 'none' as const, label: 'Просмотреть' },
                })),
            totalSpend,
            generatedAt: new Date().toISOString(),
        };
    }
}
