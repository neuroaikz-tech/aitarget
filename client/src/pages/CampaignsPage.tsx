import { useEffect, useState } from 'react';
import { adsApi, authApi } from '../api';
import toast from 'react-hot-toast';
import {
    Plus,
    Search,
    Trash2,
    Pause,
    Play,
    RefreshCw,
    ChevronDown,
    Megaphone,
    X,
} from 'lucide-react';

interface Campaign {
    id: string;
    name: string;
    status: string;
    objective: string;
    created_time: string;
    updated_time: string;
    daily_budget?: string;
    lifetime_budget?: string;
    buying_type?: string;
}

interface AdAccount {
    id: string;
    name: string;
    currency: string;
}

const OBJECTIVES = [
    { value: 'OUTCOME_AWARENESS', label: 'Охват / Узнаваемость' },
    { value: 'OUTCOME_TRAFFIC', label: 'Трафик' },
    { value: 'OUTCOME_ENGAGEMENT', label: 'Вовлечённость' },
    { value: 'OUTCOME_LEADS', label: 'Лиды' },
    { value: 'OUTCOME_APP_PROMOTION', label: 'Продвижение приложения' },
    { value: 'OUTCOME_SALES', label: 'Продажи' },
];

const STATUS_FILTERS = ['Все', 'ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'];

export default function CampaignsPage() {
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [filtered, setFiltered] = useState<Campaign[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Все');
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [hasFb, setHasFb] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);

    // Create form
    const [newName, setNewName] = useState('');
    const [newObjective, setNewObjective] = useState('OUTCOME_TRAFFIC');
    const [newStatus, setNewStatus] = useState('PAUSED');
    const [newDailyBudget, setNewDailyBudget] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [campaigns, searchQuery, statusFilter]);

    const init = async () => {
        try {
            const fbRes = await authApi.getFacebookAccounts();
            if (!fbRes.data.accounts?.length) {
                setHasFb(false);
                setIsLoading(false);
                return;
            }
            setHasFb(true);

            const adRes = await adsApi.getAdAccounts();
            const accounts = adRes.data.accounts || [];
            setAdAccounts(accounts);

            if (accounts.length > 0) {
                const firstId = accounts[0].id.replace('act_', '');
                setSelectedAccount(firstId);
                await loadCampaigns(firstId);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCampaigns = async (accountId: string) => {
        setIsLoading(true);
        try {
            const res = await adsApi.getCampaigns(accountId);
            setCampaigns(res.data.campaigns || []);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка загрузки кампаний');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...campaigns];
        if (searchQuery) {
            result = result.filter((c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (statusFilter !== 'Все') {
            result = result.filter((c) => c.status === statusFilter);
        }
        setFiltered(result);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newObjective) {
            toast.error('Заполните обязательные поля');
            return;
        }
        setIsCreating(true);
        try {
            await adsApi.createCampaign(selectedAccount, {
                name: newName,
                objective: newObjective,
                status: newStatus,
                daily_budget: newDailyBudget ? parseInt(newDailyBudget) * 100 : undefined,
                special_ad_categories: [],
            });
            toast.success('Кампания создана!');
            setShowCreateModal(false);
            setNewName('');
            setNewDailyBudget('');
            await loadCampaigns(selectedAccount);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка создания');
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleStatus = async (campaign: Campaign) => {
        const newSt = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            await adsApi.updateCampaign(campaign.id, { status: newSt });
            setCampaigns((prev) =>
                prev.map((c) => (c.id === campaign.id ? { ...c, status: newSt } : c))
            );
            toast.success(newSt === 'ACTIVE' ? 'Кампания запущена' : 'Кампания приостановлена');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка обновления');
        }
    };

    const handleDelete = async (campaignId: string) => {
        try {
            await adsApi.deleteCampaign(campaignId);
            setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
            setDeleteConfirm(null);
            toast.success('Кампания удалена');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка удаления');
        }
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            ACTIVE: 'active', PAUSED: 'paused', DELETED: 'deleted', ARCHIVED: 'archived',
        };
        const labels: Record<string, string> = {
            ACTIVE: 'Активна', PAUSED: 'Пауза', DELETED: 'Удалена', ARCHIVED: 'Архив',
        };
        return <span className={`badge badge-${map[status] || 'archived'}`}>{labels[status] || status}</span>;
    };

    const selectedAccountName = adAccounts.find((a) => a.id.replace('act_', '') === selectedAccount)?.name || '';

    if (!hasFb && !isLoading) {
        return (
            <div className="empty-state" style={{ paddingTop: '80px' }}>
                <div className="empty-state-icon">
                    <Megaphone size={28} />
                </div>
                <h3>Facebook аккаунт не подключён</h3>
                <p>Перейдите в настройки и подключите Facebook аккаунт для управления кампаниями</p>
                <a href="/settings" className="btn btn-primary">Перейти в настройки</a>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Рекламные кампании</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Создавайте и управляйте кампаниями Facebook Ads
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => selectedAccount && loadCampaigns(selectedAccount)}
                        id="refresh-campaigns"
                    >
                        <RefreshCw size={15} />
                        Обновить
                    </button>
                    {selectedAccount && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateModal(true)}
                            id="create-campaign-btn"
                        >
                            <Plus size={16} />
                            Создать кампанию
                        </button>
                    )}
                </div>
            </div>

            {/* Account Selector + Filters */}
            <div className="filters-row">
                {/* Ad Account Dropdown */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="account-selector"
                        onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                        id="account-selector"
                    >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Аккаунт:</span>
                        <span style={{ fontWeight: '600' }}>{selectedAccountName || 'Выберите аккаунт'}</span>
                        <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    {showAccountDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            marginTop: '4px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            minWidth: '240px',
                            zIndex: 50,
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-card)',
                        }}>
                            {adAccounts.map((acc) => (
                                <div
                                    key={acc.id}
                                    onClick={() => {
                                        const id = acc.id.replace('act_', '');
                                        setSelectedAccount(id);
                                        loadCampaigns(id);
                                        setShowAccountDropdown(false);
                                    }}
                                    style={{
                                        padding: '10px 14px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        background: acc.id.replace('act_', '') === selectedAccount
                                            ? 'rgba(79,110,247,0.1)' : 'transparent',
                                        color: acc.id.replace('act_', '') === selectedAccount
                                            ? 'var(--accent-light)' : 'var(--text-primary)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontWeight: '600' }}>{acc.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{acc.id}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="search-bar">
                    <Search size={16} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Поиск кампаний..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        id="campaign-search"
                    />
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {STATUS_FILTERS.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className="btn btn-sm"
                            style={{
                                background: statusFilter === s ? 'rgba(79,110,247,0.15)' : 'var(--bg-card)',
                                color: statusFilter === s ? 'var(--accent-light)' : 'var(--text-secondary)',
                                border: `1px solid ${statusFilter === s ? 'rgba(79,110,247,0.3)' : 'var(--border)'}`,
                            }}
                        >
                            {s === 'Все' ? 'Все' : s === 'ACTIVE' ? 'Активные' : s === 'PAUSED' ? 'Пауза' : s === 'DELETED' ? 'Удалённые' : 'Архив'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Campaigns Table */}
            {isLoading ? (
                <div className="loading-page">
                    <span className="loading-spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
                    <span>Загружаем кампании...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Megaphone size={28} />
                    </div>
                    <h3>{campaigns.length === 0 ? 'Нет кампаний' : 'Ничего не найдено'}</h3>
                    <p>
                        {campaigns.length === 0
                            ? 'Создайте первую рекламную кампанию'
                            : 'Попробуйте изменить фильтры или поисковый запрос'}
                    </p>
                    {campaigns.length === 0 && selectedAccount && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus size={16} /> Создать кампанию
                        </button>
                    )}
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Название</th>
                                <th>Цель</th>
                                <th>Статус</th>
                                <th>Дневной бюджет</th>
                                <th>Дата создания</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((campaign) => (
                                <tr key={campaign.id}>
                                    <td>
                                        <div style={{ fontWeight: '600' }}>{campaign.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            ID: {campaign.id}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            {OBJECTIVES.find((o) => o.value === campaign.objective)?.label || campaign.objective?.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td>{getStatusBadge(campaign.status)}</td>
                                    <td>
                                        {campaign.daily_budget
                                            ? <span style={{ fontWeight: '600', color: 'var(--green)' }}>
                                                ${(parseInt(campaign.daily_budget) / 100).toFixed(2)}
                                            </span>
                                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        {campaign.created_time
                                            ? new Date(campaign.created_time).toLocaleDateString('ru-RU')
                                            : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {/* Toggle Status */}
                                            {(campaign.status === 'ACTIVE' || campaign.status === 'PAUSED') && (
                                                <button
                                                    className="btn btn-icon btn-sm"
                                                    onClick={() => handleToggleStatus(campaign)}
                                                    title={campaign.status === 'ACTIVE' ? 'Поставить на паузу' : 'Запустить'}
                                                >
                                                    {campaign.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                                                </button>
                                            )}
                                            {/* Delete */}
                                            {campaign.status !== 'DELETED' && (
                                                deleteConfirm === campaign.id ? (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '12px', color: 'var(--red)' }}>Удалить?</span>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleDelete(campaign.id)}
                                                        >
                                                            Да
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => setDeleteConfirm(null)}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-icon btn-sm"
                                                        onClick={() => setDeleteConfirm(campaign.id)}
                                                        title="Удалить"
                                                        style={{ color: 'var(--red)' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) setShowCreateModal(false);
                }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title">Создать кампанию</h2>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Название кампании *</label>
                                    <input
                                        id="campaign-name-input"
                                        type="text"
                                        className="form-input"
                                        placeholder="Например: Продажи лето 2025"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Цель кампании *</label>
                                    <select
                                        id="campaign-objective-select"
                                        className="form-select"
                                        value={newObjective}
                                        onChange={(e) => setNewObjective(e.target.value)}
                                    >
                                        {OBJECTIVES.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Начальный статус</label>
                                    <select
                                        id="campaign-status-select"
                                        className="form-select"
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                    >
                                        <option value="PAUSED">На паузе (рекомендуется)</option>
                                        <option value="ACTIVE">Активна</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Дневной бюджет ($)</label>
                                    <input
                                        id="campaign-budget-input"
                                        type="number"
                                        className="form-input"
                                        placeholder="Например: 10.00"
                                        value={newDailyBudget}
                                        onChange={(e) => setNewDailyBudget(e.target.value)}
                                        min="1"
                                        step="0.01"
                                    />
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Оставьте пустым для установки бюджета позже
                                    </span>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isCreating} id="campaign-create-submit">
                                    {isCreating ? <span className="loading-spinner" /> : <Plus size={16} />}
                                    {isCreating ? 'Создаём...' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
