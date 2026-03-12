import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { adsApi, authApi } from '../api';
import {
    BarChart2,
    Megaphone,
    TrendingUp,
    ExternalLink,
    Facebook,
    AlertCircle,
} from 'lucide-react';

interface AdAccount {
    id: string;
    name: string;
    currency: string;
    account_status: number;
    balance?: string;
    spend_cap?: string;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
}

interface FbAccount {
    id: string;
    fb_name: string;
    fb_email?: string;
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [hasFbConnected, setHasFbConnected] = useState(false);

    useEffect(() => {
        loadDashboard();
    }, []);

    useEffect(() => {
        if (selectedAdAccount) {
            loadCampaigns(selectedAdAccount);
        }
    }, [selectedAdAccount]);

    const loadDashboard = async () => {
        try {
            const fbRes = await authApi.getFacebookAccounts();
            const accounts = fbRes.data.accounts || [];
            setFbAccounts(accounts);
            setHasFbConnected(accounts.length > 0);

            if (accounts.length > 0) {
                const adRes = await adsApi.getAdAccounts();
                const ads = adRes.data.accounts || [];
                setAdAccounts(ads);
                if (ads.length > 0) {
                    setSelectedAdAccount(ads[0].id.replace('act_', ''));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCampaigns = async (adAccountId: string) => {
        try {
            const res = await adsApi.getCampaigns(adAccountId);
            setCampaigns(res.data.campaigns || []);
        } catch (err) {
            console.error(err);
        }
    };

    const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE');
    const pausedCampaigns = campaigns.filter((c) => c.status === 'PAUSED');

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            ACTIVE: 'active',
            PAUSED: 'paused',
            DELETED: 'deleted',
            ARCHIVED: 'archived',
        };
        const labels: Record<string, string> = {
            ACTIVE: 'Активна',
            PAUSED: 'Пауза',
            DELETED: 'Удалена',
            ARCHIVED: 'Архив',
        };
        return (
            <span className={`badge badge - ${map[status] || 'archived'} `}>
                {labels[status] || status}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="loading-page">
                <span className="loading-spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
                <span>Загружаем данные...</span>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
                    Добро пожаловать, {user?.name?.split(' ')[0]}! 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* FB Not Connected Banner */}
            {!hasFbConnected && (
                <div style={{
                    background: 'rgba(24,119,242,0.08)',
                    border: '1px solid rgba(24,119,242,0.25)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'rgba(24,119,242,0.15)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Facebook size={24} color="#1877f2" />
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', marginBottom: '2px' }}>Подключите Facebook аккаунт</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Для управления рекламными кампаниями необходимо подключить Facebook
                            </div>
                        </div>
                    </div>
                    <a href="/settings" className="btn btn-facebook mobile-hide">
                        <Facebook size={16} />
                        Подключить
                    </a>
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card blue">
                    <div className="stat-icon" style={{ background: 'rgba(79,110,247,0.15)' }}>
                        <Megaphone size={20} color="#4f6ef7" />
                    </div>
                    <div className="stat-value">{campaigns.length}</div>
                    <div className="stat-label">Всего кампаний</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon" style={{ background: 'var(--green-bg)' }}>
                        <TrendingUp size={20} color="var(--green)" />
                    </div>
                    <div className="stat-value">{activeCampaigns.length}</div>
                    <div className="stat-label">Активных кампаний</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon" style={{ background: 'var(--yellow-bg)' }}>
                        <AlertCircle size={20} color="var(--yellow)" />
                    </div>
                    <div className="stat-value">{pausedCampaigns.length}</div>
                    <div className="stat-label">На паузе</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon" style={{ background: 'var(--purple-bg)' }}>
                        <BarChart2 size={20} color="var(--purple)" />
                    </div>
                    <div className="stat-value">{adAccounts.length}</div>
                    <div className="stat-label">Рекл. аккаунтов</div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Recent Campaigns */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Последние кампании</h2>
                        {selectedAdAccount && (
                            <a href="/campaigns" className="btn btn-sm btn-secondary">
                                Все кампании
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>

                    {!hasFbConnected ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Facebook size={28} />
                            </div>
                            <h3>Facebook не подключён</h3>
                            <p>Подключите Facebook аккаунт в настройках</p>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Megaphone size={28} />
                            </div>
                            <h3>Нет кампаний</h3>
                            <p>Создайте первую рекламную кампанию</p>
                            <a href="/campaigns" className="btn btn-primary">Создать кампанию</a>
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Название</th>
                                        <th>Цель</th>
                                        <th>Статус</th>
                                        <th>Бюджет/день</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.slice(0, 5).map((campaign) => (
                                        <tr key={campaign.id}>
                                            <td style={{ fontWeight: '600' }}>{campaign.name}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                {campaign.objective?.replace(/_/g, ' ')}
                                            </td>
                                            <td>{getStatusBadge(campaign.status)}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {campaign.daily_budget
                                                    ? `$${(parseInt(campaign.daily_budget) / 100).toFixed(2)} `
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Ad Accounts Panel */}
                <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div className="card-header" style={{ marginBottom: '16px' }}>
                            <h2 className="card-title">Рекл. аккаунты</h2>
                        </div>

                        {adAccounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                {hasFbConnected ? 'Нет рекламных аккаунтов' : 'Подключите Facebook'}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {adAccounts.map((acc) => (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedAdAccount(acc.id.replace('act_', ''))}
                                        style={{
                                            padding: '12px',
                                            background: selectedAdAccount === acc.id.replace('act_', '')
                                                ? 'rgba(79,110,247,0.1)'
                                                : 'var(--bg-secondary)',
                                            border: `1px solid ${selectedAdAccount === acc.id.replace('act_', '') ? 'rgba(79,110,247,0.3)' : 'var(--border)'} `,
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition)',
                                        }}
                                    >
                                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                                            {acc.name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {acc.currency} • {acc.id}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Connected FB Accounts */}
                    <div className="card">
                        <div className="card-header" style={{ marginBottom: '16px' }}>
                            <h2 className="card-title">Facebook</h2>
                        </div>
                        {fbAccounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '12px' }}>
                                <a href="/settings" className="btn btn-facebook btn-sm btn-full">
                                    <Facebook size={15} />
                                    Подключить
                                </a>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {fbAccounts.map((acc) => (
                                    <div key={acc.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border)',
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            background: 'var(--fb-blue)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Facebook size={16} color="white" />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{acc.fb_name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {acc.fb_email || 'Facebook Account'}
                                            </div>
                                        </div>
                                        <span className="badge badge-active" style={{ fontSize: '11px' }}>✓</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
