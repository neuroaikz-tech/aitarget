import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Wand2, Upload, Video, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { adsApi } from '../api';

interface Props {
    accountId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const OBJECTIVES = [
    { value: 'OUTCOME_AWARENESS', label: 'Охват / Узнаваемость' },
    { value: 'OUTCOME_TRAFFIC', label: 'Трафик' },
    { value: 'OUTCOME_ENGAGEMENT', label: 'Вовлечённость' },
    { value: 'OUTCOME_LEADS', label: 'Лиды' },
    { value: 'OUTCOME_APP_PROMOTION', label: 'Продвижение приложения' },
    { value: 'OUTCOME_SALES', label: 'Продажи' },
];



export default function CreateCampaignWizard({ accountId, onClose, onSuccess }: Props) {
    const [step, setStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);

    // Step 1: Base
    const [name, setName] = useState('');
    const [objective, setObjective] = useState('OUTCOME_TRAFFIC');
    const [destination, setDestination] = useState('WEBSITE'); // Новое: место назначения
    const [budget, setBudget] = useState('');
    const [bidAmount, setBidAmount] = useState(''); // Новое: предельная ставка

    // Step 2: Targeting & Placements
    const [ageMin, setAgeMin] = useState('18');
    const [ageMax, setAgeMax] = useState('65');
    const [gender, setGender] = useState('ALL'); // ALL, MALE, FEMALE
    const [location, setLocation] = useState('KZ'); // Новое: локация
    const [placements, setPlacements] = useState({
        fb_feed: true,
        ig_feed: true,
        ig_reels: true,
        fb_stories: true,
    });

    // Step 3: Creative
    const [creativeMode, setCreativeMode] = useState<'upload' | 'ai'>('ai');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Step 4: Copywriting
    const [adText, setAdText] = useState('');

    const handleNext = () => {
        if (step === 1 && (!name || !objective)) {
            toast.error('Заполните обязательные поля');
            return;
        }
        if (step === 3 && creativeMode === 'ai' && !selectedImage) {
            toast.error('Выберите сгенерированный креатив или перейдите в загрузку');
            return;
        }
        setStep(s => Math.min(s + 4, s + 1));
    };

    const handleGenerateAi = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Введите промпт для генерации');
            return;
        }
        setIsGeneratingAi(true);

        try {
            const response = await api.post('/api/ai/generate-creatives', { prompt: aiPrompt });
            if (response.data.images && response.data.images.length > 0) {
                setGeneratedImages(response.data.images);
                toast.success('Gemini успешно сгенерировал 4 варианта!');
            } else {
                toast.error('Изображения не получены, попробуйте изменить промпт.');
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Ошибка при генерации креативов. Попробуйте другой промпт.');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                toast.error('Файл слишком большой. Максимум 50MB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setSelectedImage(reader.result);
                    toast.success('Файл успешно загружен!');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!adText.trim()) {
            toast.error('Напишите рекламный текст');
            return;
        }
        
        setIsCreating(true);
        try {
            await adsApi.createCampaign(accountId, {
                name: name,
                objective: objective,
                status: 'PAUSED', // Start paused by default
                daily_budget: budget ? parseInt(budget) * 100 : undefined,
                bid_amount: bidAmount ? parseFloat(bidAmount) * 100 : undefined,
                special_ad_categories: [],
                destination,
                targeting: { ageMin, ageMax, gender, location },
                placements,
                image: selectedImage,
                adText,
            });
            toast.success('Кампания, группа объявлений и креатив успешно созданы!');
            onSuccess();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка создания');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget && !isCreating) onClose();
        }}>
            <div className="modal" style={{ maxWidth: '640px', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                
                {/* Header with Steps */}
                <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="modal-title" style={{ margin: 0 }}>Создание кампании</h2>
                        <button className="modal-close" onClick={onClose} disabled={isCreating}>
                            <X size={16} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '12px', left: '0', right: '0', height: '2px', background: 'var(--border)', zIndex: 0 }} />
                        <div style={{ position: 'absolute', top: '12px', left: '0', width: `${((step - 1) / 3) * 100}%`, height: '2px', background: 'var(--accent-light)', zIndex: 0, transition: 'width 0.3s ease' }} />
                        
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, width: '60px' }}>
                                <div style={{
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    background: step >= s ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                    color: step >= s ? 'white' : 'var(--text-muted)',
                                    border: `2px solid ${step >= s ? 'var(--accent-light)' : 'var(--border)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 'bold', transition: 'all 0.3s'
                                }}>
                                    {step > s ? <Check size={14} /> : s}
                                </div>
                                <span style={{ fontSize: '11px', color: step >= s ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step >= s ? '600' : '400', textAlign: 'center' }}>
                                    {s === 1 ? 'Основа' : s === 2 ? 'Таргетинг' : s === 3 ? 'Креатив' : 'Текст'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {/* STEP 1: BASE */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
                            <div className="form-group">
                                <label className="form-label">Название кампании *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Например: Продажи лето 2026"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Цель кампании *</label>
                                <select
                                    className="form-select"
                                    value={objective}
                                    onChange={(e) => setObjective(e.target.value)}
                                >
                                    {OBJECTIVES.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Место назначения (куда ведём трафик) *</label>
                                <select
                                    className="form-select"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                >
                                    <option value="WEBSITE">Сайт или лендинг</option>
                                    <option value="WHATSAPP">WhatsApp (Сообщения)</option>
                                    <option value="INSTAGRAM_DIRECT">Instagram Direct (Сообщения)</option>
                                    <option value="LEAD_FORM">Моментальная форма внутри FB/IG</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Дневной бюджет ($)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="Например: 10.00"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    min="1"
                                    step="0.01"
                                />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    Бюджет можно изменить в любое время.
                                </span>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Предельная ставка / Цена за результат ($) (Опционально)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="Оставьте пустым для автоставок"
                                    value={bidAmount}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                    min="0.01"
                                    step="0.01"
                                />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    Укажите, если хотите ограничить максимальную стоимость за 1000 показов или клик по стратегии Cost Cap.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: TARGETING */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Аудитория</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Возраст (от)</label>
                                        <input type="number" className="form-input" value={ageMin} onChange={e => setAgeMin(e.target.value)} min="13" max="65" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Возраст (до)</label>
                                        <input type="number" className="form-input" value={ageMax} onChange={e => setAgeMax(e.target.value)} min="13" max="65" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label">Страна / Регион</label>
                                    <select
                                        className="form-select"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                    >
                                        <option value="KZ">Казахстан</option>
                                        <option value="RU">Россия</option>
                                        <option value="US">США</option>
                                        <option value="GB">Великобритания</option>
                                        <option value="DE">Германия</option>
                                        <option value="TR">Турция</option>
                                        <option value="UZ">Узбекистан</option>
                                        <option value="AE">ОАЭ</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label">Пол</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {['ALL', 'MALE', 'FEMALE'].map(g => (
                                            <button 
                                                key={g} 
                                                type="button"
                                                onClick={() => setGender(g)}
                                                className="btn btn-sm" 
                                                style={{ 
                                                    flex: 1, 
                                                    background: gender === g ? 'rgba(79,110,247,0.1)' : 'var(--bg-secondary)',
                                                    border: `1px solid ${gender === g ? 'var(--accent-light)' : 'var(--border)'}`,
                                                    color: gender === g ? 'var(--accent-light)' : 'var(--text-primary)'
                                                }}
                                            >
                                                {g === 'ALL' ? 'Все' : g === 'MALE' ? 'Мужчины' : 'Женщины'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border)' }} />

                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Плейсменты (Где показывать)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {[
                                        { key: 'fb_feed', label: 'Facebook Лента' },
                                        { key: 'ig_feed', label: 'Instagram Лента' },
                                        { key: 'ig_reels', label: 'Instagram Reels' },
                                        { key: 'fb_stories', label: 'FB/IG Stories' },
                                    ].map(p => (
                                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CREATIVE */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                                <button
                                    className="btn"
                                    style={{
                                        flex: 1, justifyContent: 'center',
                                        background: creativeMode === 'ai' ? 'var(--bg-card)' : 'transparent',
                                        boxShadow: creativeMode === 'ai' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                        color: creativeMode === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)'
                                    }}
                                    onClick={() => setCreativeMode('ai')}
                                >
                                    <Wand2 size={16} color={creativeMode === 'ai' ? '#a855f7' : undefined} /> ИИ Генерация
                                </button>
                                <button
                                    className="btn"
                                    style={{
                                        flex: 1, justifyContent: 'center',
                                        background: creativeMode === 'upload' ? 'var(--bg-card)' : 'transparent',
                                        boxShadow: creativeMode === 'upload' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                        color: creativeMode === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)'
                                    }}
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
                                            <span style={{ fontWeight: '700', fontSize: '14px', color: '#a855f7' }}>Nano Banana Pro</span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
                                            Опишите идеальный рекламный креатив, и наша продвинутая модель сгенерирует высококонверсионные варианты для Facebook и Instagram.
                                        </p>
                                        <textarea
                                            className="form-input"
                                            rows={3}
                                            placeholder="Например: Девушка в стильных солнцезащитных очках на фоне пальм с ярким освещением, кинематографичный стиль, 4k..."
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
                                            {isGeneratingAi ? (
                                                <><span className="loading-spinner" style={{ width: '16px', height: '16px' }} /> Магия в процессе (обычно 5-10 сек)...</>
                                            ) : (
                                                <><Wand2 size={16} /> Сгенерировать креативы</>
                                            )}
                                        </button>
                                    </div>

                                    {generatedImages.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Выберите лучший креатив:</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                {generatedImages.map((img, idx) => (
                                                    <div 
                                                        key={idx}
                                                        onClick={() => setSelectedImage(img)}
                                                        style={{
                                                            position: 'relative',
                                                            aspectRatio: '1',
                                                            borderRadius: '12px',
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            border: selectedImage === img ? '3px solid #a855f7' : '3px solid transparent',
                                                            transition: 'all 0.2s',
                                                            boxShadow: selectedImage === img ? '0 0 0 4px rgba(168,85,247,0.2)' : 'none'
                                                        }}
                                                    >
                                                        <img src={img} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                    <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Загрузите видео или фото</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>JPG, PNG, GIF, MP4 до 50MB</p>
                                    <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                        <Upload size={16} /> Выбрать файл
                                        <input 
                                            type="file" 
                                            accept="image/*,video/mp4,video/mov" 
                                            style={{ display: 'none' }} 
                                            onChange={handleFileUpload} 
                                        />
                                    </label>
                                    
                                    {selectedImage && creativeMode === 'upload' && (
                                        <div style={{ marginTop: '20px', padding: '10px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Check size={14} /> Файл прикреплен
                                            </div>
                                            <img src={selectedImage} alt="Uploaded" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: AD COPY & LAUNCH */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Основной текст (Copywriting)
                                    <button className="btn btn-sm" style={{ padding: '0', background: 'transparent', color: '#a855f7', fontSize: '12px' }} onClick={() => setAdText('🔥 Открываем секрет! Наш новый продукт уже в наличии.\n\n✅ Высокое качество\n✅ Быстрая доставка по всему миру\n\n👉 Кликай по ссылке и заказывай со скидкой 20% пока не закончилось!')}>
                                        <Wand2 size={12} style={{ marginRight: '4px' }} /> Сгенерировать текст
                                    </button>
                                </label>
                                <textarea
                                    className="form-input"
                                    rows={5}
                                    placeholder="Напишите продающий текст вашего объявления..."
                                    value={adText}
                                    onChange={e => setAdText(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <LayoutTemplate size={16} /> Итог настройки
                                </h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <li><strong>Название:</strong> {name}</li>
                                    <li><strong>Бюджет:</strong> ${budget || '0'} / день {bidAmount ? `(Ставка до $${bidAmount})` : '(Автоставка)'}</li>
                                    <li><strong>Аудитория:</strong> {gender === 'ALL' ? 'Все' : gender === 'MALE' ? 'Мужчины' : 'Женщины'}, {ageMin}-{ageMax} лет, {location}</li>
                                    <li><strong>Куда ведем:</strong> {destination === 'WEBSITE' ? 'Сайт' : destination === 'WHATSAPP' ? 'WhatsApp' : destination === 'INSTAGRAM_DIRECT' ? 'Instagram Direct' : 'Куда-то ещё'}</li>
                                    <li><strong>Плейсменты:</strong> {Object.values(placements).filter(Boolean).length} площадок</li>
                                    <li><strong>Креатив:</strong> {creativeMode === 'ai' ? 'Сгенерирован через Gemini' : 'Загружен'}</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with Actions */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                    {step > 1 ? (
                        <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} disabled={isCreating}>
                            <ChevronLeft size={16} /> Назад
                        </button>
                    ) : <div />}

                    {step < 4 ? (
                        <button className="btn btn-primary" onClick={handleNext}>
                            Далее <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={isCreating}>
                            {isCreating ? <span className="loading-spinner" /> : <Check size={16} />} 
                            {isCreating ? 'Публикация...' : 'Запустить кампанию'}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
