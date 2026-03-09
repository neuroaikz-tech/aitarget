import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import toast from 'react-hot-toast';
import {
    Brain,
    Send,
    Settings,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Zap,
    Eye,
    Play,
    X,
    Clock,
    DollarSign,
} from 'lucide-react';

interface Recommendation {
    type: 'warning' | 'success' | 'action' | 'prediction';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action?: {
        type: string;
        campaignId?: string;
        value?: number;
        label: string;
    };
}

interface Analysis {
    summary: string;
    insights: string;
    topPerformer?: string;
    totalSpend: number;
    recommendations: Recommendation[];
    generatedAt: string;
    adAccountName?: string;
}

const typeConfig = {
    warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'Предупреждение' },
    success: { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', label: 'Хорошо' },
    action: { icon: Zap, color: '#4f6ef7', bg: 'rgba(79,110,247,0.1)', border: 'rgba(79,110,247,0.25)', label: 'Действие' },
    prediction: { icon: Eye, color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)', label: 'Прогноз' },
};

const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const priorityLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

export default function AIAnalystPage() {
    useAuthStore();
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [settings, setSettings] = useState({
        telegram_chat_id: '',
        telegram_bot_token: '',
        analysis_interval_hours: 6,
        auto_actions_enabled: false,
        max_budget_increase_pct: 20,
        gemini_api_key: '',
    });
    const [appliedActions, setAppliedActions] = useState<Set<number>>(new Set());
    const [ignoredActions, setIgnoredActions] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'analysis' | 'settings'>('analysis');

    useEffect(() => {
        loadLatestAnalysis();
        loadSettings();
    }, []);

    const loadLatestAnalysis = async () => {
        try {
            const res = await api.get('/api/ai/latest');
            if (res.data.analysis) setAnalysis(res.data.analysis);
        } catch { }
    };

    const loadSettings = async () => {
        try {
            const res = await api.get('/api/ai/settings');
            if (res.data.settings) {
                setSettings(s => ({ ...s, ...res.data.settings }));
            }
        } catch { }
    };

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const res = await api.post('/api/ai/analyze');
            setAnalysis(res.data.analysis);
            setAppliedActions(new Set());
            setIgnoredActions(new Set());
            toast.success('Анализ завершён!');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка анализа');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applyAction = async (rec: Recommendation, index: number) => {
        if (!rec.action) return;
        try {
            await api.post('/api/ai/action', {
                action: rec.action.type,
                campaignId: rec.action.campaignId,
                value: rec.action.value,
            });
            setAppliedActions(prev => new Set([...prev, index]));
            toast.success('Действие применено!');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка');
        }
    };

    const saveSettings = async () => {
        try {
            await api.post('/api/ai/settings', settings);
            toast.success('Настройки сохранены!');
            setActiveTab('analysis');
        } catch {
            toast.error('Ошибка сохранения');
        }
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #7c3aed, #4f6ef7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                        }}>
                            <Brain size={22} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>ИИ-Аналитик</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Gemini AI • Автоматический таргетолог</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setActiveTab(activeTab === 'settings' ? 'analysis' : 'settings')}
                        className="btn btn-secondary"
                    >
                        <Settings size={16} />
                        Настройки
                    </button>
                    <button
                        onClick={runAnalysis}
                        disabled={isAnalyzing}
                        className="btn btn-primary"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f6ef7)', minWidth: '160px' }}
                    >
                        {isAnalyzing ? (
                            <><span className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Анализирую...</>
                        ) : (
                            <><RefreshCw size={16} /> Запустить анализ</>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                {(['analysis', 'settings'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                        background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all var(--transition)',
                    }}>
                        {tab === 'analysis' ? '📊 Анализ' : '⚙️ Настройки'}
                    </button>
                ))}
            </div>

            {activeTab === 'analysis' && (
                <>
                    {!analysis ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '80px 40px', textAlign: 'center',
                        }}>
                            <div style={{
                                width: '96px', height: '96px', borderRadius: '24px',
                                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,110,247,0.15))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
                            }}>
                                <Brain size={44} color="#7c3aed" />
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>Запустите первый анализ</h2>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: '1.6', marginBottom: '28px' }}>
                                ИИ проанализирует ваши кампании, найдёт проблемы и предложит конкретные действия. Анализ занимает ~10 секунд.
                            </p>
                            <button onClick={runAnalysis} disabled={isAnalyzing} className="btn btn-primary" style={{
                                background: 'linear-gradient(135deg, #7c3aed, #4f6ef7)',
                                padding: '14px 32px', fontSize: '15px',
                            }}>
                                {isAnalyzing ? <><span className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Анализирую...</> : <><Brain size={18} /> Запустить анализ</>}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Stats Row */}
                            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                                <div className="stat-card purple">
                                    <div className="stat-icon" style={{ background: 'rgba(124,58,237,0.15)' }}>
                                        <DollarSign size={20} color="#7c3aed" />
                                    </div>
                                    <div className="stat-value">${analysis.totalSpend?.toFixed(2) || '0'}</div>
                                    <div className="stat-label">Траты за период</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-icon" style={{ background: 'rgba(79,110,247,0.15)' }}>
                                        <Zap size={20} color="#4f6ef7" />
                                    </div>
                                    <div className="stat-value">{analysis.recommendations?.length || 0}</div>
                                    <div className="stat-label">Рекомендаций</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-icon" style={{ background: 'var(--yellow-bg)' }}>
                                        <AlertTriangle size={20} color="var(--yellow)" />
                                    </div>
                                    <div className="stat-value">
                                        {analysis.recommendations?.filter(r => r.priority === 'high').length || 0}
                                    </div>
                                    <div className="stat-label">Срочных действий</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-icon" style={{ background: 'var(--green-bg)' }}>
                                        <Clock size={20} color="var(--green)" />
                                    </div>
                                    <div className="stat-value" style={{ fontSize: '14px' }}>
                                        {new Date(analysis.generatedAt || (analysis as any).created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="stat-label">Время анализа</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
                                {/* Recommendations */}
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
                                        🎯 Рекомендации ИИ
                                    </h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {analysis.recommendations?.map((rec, i) => {
                                            const cfg = typeConfig[rec.type] || typeConfig.action;
                                            const Icon = cfg.icon;
                                            const isApplied = appliedActions.has(i);
                                            const isIgnored = ignoredActions.has(i);
                                            const hasAction = rec.action && rec.action.type !== 'none';

                                            return (
                                                <div key={i} style={{
                                                    background: isApplied ? 'rgba(34,197,94,0.05)' : isIgnored ? 'var(--bg-secondary)' : cfg.bg,
                                                    border: `1px solid ${isApplied ? 'rgba(34,197,94,0.3)' : isIgnored ? 'var(--border)' : cfg.border}`,
                                                    borderRadius: 'var(--radius-lg)',
                                                    padding: '16px 20px',
                                                    opacity: isIgnored ? 0.5 : 1,
                                                    transition: 'all 0.3s',
                                                }}>
                                                    <div style={{ display: 'flex', gap: '14px' }}>
                                                        <div style={{
                                                            width: '36px', height: '36px', borderRadius: '10px',
                                                            background: isApplied ? 'rgba(34,197,94,0.2)' : cfg.bg,
                                                            border: `1px solid ${cfg.border}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                        }}>
                                                            <Icon size={18} color={isApplied ? '#22c55e' : cfg.color} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: '700', fontSize: '14px' }}>{rec.title}</span>
                                                                <span style={{
                                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                                                                    background: `${priorityColors[rec.priority]}20`,
                                                                    color: priorityColors[rec.priority], fontWeight: '600',
                                                                }}>
                                                                    {priorityLabels[rec.priority]}
                                                                </span>
                                                            </div>
                                                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 12px' }}>
                                                                {rec.description}
                                                            </p>

                                                            {hasAction && !isApplied && !isIgnored && (
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button
                                                                        onClick={() => applyAction(rec, i)}
                                                                        className="btn btn-sm btn-primary"
                                                                        style={{ fontSize: '12px' }}
                                                                    >
                                                                        <Play size={12} />
                                                                        {rec.action!.label}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setIgnoredActions(prev => new Set([...prev, i]))}
                                                                        className="btn btn-sm btn-secondary"
                                                                        style={{ fontSize: '12px' }}
                                                                    >
                                                                        <X size={12} />
                                                                        Игнорировать
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {isApplied && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontSize: '13px', fontWeight: '600' }}>
                                                                    <CheckCircle size={14} /> Применено
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Summary Panel */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Summary */}
                                    <div className="card">
                                        <div className="card-header" style={{ marginBottom: '12px' }}>
                                            <h3 className="card-title">💬 Резюме</h3>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.7' }}>
                                            {analysis.summary}
                                        </p>
                                        {analysis.adAccountName && (
                                            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                📊 Аккаунт: <strong style={{ color: 'var(--text-primary)' }}>{analysis.adAccountName}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {/* Insights */}
                                    {analysis.insights && (
                                        <div className="card">
                                            <div className="card-header" style={{ marginBottom: '12px' }}>
                                                <h3 className="card-title">🧠 Детальный анализ</h3>
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.7' }}>
                                                {analysis.insights}
                                            </p>
                                        </div>
                                    )}

                                    {/* Top Performer */}
                                    {analysis.topPerformer && (
                                        <div style={{
                                            padding: '16px', borderRadius: 'var(--radius-lg)',
                                            background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.05))',
                                            border: '1px solid rgba(34,197,94,0.25)',
                                        }}>
                                            <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '700', marginBottom: '4px' }}>🏆 ЛУЧШАЯ КАМПАНИЯ</div>
                                            <div style={{ fontWeight: '700', fontSize: '14px' }}>{analysis.topPerformer}</div>
                                        </div>
                                    )}

                                    {/* Telegram status */}
                                    <div className="card" style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <Send size={16} color="#4f6ef7" />
                                            <span style={{ fontWeight: '600', fontSize: '14px' }}>Telegram уведомления</span>
                                        </div>
                                        {settings.telegram_chat_id ? (
                                            <div style={{ fontSize: '13px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckCircle size={14} /> Настроены
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                                    Не настроены — отчёты будут только в приложении
                                                </div>
                                                <button onClick={() => setActiveTab('settings')} className="btn btn-sm btn-secondary" style={{ width: '100%' }}>
                                                    Настроить Telegram
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {activeTab === 'settings' && (
                <div style={{ maxWidth: '660px' }}>
                    <div className="card">
                        <div className="card-header" style={{ marginBottom: '24px' }}>
                            <h2 className="card-title">⚙️ Настройки ИИ-аналитика</h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Gemini API */}
                            <div>
                                <label className="form-label">🧠 Gemini API Key</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="AIza..."
                                    value={settings.gemini_api_key}
                                    onChange={e => setSettings(s => ({ ...s, gemini_api_key: e.target.value }))}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    Получить бесплатно: <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: '#4f6ef7' }}>aistudio.google.com</a>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

                            {/* Telegram */}
                            <div>
                                <label className="form-label">🤖 Telegram Bot Token</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="1234567890:AAF..."
                                    value={settings.telegram_bot_token}
                                    onChange={e => setSettings(s => ({ ...s, telegram_bot_token: e.target.value }))}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    Создайте бота через <a href="https://t.me/BotFather" target="_blank" style={{ color: '#4f6ef7' }}>@BotFather</a>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">💬 Telegram Chat ID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="-1001234567890"
                                    value={settings.telegram_chat_id}
                                    onChange={e => setSettings(s => ({ ...s, telegram_chat_id: e.target.value }))}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    Узнайте через <a href="https://t.me/userinfobot" target="_blank" style={{ color: '#4f6ef7' }}>@userinfobot</a>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

                            {/* Schedule */}
                            <div>
                                <label className="form-label">⏰ Интервал анализа (часы)</label>
                                <select
                                    className="form-input"
                                    value={settings.analysis_interval_hours}
                                    onChange={e => setSettings(s => ({ ...s, analysis_interval_hours: Number(e.target.value) }))}
                                >
                                    <option value={1}>Каждый час</option>
                                    <option value={3}>Каждые 3 часа</option>
                                    <option value={6}>Каждые 6 часов</option>
                                    <option value={12}>Каждые 12 часов</option>
                                    <option value={24}>Раз в день</option>
                                </select>
                            </div>

                            {/* Auto Actions */}
                            <div style={{
                                padding: '16px', borderRadius: 'var(--radius-lg)',
                                background: settings.auto_actions_enabled ? 'rgba(79,110,247,0.08)' : 'var(--bg-secondary)',
                                border: `1px solid ${settings.auto_actions_enabled ? 'rgba(79,110,247,0.3)' : 'var(--border)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>🤖 Автопилот</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            ИИ будет автоматически применять рекомендации с высоким приоритетом
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSettings(s => ({ ...s, auto_actions_enabled: !s.auto_actions_enabled }))}
                                        style={{
                                            padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                            background: settings.auto_actions_enabled ? '#4f6ef7' : 'var(--bg-card)',
                                            color: settings.auto_actions_enabled ? 'white' : 'var(--text-secondary)',
                                            fontWeight: '600', fontSize: '13px', transition: 'all 0.2s',
                                        }}
                                    >
                                        {settings.auto_actions_enabled ? 'Включён' : 'Выключен'}
                                    </button>
                                </div>
                                {settings.auto_actions_enabled && (
                                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(79,110,247,0.2)' }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>
                                            Макс. увеличение бюджета: <strong>{settings.max_budget_increase_pct}%</strong>
                                        </label>
                                        <input
                                            type="range" min={5} max={50} step={5}
                                            value={settings.max_budget_increase_pct}
                                            onChange={e => setSettings(s => ({ ...s, max_budget_increase_pct: Number(e.target.value) }))}
                                            style={{ width: '100%', marginTop: '6px' }}
                                        />
                                    </div>
                                )}
                            </div>

                            <button onClick={saveSettings} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
                                <CheckCircle size={16} />
                                Сохранить настройки
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
