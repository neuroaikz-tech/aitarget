import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─────────────────────────────────────────────────────────────
// Decision Engine — детерминированные правила + guardrails
// Работает независимо от Gemini. Выдаёт конкретные решения
// с обоснованием по реальным цифрам.
// ─────────────────────────────────────────────────────────────

interface CampaignFeatures {
    id: string;
    name: string;
    status: string;
    ageHours: number;
    spend: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    daily_budget: number;
}

interface DecisionResult {
    action: 'pause_campaign' | 'scale_budget' | 'reduce_budget' | 'none';
    confidence: number; // 0..1
    reasons: string[];
    priority: 'high' | 'medium' | 'low';
}

function runDecisionEngine(f: CampaignFeatures, targetCpa?: number): DecisionResult {
    const reasons: string[] = [];

    // GUARDRAIL 1: Недостаточно данных — не трогаем
    if (f.ageHours < 48) {
        return { action: 'none', confidence: 1, reasons: [`Кампания запущена ${f.ageHours.toFixed(0)}ч назад — ждём минимум 48ч для анализа`], priority: 'low' };
    }
    if (f.spend < 5) {
        return { action: 'none', confidence: 1, reasons: [`Потрачено $${f.spend.toFixed(2)} — слишком мало данных (минимум $5)`], priority: 'low' };
    }

    // GUARDRAIL 2: Кампания не активна
    if (f.status !== 'ACTIVE') {
        return { action: 'none', confidence: 1, reasons: [`Кампания не активна (статус: ${f.status})`], priority: 'low' };
    }

    // ПРАВИЛО: Пауза — нет конверсий + высокие траты
    if (f.conversions === 0 && f.spend > (targetCpa ? targetCpa * 2 : 20)) {
        reasons.push(`Потрачено $${f.spend.toFixed(2)}, конверсий: 0`);
        if (targetCpa) reasons.push(`Цель CPA: $${targetCpa}, реальный CPA: ∞`);
        reasons.push(`Рекомендуем остановить и пересмотреть аудиторию/креатив`);
        return { action: 'pause_campaign', confidence: 0.88, reasons, priority: 'high' };
    }

    // ПРАВИЛО: Пауза — очень низкий CTR + большие траты
    if (f.ctr > 0 && f.ctr < 0.3 && f.spend > 15) {
        reasons.push(`CTR = ${f.ctr.toFixed(2)}% (норма > 1%)`);
        reasons.push(`Потрачено $${f.spend.toFixed(2)}`);
        reasons.push(`Объявление не привлекает клики — проблема в креативе или аудитории`);
        return { action: 'pause_campaign', confidence: 0.75, reasons, priority: 'high' };
    }

    // ПРАВИЛО: Снизить бюджет — CPA выше цели в 1.5x
    if (targetCpa && f.conversions > 0) {
        const realCpa = f.spend / f.conversions;
        if (realCpa > targetCpa * 1.5) {
            reasons.push(`CPA = $${realCpa.toFixed(2)}, цель: $${targetCpa}`);
            reasons.push(`CPA превышает цель в ${(realCpa / targetCpa).toFixed(1)}x`);
            return { action: 'reduce_budget', confidence: 0.8, reasons, priority: 'medium' };
        }
    }

    // ПРАВИЛО: Масштабировать — хороший CPA + конверсии
    if (targetCpa && f.conversions >= 3) {
        const realCpa = f.spend / f.conversions;
        if (realCpa < targetCpa * 0.8) {
            reasons.push(`CPA = $${realCpa.toFixed(2)} (цель: $${targetCpa})`);
            reasons.push(`${f.conversions} конверсий, эффективность выше цели на ${((1 - realCpa / targetCpa) * 100).toFixed(0)}%`);
            return { action: 'scale_budget', confidence: 0.82, reasons, priority: 'medium' };
        }
    }

    // ПРАВИЛО: Масштабировать — хороший CTR + достаточно трат (без CPA цели)
    if (!targetCpa && f.ctr > 2 && f.spend > 10 && f.conversions > 0) {
        reasons.push(`CTR = ${f.ctr.toFixed(2)}% (отличный показатель)`);
        reasons.push(`${f.conversions} конверсий за $${f.spend.toFixed(2)}`);
        return { action: 'scale_budget', confidence: 0.65, reasons, priority: 'medium' };
    }

    return { action: 'none', confidence: 1, reasons: [`Показатели в норме. CTR: ${f.ctr.toFixed(2)}%, потрачено: $${f.spend.toFixed(2)}`], priority: 'low' };
}

export function runDecisionEngineForCampaigns(
    campaigns: any[],
    insights: any[],
    targetCpa?: number
): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    for (const c of campaigns) {
        if (c.status !== 'ACTIVE') continue;

        const insight = insights.find(i => i.campaign_id === c.id);
        const spend = parseFloat(insight?.spend || '0');
        const conversions = parseInt(insight?.conversions || insight?.actions?.find((a: any) => a.action_type === 'lead')?.value || '0');
        const ctr = parseFloat(insight?.ctr || '0');
        const cpc = parseFloat(insight?.cpc || '0');
        const cpm = parseFloat(insight?.cpm || '0');
        const dailyBudget = c.daily_budget ? parseInt(c.daily_budget) / 100 : 0;

        // Примерный возраст кампании (нет точных данных — используем созданное время)
        const createdTime = c.created_time ? new Date(c.created_time).getTime() : Date.now() - 72 * 3600 * 1000;
        const ageHours = (Date.now() - createdTime) / 3600000;

        const features: CampaignFeatures = { id: c.id, name: c.name, status: c.status, ageHours, spend, conversions, ctr, cpc, cpm, daily_budget: dailyBudget };
        const decision = runDecisionEngine(features, targetCpa);

        if (decision.action === 'none' && decision.priority === 'low') continue;

        const typeMap: Record<string, AIRecommendation['type']> = {
            pause_campaign: 'action',
            scale_budget: 'action',
            reduce_budget: 'action',
            none: 'warning',
        };

        recommendations.push({
            type: typeMap[decision.action] || 'warning',
            title: decision.action === 'pause_campaign'
                ? `Остановить: ${c.name}`
                : decision.action === 'scale_budget'
                ? `Масштабировать: ${c.name}`
                : decision.action === 'reduce_budget'
                ? `Снизить бюджет: ${c.name}`
                : `Внимание: ${c.name}`,
            description: decision.reasons.join('\n'),
            priority: decision.priority,
            action: decision.action !== 'none' ? {
                type: decision.action,
                campaignId: c.id,
                value: decision.action === 'scale_budget' ? 20 : decision.action === 'reduce_budget' ? 20 : undefined,
                label: decision.action === 'pause_campaign' ? 'Остановить кампанию'
                    : decision.action === 'scale_budget' ? 'Увеличить бюджет на 20%'
                    : 'Снизить бюджет на 20%',
            } : { type: 'none', label: 'Подробнее' },
        });
    }

    // Сортируем: high → medium → low
    return recommendations.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    }).slice(0, 5);
}

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

export async function analyzeCampaigns(input: CampaignAnalysisInput, targetCpa?: number): Promise<AIAnalysisResult> {
    // Сначала запускаем детерминированный Decision Engine
    const engineRecommendations = runDecisionEngineForCampaigns(input.campaigns, input.insights, targetCpa);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

        // Мёрджим: Decision Engine рекомендации идут первыми (они точнее)
        const allRecommendations = [
            ...engineRecommendations,
            ...(parsed.recommendations || []).filter((r: AIRecommendation) =>
                // Не дублируем кампании уже покрытые Decision Engine
                !engineRecommendations.some(e => e.action?.campaignId && r.action?.campaignId === e.action.campaignId)
            ),
        ].slice(0, 5);

        return {
            ...parsed,
            recommendations: allRecommendations,
            totalSpend,
            generatedAt: new Date().toISOString(),
        };
    } catch (err) {
        console.error('AI Analysis error:', err);
        // Gemini недоступен — используем только Decision Engine
        return {
            summary: `Проанализировано ${input.campaigns.length} кампаний. Общие траты: $${totalSpend.toFixed(2)}. Gemini недоступен — показаны решения Decision Engine.`,
            insights: `Decision Engine проверил ${input.campaigns.length} кампаний по ${engineRecommendations.length} правилам.`,
            topPerformer: undefined,
            recommendations: engineRecommendations.length > 0 ? engineRecommendations : [{
                type: 'success' as const,
                title: 'Кампании работают нормально',
                description: `Все ${input.campaigns.filter(c => c.status === 'ACTIVE').length} активных кампаний прошли проверку без нарушений.`,
                priority: 'low' as const,
                action: { type: 'none' as const, label: 'OK' },
            }],
            totalSpend,
            generatedAt: new Date().toISOString(),
        };
    }
}
