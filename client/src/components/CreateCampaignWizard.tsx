import { useState, useEffect, useMemo } from 'react';
import {
    X, ChevronRight, ChevronLeft, Check, Wand2, Upload,
    Video, LayoutTemplate, AlertCircle, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { adsApi } from '../api';

// ─────────────────────────────────────────────────────────────
// Types (mirrors server/src/config/fbAdsConfig.ts)
// ─────────────────────────────────────────────────────────────

type FbObjective =
    | 'OUTCOME_AWARENESS'
    | 'OUTCOME_TRAFFIC'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_APP_PROMOTION'
    | 'OUTCOME_SALES';

type FbDestination =
    | 'WEBSITE'
    | 'WHATSAPP'
    | 'INSTAGRAM_DIRECT'
    | 'MESSENGER'
    | 'LEAD_FORM'
    | 'APP';

interface DestinationConfig {
    destination_type: string;
    optimization_goals: string[];
    default_optimization_goal: string;
    billing_event: string;
    allow_cost_cap: boolean;
    call_to_actions: string[];
    default_call_to_action: string;
    requires_website_url: boolean;
    requires_whatsapp_phone: boolean;
    requires_instagram_actor: boolean;
}

interface ObjectiveConfig {
    label: string;
    description: string;
    destinations: FbDestination[];
    default_destination: FbDestination;
    promoted_object_type: string;
    destination_configs: Partial<Record<FbDestination, DestinationConfig>>;
}

interface FbPage {
    id: string;
    name: string;
    access_token?: string;
}

interface FbPixel {
    id: string;
    name: string;
    last_fired_time?: string;
}

interface FbInstagramAccount {
    pageId: string;
    pageName: string;
    igId: string;
    igName: string;
    igUsername: string;
}

interface FbLeadForm {
    id: string;
    name: string;
    status?: string;
    leads_count?: number;
}

interface FbApp {
    id: string;
    name: string;
    icon_url?: string;
}

interface FbWhatsAppAccount {
    id: string;
    display_phone_number: string;
    verified_name: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const OBJECTIVE_META: Record<FbObjective, { icon: string; color: string }> = {
    OUTCOME_AWARENESS:      { icon: '📢', color: '#3b82f6' },
    OUTCOME_TRAFFIC:        { icon: '🚀', color: '#8b5cf6' },
    OUTCOME_ENGAGEMENT:     { icon: '💬', color: '#ec4899' },
    OUTCOME_LEADS:          { icon: '🎯', color: '#f59e0b' },
    OUTCOME_APP_PROMOTION:  { icon: '📱', color: '#10b981' },
    OUTCOME_SALES:          { icon: '💰', color: '#ef4444' },
};

const DESTINATION_ICONS: Record<FbDestination, string> = {
    WEBSITE:          '🌐',
    WHATSAPP:         '💚',
    INSTAGRAM_DIRECT: '📸',
    MESSENGER:        '💙',
    LEAD_FORM:        '📋',
    APP:              '📲',
};

const OPTIMIZATION_LABELS: Record<string, string> = {
    REACH:                  'Охват',
    IMPRESSIONS:            'Показы',
    LINK_CLICKS:            'Клики по ссылке',
    LANDING_PAGE_VIEWS:     'Просмотры целевой страницы',
    POST_ENGAGEMENT:        'Вовлечённость в публикацию',
    VIDEO_VIEWS:            'Просмотры видео',
    CONVERSATIONS:          'Диалоги',
    LEAD_GENERATION:        'Генерация лидов',
    QUALITY_LEAD:           'Качественные лиды',
    APP_INSTALLS:           'Установки приложения',
    OFFSITE_CONVERSIONS:    'Конверсии',
    VALUE:                  'Ценность конверсии (ROAS)',
};

const COUNTRIES = [
    { value: 'KZ', label: '🇰🇿 Казахстан' },
    { value: 'RU', label: '🇷🇺 Россия' },
    { value: 'UA', label: '🇺🇦 Украина' },
    { value: 'US', label: '🇺🇸 США' },
    { value: 'GB', label: '🇬🇧 Великобритания' },
    { value: 'DE', label: '🇩🇪 Германия' },
    { value: 'TR', label: '🇹🇷 Турция' },
    { value: 'UZ', label: '🇺🇿 Узбекистан' },
    { value: 'AE', label: '🇦🇪 ОАЭ' },
    { value: 'SA', label: '🇸🇦 Саудовская Аравия' },
    { value: 'PL', label: '🇵🇱 Польша' },
    { value: 'FR', label: '🇫🇷 Франция' },
    { value: 'IT', label: '🇮🇹 Италия' },
    { value: 'ES', label: '🇪🇸 Испания' },
    { value: 'BR', label: '🇧🇷 Бразилия' },
    { value: 'IN', label: '🇮🇳 Индия' },
    { value: 'ID', label: '🇮🇩 Индонезия' },
    { value: 'EG', label: '🇪🇬 Египет' },
    { value: 'NG', label: '🇳🇬 Нигерия' },
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface Props {
    accountId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateCampaignWizard({ accountId, onClose, onSuccess }: Props) {
    const [step, setStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);

    // Objectives config (loaded from server or fallback)
    const [objectivesConfig, setObjectivesConfig] = useState<Record<FbObjective, ObjectiveConfig> | null>(null);

    // FB Pages
    const [pages, setPages] = useState<FbPage[]>([]);
    const [loadingPages, setLoadingPages] = useState(false);

    // FB Assets (loaded from API)
    const [pixels, setPixels] = useState<FbPixel[]>([]);
    const [igAccounts, setIgAccounts] = useState<FbInstagramAccount[]>([]);
    const [waAccounts, setWaAccounts] = useState<FbWhatsAppAccount[]>([]);
    const [leadForms, setLeadForms] = useState<FbLeadForm[]>([]);
    const [apps, setApps] = useState<FbApp[]>([]);

    // ── Step 1: Base settings ─────────────────────────────────
    const [name, setName] = useState('');
    const [objective, setObjective] = useState<FbObjective>('OUTCOME_TRAFFIC');
    const [destination, setDestination] = useState<FbDestination>('WEBSITE');
    const [budget, setBudget] = useState('');
    const [bidAmount, setBidAmount] = useState('');

    // Page & destination assets
    const [pageId, setPageId] = useState('');
    const [instagramActorId, setInstagramActorId] = useState('');
    const [pixelId, setPixelId] = useState('');
    const [appId, setAppId] = useState('');
    const [appStoreUrl, setAppStoreUrl] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [leadFormId, setLeadFormId] = useState('');
    const [optimizationGoal, setOptimizationGoal] = useState('');

    // ── Step 2: Targeting ─────────────────────────────────────
    const [ageMin, setAgeMin] = useState('18');
    const [ageMax, setAgeMax] = useState('65');
    const [gender, setGender] = useState('ALL');
    const [location, setLocation] = useState('KZ');
    const [placements, setPlacements] = useState({
        fb_feed: true,
        ig_feed: true,
        ig_reels: true,
        fb_stories: false,
    });

    // ── Step 3: Creative ──────────────────────────────────────
    const [creativeMode, setCreativeMode] = useState<'upload' | 'ai'>('ai');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // ── Step 4: Copy ──────────────────────────────────────────
    const [adText, setAdText] = useState('');

    // ─────────────────────────────────────────────────────────
    // Derived: current objective & destination config
    // ─────────────────────────────────────────────────────────

    const currentObjConfig = useMemo<ObjectiveConfig | null>(() => {
        if (!objectivesConfig) return null;
        return objectivesConfig[objective] || null;
    }, [objectivesConfig, objective]);

    const currentDestConfig = useMemo<DestinationConfig | null>(() => {
        if (!currentObjConfig) return null;
        return currentObjConfig.destination_configs[destination] || null;
    }, [currentObjConfig, destination]);

    // ─────────────────────────────────────────────────────────
    // Load objectives config + pages + assets on mount
    // ─────────────────────────────────────────────────────────

    useEffect(() => {
        adsApi.getObjectives()
            .then(r => setObjectivesConfig(r.data.objectives))
            .catch(() => {});

        setLoadingPages(true);
        adsApi.getPages()
            .then(r => {
                const loadedPages: FbPage[] = r.data.pages || [];
                setPages(loadedPages);
                if (loadedPages.length === 1) setPageId(loadedPages[0].id);
            })
            .catch(() => {})
            .finally(() => setLoadingPages(false));

        Promise.allSettled([
            adsApi.getInstagramAccounts().then(r => setIgAccounts(r.data.instagram_accounts || [])),
            adsApi.getWhatsAppAccounts().then(r => setWaAccounts(r.data.whatsapp_accounts || [])),
            adsApi.getApps().then(r => setApps(r.data.apps || [])),
        ]);
    }, []);

    // When pageId changes → load pixels and lead forms for that page
    useEffect(() => {
        if (!pageId || !accountId) return;
        adsApi.getPixels(accountId).then(r => setPixels(r.data.pixels || [])).catch(() => {});
        adsApi.getLeadForms(pageId).then(r => setLeadForms(r.data.lead_forms || [])).catch(() => {});
    }, [pageId, accountId]);

    // When objective changes → reset destination to default
    useEffect(() => {
        if (!currentObjConfig) return;
        const validDests = currentObjConfig.destinations;
        if (!validDests.includes(destination)) {
            setDestination(currentObjConfig.default_destination);
        }
    }, [objective, currentObjConfig]);

    // When destination changes → reset optimization goal to default
    useEffect(() => {
        if (currentDestConfig) {
            setOptimizationGoal(currentDestConfig.default_optimization_goal);
        }
    }, [destination, currentDestConfig]);

    // ─────────────────────────────────────────────────────────
    // Validation per step
    // ─────────────────────────────────────────────────────────

    function validateStep1(): string | null {
        if (!name.trim()) return 'Укажите название кампании';
        if (!pageId) return 'Выберите Facebook Страницу';
        if (currentDestConfig?.requires_website_url && !websiteUrl.trim()) {
            return 'Укажите URL сайта (например: https://mysite.com)';
        }
        if (currentDestConfig?.requires_whatsapp_phone && !whatsappPhone.trim()) {
            return 'Укажите номер телефона WhatsApp (с кодом страны, например: +77001234567)';
        }
        if (destination === 'LEAD_FORM' && !leadFormId.trim()) {
            return 'Укажите ID формы лидогенерации (Lead Form ID)';
        }
        if (objective === 'OUTCOME_APP_PROMOTION' && !appId.trim()) {
            return 'Укажите App ID приложения';
        }
        if (!budget || parseFloat(budget) < 1) {
            return 'Минимальный бюджет — $1 в день';
        }
        return null;
    }

    function validateStep3(): string | null {
        if (!selectedImage) return 'Загрузите или сгенерируйте изображение';
        return null;
    }

    const handleNext = () => {
        if (step === 1) {
            const err = validateStep1();
            if (err) { toast.error(err); return; }
        }
        if (step === 3) {
            const err = validateStep3();
            if (err) { toast.error(err); return; }
        }
        setStep(s => s + 1);
    };

    // ─────────────────────────────────────────────────────────
    // AI generation
    // ─────────────────────────────────────────────────────────

    const handleGenerateAi = async () => {
        if (!aiPrompt.trim()) { toast.error('Введите промпт для генерации'); return; }
        setIsGeneratingAi(true);
        try {
            const response = await api.post('/api/ai/generate-creatives', { prompt: aiPrompt });
            if (response.data.images?.length > 0) {
                setGeneratedImages(response.data.images);
                toast.success('4 варианта креатива готовы!');
            } else {
                toast.error('Изображения не получены, попробуйте изменить промпт');
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Ошибка генерации. Попробуйте другой промпт.');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { toast.error('Файл слишком большой. Максимум 50MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setSelectedImage(reader.result);
                toast.success('Файл загружен');
            }
        };
        reader.readAsDataURL(file);
    };

    // ─────────────────────────────────────────────────────────
    // Submit
    // ─────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!adText.trim()) { toast.error('Напишите рекламный текст объявления'); return; }
        setIsCreating(true);
        try {
            const payload = {
                name: name.trim(),
                objective,
                destination,
                daily_budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
                bid_amount: bidAmount ? Math.round(parseFloat(bidAmount) * 100) : undefined,
                // Assets
                pageId,
                instagramActorId: instagramActorId || undefined,
                pixelId: pixelId || undefined,
                appId: appId || undefined,
                appStoreUrl: appStoreUrl || undefined,
                websiteUrl: websiteUrl || undefined,
                whatsappPhone: whatsappPhone || undefined,
                leadFormId: leadFormId || undefined,
                // Advanced
                optimization_goal_override: optimizationGoal || undefined,
                // Targeting
                targeting: { ageMin, ageMax, gender, location },
                placements,
                // Creative
                image: selectedImage,
                adText: adText.trim(),
                special_ad_categories: [],
            };

            const result = await adsApi.createCampaign(accountId, payload);

            if (result.data.warning) {
                toast.success(`Кампания создана (${result.data.warning})`);
            } else {
                toast.success('Кампания, группа объявлений и креатив успешно созданы!');
            }
            onSuccess();
        } catch (err: any) {
            const errMsg = err?.response?.data?.error || 'Ошибка создания';
            const fbCode = err?.response?.data?.fb_error_code;
            toast.error(fbCode ? `${errMsg} (код FB: ${fbCode})` : errMsg, { duration: 8000 });
        } finally {
            setIsCreating(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // Helpers for destination labels
    // ─────────────────────────────────────────────────────────

    function getDestLabel(d: FbDestination): string {
        const labels: Record<FbDestination, string> = {
            WEBSITE: 'Сайт / Лендинг',
            WHATSAPP: 'WhatsApp',
            INSTAGRAM_DIRECT: 'Instagram Direct',
            MESSENGER: 'Messenger',
            LEAD_FORM: 'Моментальная форма',
            APP: 'Мобильное приложение',
        };
        return `${DESTINATION_ICONS[d]} ${labels[d]}`;
    }

    const availableDestinations = currentObjConfig?.destinations ?? ['WEBSITE'];

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────

    return (
        <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget && !isCreating) onClose(); }}
        >
            <div className="modal" style={{ maxWidth: '680px', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

                {/* ── Header ── */}
                <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="modal-title" style={{ margin: 0 }}>Создание кампании</h2>
                        <button className="modal-close" onClick={onClose} disabled={isCreating}><X size={16} /></button>
                    </div>
                    {/* Progress */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '12px', left: '0', right: '0', height: '2px', background: 'var(--border)', zIndex: 0 }} />
                        <div style={{ position: 'absolute', top: '12px', left: '0', width: `${((step - 1) / 3) * 100}%`, height: '2px', background: 'var(--accent-light)', zIndex: 0, transition: 'width 0.3s ease' }} />
                        {(['Основа', 'Таргетинг', 'Креатив', 'Текст'] as const).map((label, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, width: '70px' }}>
                                <div style={{
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    background: step >= i + 1 ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                    color: step >= i + 1 ? 'white' : 'var(--text-muted)',
                                    border: `2px solid ${step >= i + 1 ? 'var(--accent-light)' : 'var(--border)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 'bold', transition: 'all 0.3s',
                                }}>
                                    {step > i + 1 ? <Check size={14} /> : i + 1}
                                </div>
                                <span style={{ fontSize: '11px', color: step >= i + 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step >= i + 1 ? '600' : '400', textAlign: 'center' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                    {/* ══ STEP 1: BASE ══════════════════════════════ */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* Campaign Name */}
                            <div className="form-group">
                                <label className="form-label">Название кампании *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Например: Летние продажи 2026"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Objective */}
                            <div className="form-group">
                                <label className="form-label">Цель кампании *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    {(Object.keys(OBJECTIVE_META) as FbObjective[]).map((obj) => {
                                        const meta = OBJECTIVE_META[obj];
                                        const cfg = objectivesConfig?.[obj];
                                        const isSelected = objective === obj;
                                        return (
                                            <button
                                                key={obj}
                                                type="button"
                                                onClick={() => setObjective(obj)}
                                                style={{
                                                    padding: '12px 10px',
                                                    borderRadius: '10px',
                                                    border: `2px solid ${isSelected ? meta.color : 'var(--border)'}`,
                                                    background: isSelected ? `${meta.color}15` : 'var(--bg-secondary)',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{meta.icon}</div>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? meta.color : 'var(--text-primary)', lineHeight: '1.3' }}>
                                                    {cfg?.label ?? obj}
                                                </div>
                                                {cfg?.description && (
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                                                        {cfg.description}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Destination */}
                            <div className="form-group">
                                <label className="form-label">Место назначения *</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {availableDestinations.map((dest) => (
                                        <button
                                            key={dest}
                                            type="button"
                                            onClick={() => setDestination(dest)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                border: `2px solid ${destination === dest ? 'var(--accent-light)' : 'var(--border)'}`,
                                                background: destination === dest ? 'rgba(79,110,247,0.1)' : 'var(--bg-secondary)',
                                                color: destination === dest ? 'var(--accent-light)' : 'var(--text-primary)',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {getDestLabel(dest)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Destination-specific fields ── */}

                            {/* Website URL */}
                            {currentDestConfig?.requires_website_url && (
                                <div className="form-group">
                                    <label className="form-label">URL сайта / лендинга *</label>
                                    <input
                                        type="url"
                                        className="form-input"
                                        placeholder="https://yoursite.com/landing"
                                        value={websiteUrl}
                                        onChange={(e) => setWebsiteUrl(e.target.value)}
                                    />
                                </div>
                            )}

                            {/* WhatsApp */}
                            {currentDestConfig?.requires_whatsapp_phone && (
                                <div className="form-group">
                                    <label className="form-label">WhatsApp номер *</label>
                                    {waAccounts.length > 0 ? (
                                        <select
                                            className="form-select"
                                            value={whatsappPhone}
                                            onChange={e => setWhatsappPhone(e.target.value)}
                                        >
                                            <option value="">— Выберите номер —</option>
                                            {waAccounts.map(wa => (
                                                <option key={wa.id} value={wa.display_phone_number}>
                                                    {wa.display_phone_number} — {wa.verified_name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="tel"
                                            className="form-input"
                                            placeholder="+77001234567"
                                            value={whatsappPhone}
                                            onChange={(e) => setWhatsappPhone(e.target.value)}
                                        />
                                    )}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        {waAccounts.length > 0
                                            ? 'Пользователь попадёт прямо в ваш WhatsApp чат'
                                            : 'Подключите WhatsApp Business в настройках Facebook страницы — тогда номер подтянется автоматически'}
                                    </span>
                                </div>
                            )}

                            {/* Lead Form */}
                            {destination === 'LEAD_FORM' && (
                                <div className="form-group">
                                    <label className="form-label">Форма лидогенерации *</label>
                                    {leadForms.length > 0 ? (
                                        <select className="form-select" value={leadFormId} onChange={e => setLeadFormId(e.target.value)}>
                                            <option value="">— Выберите форму —</option>
                                            {leadForms.map(f => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name}{f.leads_count != null ? ` (${f.leads_count} лидов)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="ID формы из Facebook Ads Manager"
                                            value={leadFormId}
                                            onChange={(e) => setLeadFormId(e.target.value)}
                                        />
                                    )}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        {leadForms.length === 0 && !pageId
                                            ? 'Сначала выберите страницу — тогда формы подтянутся автоматически'
                                            : leadForms.length === 0
                                            ? 'Форм не найдено. Создайте форму в Ads Manager → Библиотека форм'
                                            : 'Формы загружены из вашей Facebook страницы'}
                                    </span>
                                </div>
                            )}

                            {/* App fields */}
                            {objective === 'OUTCOME_APP_PROMOTION' && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Приложение *</label>
                                        {apps.length > 0 ? (
                                            <select className="form-select" value={appId} onChange={e => setAppId(e.target.value)}>
                                                <option value="">— Выберите приложение —</option>
                                                {apps.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name} (ID: {a.id})</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input type="text" className="form-input" placeholder="Facebook App ID" value={appId} onChange={(e) => setAppId(e.target.value)} />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ссылка на приложение в сторе</label>
                                        <input type="url" className="form-input" placeholder="https://apps.apple.com/... или https://play.google.com/..." value={appStoreUrl} onChange={(e) => setAppStoreUrl(e.target.value)} />
                                    </div>
                                </>
                            )}

                            {/* Pixel for Sales */}
                            {objective === 'OUTCOME_SALES' && destination === 'WEBSITE' && (
                                <div className="form-group">
                                    <label className="form-label">Пиксель Facebook <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(рекомендуется)</span></label>
                                    {pixels.length > 0 ? (
                                        <select className="form-select" value={pixelId} onChange={e => setPixelId(e.target.value)}>
                                            <option value="">— Без пикселя (клики) —</option>
                                            {pixels.map(px => (
                                                <option key={px.id} value={px.id}>
                                                    {px.name} (ID: {px.id})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Facebook Pixel ID"
                                            value={pixelId}
                                            onChange={(e) => setPixelId(e.target.value)}
                                        />
                                    )}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        {pixels.length > 0
                                            ? 'С пикселем Facebook оптимизирует рекламу под конверсии, а не клики'
                                            : 'Без пикселя оптимизация будет по кликам. Установите пиксель на сайт для лучших результатов'}
                                    </span>
                                </div>
                            )}

                            {/* Divider */}
                            <div style={{ height: '1px', background: 'var(--border)' }} />

                            {/* Facebook Page */}
                            <div className="form-group">
                                <label className="form-label">Facebook Страница * {loadingPages && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(загрузка...)</span>}</label>
                                {pages.length > 0 ? (
                                    <select className="form-select" value={pageId} onChange={(e) => setPageId(e.target.value)}>
                                        <option value="">— Выберите страницу —</option>
                                        {pages.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Введите Page ID вручную"
                                        value={pageId}
                                        onChange={(e) => setPageId(e.target.value)}
                                    />
                                )}
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    От имени этой страницы будет показываться реклама
                                </span>
                            </div>

                            {/* Instagram Actor */}
                            {(destination === 'INSTAGRAM_DIRECT' || placements.ig_feed || placements.ig_reels) && (
                                <div className="form-group">
                                    <label className="form-label">Instagram аккаунт <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(рекомендуется)</span></label>
                                    {igAccounts.length > 0 ? (
                                        <select className="form-select" value={instagramActorId} onChange={e => setInstagramActorId(e.target.value)}>
                                            <option value="">— Без Instagram аккаунта —</option>
                                            {igAccounts.map(ig => (
                                                <option key={ig.igId} value={ig.igId}>
                                                    {ig.igUsername ? `@${ig.igUsername}` : ig.igName} — страница «{ig.pageName}»
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="ID Instagram Business аккаунта"
                                            value={instagramActorId}
                                            onChange={(e) => setInstagramActorId(e.target.value)}
                                        />
                                    )}
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        {igAccounts.length > 0
                                            ? 'Реклама в Instagram будет показана от имени выбранного профиля'
                                            : 'Привяжите Instagram к Facebook странице — тогда он появится здесь автоматически'}
                                    </span>
                                </div>
                            )}

                            {/* Divider */}
                            <div style={{ height: '1px', background: 'var(--border)' }} />

                            {/* Budget */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Дневной бюджет ($) *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="10.00"
                                        value={budget}
                                        onChange={(e) => setBudget(e.target.value)}
                                        min="1"
                                        step="0.01"
                                    />
                                </div>
                                {currentDestConfig?.allow_cost_cap !== false && (
                                    <div className="form-group">
                                        <label className="form-label">Предельная ставка ($) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(опционально)</span></label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Автоставка"
                                            value={bidAmount}
                                            onChange={(e) => setBidAmount(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Optimization Goal */}
                            {currentDestConfig && currentDestConfig.optimization_goals.length > 1 && (
                                <div className="form-group">
                                    <label className="form-label">Цель оптимизации</label>
                                    <select
                                        className="form-select"
                                        value={optimizationGoal || currentDestConfig.default_optimization_goal}
                                        onChange={(e) => setOptimizationGoal(e.target.value)}
                                    >
                                        {currentDestConfig.optimization_goals.map((g) => (
                                            <option key={g} value={g}>
                                                {OPTIMIZATION_LABELS[g] ?? g}
                                                {g === currentDestConfig.default_optimization_goal ? ' (рекомендуется)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                        Facebook будет показывать рекламу тем, кто скорее всего совершит это действие
                                    </span>
                                </div>
                            )}

                            {/* No cost_cap warning */}
                            {currentDestConfig?.allow_cost_cap === false && bidAmount && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
                                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                                    <span>Для этого места назначения предельная ставка не поддерживается — ставка будет использована как «максимальная ставка» (Bid Cap).</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ STEP 2: TARGETING ════════════════════════ */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Аудитория</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Возраст от</label>
                                        <input type="number" className="form-input" value={ageMin} onChange={e => setAgeMin(e.target.value)} min="13" max="65" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Возраст до</label>
                                        <input type="number" className="form-input" value={ageMax} onChange={e => setAgeMax(e.target.value)} min="13" max="65" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label">Страна</label>
                                    <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                                        {COUNTRIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label">Пол</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {(['ALL', 'MALE', 'FEMALE'] as const).map(g => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setGender(g)}
                                                style={{
                                                    flex: 1, padding: '8px',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${gender === g ? 'var(--accent-light)' : 'var(--border)'}`,
                                                    background: gender === g ? 'rgba(79,110,247,0.1)' : 'var(--bg-secondary)',
                                                    color: gender === g ? 'var(--accent-light)' : 'var(--text-primary)',
                                                    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                                                }}
                                            >
                                                {g === 'ALL' ? 'Все' : g === 'MALE' ? '👨 Мужчины' : '👩 Женщины'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border)' }} />

                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Плейсменты</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>Где показывать рекламу</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {([
                                        { key: 'fb_feed', label: '📘 Facebook Лента' },
                                        { key: 'ig_feed', label: '📸 Instagram Лента' },
                                        { key: 'ig_reels', label: '🎬 Instagram Reels' },
                                        { key: 'fb_stories', label: '⏳ Stories (FB/IG)' },
                                    ] as const).map(p => (
                                        <label
                                            key={p.key}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                cursor: 'pointer', padding: '12px',
                                                background: (placements as any)[p.key] ? 'rgba(79,110,247,0.07)' : 'var(--bg-secondary)',
                                                borderRadius: '8px',
                                                border: `1px solid ${(placements as any)[p.key] ? 'var(--accent-light)' : 'var(--border)'}`,
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(placements as any)[p.key]}
                                                onChange={e => setPlacements({ ...placements, [p.key]: e.target.checked })}
                                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-light)' }}
                                            />
                                            <span style={{ fontSize: '14px', fontWeight: '500' }}>{p.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px', padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                    <span>Если ни один плейсмент не выбран — Facebook использует автоматические плейсменты (рекомендуется)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP 3: CREATIVE ═════════════════════════ */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                                <button
                                    className="btn"
                                    style={{ flex: 1, justifyContent: 'center', background: creativeMode === 'ai' ? 'var(--bg-card)' : 'transparent', boxShadow: creativeMode === 'ai' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', color: creativeMode === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                    onClick={() => setCreativeMode('ai')}
                                >
                                    <Wand2 size={16} color={creativeMode === 'ai' ? '#a855f7' : undefined} /> ИИ Генерация
                                </button>
                                <button
                                    className="btn"
                                    style={{ flex: 1, justifyContent: 'center', background: creativeMode === 'upload' ? 'var(--bg-card)' : 'transparent', boxShadow: creativeMode === 'upload' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', color: creativeMode === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                    onClick={() => setCreativeMode('upload')}
                                >
                                    <Upload size={16} /> Загрузить
                                </button>
                            </div>

                            {creativeMode === 'ai' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)', padding: '16px', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Wand2 size={18} color="#a855f7" />
                                            <span style={{ fontWeight: '700', fontSize: '14px', color: '#a855f7' }}>AI Генерация креативов</span>
                                        </div>
                                        <textarea
                                            className="form-input"
                                            rows={3}
                                            placeholder="Опишите идеальный рекламный креатив: продукт, стиль, настроение, цвета..."
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            style={{ resize: 'none' }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', marginTop: '12px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', border: 'none' }}
                                            onClick={handleGenerateAi}
                                            disabled={isGeneratingAi || !aiPrompt.trim()}
                                        >
                                            {isGeneratingAi
                                                ? <><span className="loading-spinner" style={{ width: '16px', height: '16px' }} /> Генерация (5-15 сек)...</>
                                                : <><Wand2 size={16} /> Сгенерировать 4 варианта</>}
                                        </button>
                                    </div>
                                    {generatedImages.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Выберите лучший вариант:</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                {generatedImages.map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setSelectedImage(img)}
                                                        style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: selectedImage === img ? '3px solid #a855f7' : '3px solid transparent', transition: 'all 0.2s', boxShadow: selectedImage === img ? '0 0 0 4px rgba(168,85,247,0.2)' : 'none' }}
                                                    >
                                                        <img src={img} alt={`Вариант ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        {selectedImage === img && (
                                                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#a855f7', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                                <Check size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {creativeMode === 'upload' && (
                                <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                                    <div style={{ background: 'var(--bg-card)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-sm)' }}>
                                        <Video size={20} color="var(--text-secondary)" />
                                    </div>
                                    <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Загрузите фото или видео</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>JPG, PNG, GIF, MP4 · до 50MB</p>
                                    <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                        <Upload size={16} /> Выбрать файл
                                        <input type="file" accept="image/*,video/mp4,video/mov" style={{ display: 'none' }} onChange={handleFileUpload} />
                                    </label>
                                    {selectedImage && creativeMode === 'upload' && (
                                        <div style={{ marginTop: '20px', padding: '10px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Check size={14} /> Файл прикреплён
                                            </div>
                                            <img src={selectedImage} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ STEP 4: COPY & REVIEW ════════════════════ */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    Текст объявления *
                                    <button
                                        className="btn btn-sm"
                                        style={{ padding: '2px 8px', background: 'transparent', color: '#a855f7', fontSize: '12px' }}
                                        onClick={() => setAdText('🔥 Специальное предложение! Успейте воспользоваться скидкой.\n\n✅ Высокое качество\n✅ Быстрая доставка\n\n👉 Нажмите кнопку ниже, чтобы узнать подробности!')}
                                    >
                                        <Wand2 size={12} /> Шаблон
                                    </button>
                                </label>
                                <textarea
                                    className="form-input"
                                    rows={5}
                                    placeholder="Напишите цепляющий текст для вашего объявления..."
                                    value={adText}
                                    onChange={e => setAdText(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {/* Review summary */}
                            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <LayoutTemplate size={16} /> Итог настройки
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                    {[
                                        ['Название', name],
                                        ['Цель', objectivesConfig?.[objective]?.label ?? objective],
                                        ['Назначение', getDestLabel(destination)],
                                        ['Оптимизация', OPTIMIZATION_LABELS[optimizationGoal || currentDestConfig?.default_optimization_goal || ''] ?? optimizationGoal],
                                        ['Страница', pages.find(p => p.id === pageId)?.name ?? pageId],
                                        websiteUrl && ['Сайт', websiteUrl],
                                        whatsappPhone && ['WhatsApp', whatsappPhone],
                                        pixelId && ['Pixel ID', pixelId],
                                        appId && ['App ID', appId],
                                        ['Аудитория', `${gender === 'ALL' ? 'Все' : gender === 'MALE' ? 'Мужчины' : 'Женщины'}, ${ageMin}–${ageMax} лет, ${location}`],
                                        ['Бюджет', `$${budget}/день ${bidAmount ? `(ставка до $${bidAmount})` : '(автоставка)'}`],
                                        ['Плейсменты', Object.entries(placements).filter(([, v]) => v).map(([k]) => k).join(', ') || 'автоматически'],
                                        ['Креатив', creativeMode === 'ai' ? 'ИИ генерация' : 'Загружен'],
                                    ].filter(Boolean).map(([label, value], i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px' }}>
                                            <span style={{ color: 'var(--text-muted)', minWidth: '120px', flexShrink: 0 }}>{label}:</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500', wordBreak: 'break-all' }}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                <span>Кампания создаётся в статусе PAUSED — запустите вручную в Facebook Ads Manager или через кнопку активации в списке кампаний.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                    {step > 1
                        ? <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} disabled={isCreating}><ChevronLeft size={16} /> Назад</button>
                        : <div />}

                    {step < 4
                        ? <button className="btn btn-primary" onClick={handleNext}>Далее <ChevronRight size={16} /></button>
                        : (
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={isCreating}>
                                {isCreating ? <><span className="loading-spinner" /> Создание...</> : <><Check size={16} /> Создать кампанию</>}
                            </button>
                        )}
                </div>
            </div>
        </div>
    );
}
