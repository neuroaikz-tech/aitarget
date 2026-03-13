import { useEffect, useState } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
    Facebook,
    User,
    Shield,
    Trash2,
    CheckCircle,
    AlertCircle,
    ExternalLink,
    X,
    Key,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface FbAccount {
    id: string;
    fb_user_id: string;
    fb_name: string;
    fb_email?: string;
    created_at: string;
    has_system_token?: number;
}

export default function SettingsPage() {
    const { user } = useAuthStore();
    const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
    const [systemTokenInputs, setSystemTokenInputs] = useState<Record<string, string>>({});
    const [systemTokenExpanded, setSystemTokenExpanded] = useState<Record<string, boolean>>({});
    const [savingToken, setSavingToken] = useState<string | null>(null);
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const fbSuccess = searchParams.get('fb_success');
        const fbError = searchParams.get('fb_error');

        if (fbSuccess === 'true') {
            toast.success('Facebook аккаунт успешно подключён! 🎉');
        } else if (fbError === 'true') {
            toast.error('Ошибка подключения Facebook. Попробуйте снова.');
        }

        loadFbAccounts();
    }, []);

    const loadFbAccounts = async () => {
        try {
            const res = await authApi.getFacebookAccounts();
            setFbAccounts(res.data.accounts || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectFacebook = () => {
        const stored = localStorage.getItem('aitarget-auth');
        let token = '';
        if (stored) {
            try {
                const { state } = JSON.parse(stored);
                token = state?.token || '';
            } catch { }
        }
        // Открываем FB OAuth с токеном в заголовке через cookie/header не работает в redirect
        // Сохраним токен и затем перейдём
        window.location.href = `${API_URL}/auth/facebook?token=${token}`;
    };

    const handleSaveSystemToken = async (accountId: string) => {
        const token = systemTokenInputs[accountId]?.trim();
        if (!token) return;
        setSavingToken(accountId);
        try {
            await authApi.saveSystemUserToken(accountId, token);
            setFbAccounts(prev => prev.map(a => a.id === accountId ? { ...a, has_system_token: 1 } : a));
            setSystemTokenExpanded(prev => ({ ...prev, [accountId]: false }));
            setSystemTokenInputs(prev => ({ ...prev, [accountId]: '' }));
            toast.success('System User Token сохранён — теперь WhatsApp и Instagram подтягиваются автоматически');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка сохранения токена');
        } finally {
            setSavingToken(null);
        }
    };

    const handleRemoveSystemToken = async (accountId: string) => {
        setSavingToken(accountId);
        try {
            await authApi.removeSystemUserToken(accountId);
            setFbAccounts(prev => prev.map(a => a.id === accountId ? { ...a, has_system_token: 0 } : a));
            toast.success('System User Token удалён');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка');
        } finally {
            setSavingToken(null);
        }
    };

    const handleDisconnect = async (accountId: string) => {
        setDisconnecting(accountId);
        try {
            await authApi.disconnectFacebook(accountId);
            setFbAccounts((prev) => prev.filter((a) => a.id !== accountId));
            setConfirmDisconnect(null);
            toast.success('Facebook аккаунт отключён');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка отключения');
        } finally {
            setDisconnecting(null);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Настройки</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Управление профилем и подключёнными аккаунтами
                </p>
            </div>

            {/* Profile Section */}
            <div className="settings-section" style={{ marginBottom: '20px' }}>
                <div className="settings-section-header">
                    <div>
                        <div className="settings-section-title">Профиль</div>
                        <div className="settings-section-desc">Информация о вашем аккаунте</div>
                    </div>
                    <User size={20} style={{ color: 'var(--text-muted)' }} />
                </div>

                <div className="settings-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="user-avatar" style={{ width: '56px', height: '56px', fontSize: '20px' }}>
                            {user?.avatar ? <img src={user.avatar} alt={user.name} /> : user?.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{user?.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{user?.email}</div>
                            <div style={{ marginTop: '6px' }}>
                                <span className="badge" style={{
                                    background: 'rgba(79,110,247,0.1)',
                                    color: 'var(--accent-light)',
                                    fontSize: '11px',
                                }}>
                                    {user?.provider === 'local' ? '🔑 Локальный аккаунт' : '🔗 Facebook'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <h4>Дата регистрации</h4>
                        <p>{user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', {
                            year: 'numeric', month: 'long', day: 'numeric',
                        }) : '—'}</p>
                    </div>
                </div>
            </div>

            {/* Facebook Accounts Section */}
            <div className="settings-section" style={{ marginBottom: '20px' }}>
                <div className="settings-section-header">
                    <div>
                        <div className="settings-section-title">Facebook Ads Manager</div>
                        <div className="settings-section-desc">
                            Подключите Facebook аккаунт для управления рекламными кампаниями
                        </div>
                    </div>
                    <Facebook size={20} style={{ color: '#1877f2' }} />
                </div>

                {/* Info Banner */}
                <div style={{
                    margin: '0 24px 16px',
                    padding: '14px 16px',
                    background: 'rgba(79,110,247,0.06)',
                    border: '1px solid rgba(79,110,247,0.15)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                }}>
                    <strong style={{ color: 'var(--accent-light)' }}>Необходимые разрешения:</strong>{' '}
                    При подключении Facebook запросит доступ к{' '}
                    <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>ads_management</code>,{' '}
                    <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>ads_read</code>,{' '}
                    <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>business_management</code>.
                    Убедитесь, что ваше приложение Meta имеет доступ к этим разрешениям.
                </div>

                {/* Connect Button */}
                <div className="settings-item">
                    <div className="settings-item-info">
                        <h4>Подключить новый аккаунт</h4>
                        <p>Авторизуйтесь через Facebook для доступа к Ads Manager</p>
                    </div>
                    <button
                        id="connect-facebook-btn"
                        className="btn btn-facebook"
                        onClick={handleConnectFacebook}
                    >
                        <Facebook size={16} />
                        Подключить Facebook
                        <ExternalLink size={14} />
                    </button>
                </div>

                {/* Connected Accounts */}
                {isLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                        <span className="loading-spinner" />
                    </div>
                ) : fbAccounts.length > 0 ? (
                    fbAccounts.map((acc) => (
                        <div key={acc.id}>
                            <div className="settings-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        background: 'var(--fb-blue)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Facebook size={20} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{acc.fb_name}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {acc.fb_email || `ID: ${acc.fb_user_id}`}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Подключён: {new Date(acc.created_at).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className="badge badge-active">
                                        <CheckCircle size={10} />
                                        Активен
                                    </span>

                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setSystemTokenExpanded(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                                        style={{ color: acc.has_system_token ? 'var(--green)' : 'var(--text-muted)' }}
                                        title="System User Token"
                                    >
                                        <Key size={14} />
                                        {acc.has_system_token ? 'System Token ✓' : 'System Token'}
                                        {systemTokenExpanded[acc.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>

                                    {confirmDisconnect === acc.id ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--red)' }}>Отключить?</span>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDisconnect(acc.id)}
                                                disabled={disconnecting === acc.id}
                                            >
                                                {disconnecting === acc.id ? <span className="loading-spinner" /> : 'Да'}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setConfirmDisconnect(null)}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => setConfirmDisconnect(acc.id)}
                                            style={{ color: 'var(--red)' }}
                                        >
                                            <Trash2 size={14} />
                                            Отключить
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* System User Token panel */}
                            {systemTokenExpanded[acc.id] && (
                                <div style={{
                                    margin: '0 24px 16px',
                                    padding: '16px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Key size={14} style={{ color: 'var(--accent-light)' }} />
                                        System User Token
                                        {acc.has_system_token ? (
                                            <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 400 }}>— подключён</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>— не подключён</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
                                        System User Token даёт полный доступ к данным страниц: WhatsApp номера, Instagram аккаунты.
                                        Создайте системного пользователя в{' '}
                                        <a
                                            href="https://business.facebook.com/settings/system-users"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--accent-light)' }}
                                        >
                                            Meta Business Manager → Системные пользователи
                                        </a>
                                        , назначьте ему страницы и рекламные аккаунты, сгенерируйте токен.
                                    </div>

                                    {acc.has_system_token ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--green)' }}>
                                                <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                                Токен активен — WhatsApp и Instagram подтягиваются автоматически
                                            </span>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleRemoveSystemToken(acc.id)}
                                                disabled={savingToken === acc.id}
                                                style={{ color: 'var(--red)', marginLeft: 'auto' }}
                                            >
                                                {savingToken === acc.id ? <span className="loading-spinner" /> : <><Trash2 size={12} /> Удалить</>}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="password"
                                                className="form-input"
                                                placeholder="Вставьте System User Token..."
                                                value={systemTokenInputs[acc.id] || ''}
                                                onChange={e => setSystemTokenInputs(prev => ({ ...prev, [acc.id]: e.target.value }))}
                                                style={{ flex: 1, fontSize: '13px' }}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleSaveSystemToken(acc.id)}
                                                disabled={savingToken === acc.id || !systemTokenInputs[acc.id]?.trim()}
                                            >
                                                {savingToken === acc.id ? <span className="loading-spinner" /> : 'Сохранить'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="settings-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                            <AlertCircle size={18} style={{ color: 'var(--yellow)' }} />
                            <span style={{ fontSize: '14px' }}>Нет подключённых Facebook аккаунтов</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Section */}
            <div className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <div className="settings-section-title">Безопасность</div>
                        <div className="settings-section-desc">Информация о подключении к API</div>
                    </div>
                    <Shield size={20} style={{ color: 'var(--text-muted)' }} />
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <h4>API подключение</h4>
                        <p>Все данные передаются через официальный Facebook Marketing API v19.0</p>
                    </div>
                    <span className="badge badge-active">Защищено</span>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <h4>OAuth 2.0</h4>
                        <p>Токены хранятся в зашифрованном виде, пароли Facebook не передаются</p>
                    </div>
                    <span className="badge badge-active">✓ SSL</span>
                </div>
            </div>
        </div>
    );
}
