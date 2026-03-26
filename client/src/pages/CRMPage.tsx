import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
    Users, Plus, RefreshCw, Phone, Mail, Search,
    ChevronDown, Trash2, DollarSign, BarChart2, CheckCircle2,
    XCircle, Clock, Star, AlertCircle, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'https://aitarget-production.up.railway.app';

function authHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
}

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'bought' | 'rejected';

interface Lead {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    status: LeadStatus;
    deal_value?: number;
    fb_campaign_name?: string;
    fb_campaign_id?: string;
    fb_lead_id?: string;
    capi_sent_at?: string;
    created_at: string;
}

interface Stats {
    total: number;
    new_count: number;
    contacted_count: number;
    qualified_count: number;
    bought_count: number;
    rejected_count: number;
    total_revenue: number;
    campaigns_count: number;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; icon: any }> = {
    new:       { label: 'Новый',       color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  icon: Clock },
    contacted: { label: 'Связались',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: Phone },
    qualified: { label: 'Горячий',     color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  icon: Star },
    bought:    { label: 'Купил',       color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  icon: CheckCircle2 },
    rejected:  { label: 'Отказ',       color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: XCircle },
};

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'bought', 'rejected'];

export default function CRMPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);

    const fetchLeads = useCallback(async () => {
        try {
            const params: any = { limit: 100 };
            if (filterStatus !== 'all') params.status = filterStatus;
            if (search) params.search = search;
            const res = await axios.get(`${API}/api/crm/leads`, { headers: authHeaders(), params });
            setLeads(res.data.leads || []);
        } catch { toast.error('Ошибка загрузки лидов'); }
    }, [filterStatus, search]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/api/crm/stats`, { headers: authHeaders() });
            setStats(res.data.stats);
        } catch {}
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchLeads(), fetchStats()]).finally(() => setLoading(false));
    }, [fetchLeads, fetchStats]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await axios.post(`${API}/api/crm/sync`, {}, { headers: authHeaders() });
            const { synced, errors } = res.data;
            if (synced > 0) toast.success(`Синхронизировано ${synced} новых лидов`);
            else toast.success('Новых лидов нет');
            if (errors?.length) toast.error(`Ошибки: ${errors.slice(0, 2).join(', ')}`);
            fetchLeads();
            fetchStats();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Ошибка синхронизации');
        } finally { setSyncing(false); }
    };

    const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
        try {
            const res = await axios.patch(`${API}/api/crm/leads/${lead.id}`, { status: newStatus }, { headers: authHeaders() });
            setLeads(prev => prev.map(l => l.id === lead.id ? res.data.lead : l));
            if (newStatus === 'bought') {
                toast.success('Статус обновлён. Purchase событие отправлено в Meta!');
            } else {
                toast.success('Статус обновлён');
            }
            fetchStats();
        } catch { toast.error('Ошибка обновления'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить лид?')) return;
        try {
            await axios.delete(`${API}/api/crm/leads/${id}`, { headers: authHeaders() });
            setLeads(prev => prev.filter(l => l.id !== id));
            fetchStats();
            toast.success('Лид удалён');
        } catch { toast.error('Ошибка удаления'); }
    };

    const handleSaveNotes = async (lead: Lead, notes: string, dealValue?: string) => {
        try {
            const body: any = { notes };
            if (dealValue !== undefined) body.deal_value = dealValue ? parseFloat(dealValue) : null;
            const res = await axios.patch(`${API}/api/crm/leads/${lead.id}`, body, { headers: authHeaders() });
            setLeads(prev => prev.map(l => l.id === lead.id ? res.data.lead : l));
            toast.success('Сохранено');
        } catch { toast.error('Ошибка'); }
    };

    const conversion = stats && stats.total > 0
        ? ((stats.bought_count / stats.total) * 100).toFixed(1)
        : '0';

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={24} color="var(--accent-light)" />
                        CRM — Лиды
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
                        Управление лидами и отслеживание конверсий
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={15} className={syncing ? 'spin' : ''} />
                        {syncing ? 'Синхронизация...' : 'Синхронизировать с FB'}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={15} />
                        Добавить лид
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'Всего лидов', value: stats.total, icon: Users, color: '#60a5fa' },
                        { label: 'Новых', value: stats.new_count, icon: Clock, color: '#60a5fa' },
                        { label: 'Купили', value: stats.bought_count, icon: CheckCircle2, color: '#4ade80' },
                        { label: 'Конверсия', value: `${conversion}%`, icon: BarChart2, color: '#fb923c' },
                        { label: 'Выручка', value: stats.total_revenue > 0 ? `${stats.total_revenue.toLocaleString()} ₸` : '—', icon: DollarSign, color: '#4ade80' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                            <Icon size={20} color={color} style={{ marginBottom: '8px' }} />
                            <div style={{ fontSize: '22px', fontWeight: '700', color }}>{value}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="form-input"
                        placeholder="Поиск по имени, телефону, email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '32px' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[{ value: 'all', label: 'Все' }, ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setFilterStatus(value)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: `1px solid ${filterStatus === value ? 'var(--accent-light)' : 'var(--border)'}`,
                                background: filterStatus === value ? 'rgba(79,110,247,0.15)' : 'var(--bg-secondary)',
                                color: filterStatus === value ? 'var(--accent-light)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leads table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Загрузка...</div>
            ) : leads.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <Users size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Лидов пока нет. Нажмите «Синхронизировать с FB» чтобы подтянуть лиды из Facebook Lead Ads.
                    </p>
                    <button onClick={handleSync} className="btn btn-primary" style={{ margin: '0 auto' }}>
                        Синхронизировать
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leads.map(lead => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onSaveNotes={handleSaveNotes}
                            onEdit={setEditingLead}
                        />
                    ))}
                </div>
            )}

            {/* Add Lead Modal */}
            {showAddModal && (
                <AddLeadModal
                    onClose={() => setShowAddModal(false)}
                    onSaved={() => { setShowAddModal(false); fetchLeads(); fetchStats(); }}
                />
            )}

            {/* Edit Lead Modal */}
            {editingLead && (
                <EditLeadModal
                    lead={editingLead}
                    onClose={() => setEditingLead(null)}
                    onSaved={() => { setEditingLead(null); fetchLeads(); fetchStats(); }}
                />
            )}
        </div>
    );
}

// ─── Lead Card ────────────────────────────────────────────────

function LeadCard({ lead, onStatusChange, onDelete, onSaveNotes, onEdit }: {
    lead: Lead;
    onStatusChange: (lead: Lead, status: LeadStatus) => void;
    onDelete: (id: string) => void;
    onSaveNotes: (lead: Lead, notes: string, dealValue?: string) => void;
    onEdit: (lead: Lead) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [notes, setNotes] = useState(lead.notes || '');
    const [dealValue, setDealValue] = useState(lead.deal_value?.toString() || '');
    const cfg = STATUS_CONFIG[lead.status];
    const Icon = cfg.icon;

    return (
        <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Status badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 10px', borderRadius: '20px',
                    background: cfg.bg, color: cfg.color,
                    fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
                }}>
                    <Icon size={12} />
                    {cfg.label}
                </div>

                {/* Name / contact */}
                <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{lead.name || '—'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                        {lead.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} />{lead.phone}</span>}
                        {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} />{lead.email}</span>}
                    </div>
                </div>

                {/* Campaign */}
                {lead.fb_campaign_name && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📢 {lead.fb_campaign_name}
                    </div>
                )}

                {/* Deal value */}
                {lead.deal_value && (
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#4ade80', whiteSpace: 'nowrap' }}>
                        {lead.deal_value.toLocaleString()} ₸
                    </div>
                )}

                {/* CAPI sent */}
                {lead.capi_sent_at && (
                    <div title="Purchase событие отправлено в Meta" style={{ color: '#4ade80', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Send size={11} /> Meta ✓
                    </div>
                )}

                {/* Date */}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                        value={lead.status}
                        onChange={e => onStatusChange(lead, e.target.value as LeadStatus)}
                        style={{
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            border: '1px solid var(--border)', borderRadius: '6px',
                            padding: '4px 8px', fontSize: '12px', cursor: 'pointer',
                        }}
                    >
                        {STATUS_ORDER.map(s => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                        title="Заметки"
                    >
                        <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                    </button>
                    <button
                        onClick={() => onDelete(lead.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                        title="Удалить"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Expanded notes */}
            {expanded && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Заметки</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Записи о клиенте..."
                            style={{ resize: 'vertical', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Сумма сделки (₸)</label>
                        <input
                            className="form-input"
                            type="number"
                            value={dealValue}
                            onChange={e => setDealValue(e.target.value)}
                            placeholder="50000"
                        />
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => onSaveNotes(lead, notes, dealValue)}
                            style={{ fontSize: '13px', padding: '8px 16px' }}
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Add Lead Modal ────────────────────────────────────────────

function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', fb_campaign_name: '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.name && !form.phone && !form.email) {
            toast.error('Укажите хотя бы имя, телефон или email');
            return;
        }
        setSaving(true);
        try {
            await axios.post(`${API}/api/crm/leads`, form, { headers: authHeaders() });
            toast.success('Лид добавлен');
            onSaved();
        } catch { toast.error('Ошибка сохранения'); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '700' }}>Добавить лид</h3>
                {[
                    { key: 'name', label: 'Имя', placeholder: 'Иван Иванов' },
                    { key: 'phone', label: 'Телефон', placeholder: '+77001234567' },
                    { key: 'email', label: 'Email', placeholder: 'ivan@example.com' },
                    { key: 'fb_campaign_name', label: 'Кампания', placeholder: 'Название кампании (опционально)' },
                ].map(({ key, label, placeholder }) => (
                    <div key={key} className="form-group">
                        <label className="form-label">{label}</label>
                        <input
                            className="form-input"
                            placeholder={placeholder}
                            value={(form as any)[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        />
                    </div>
                ))}
                <div className="form-group">
                    <label className="form-label">Заметки</label>
                    <textarea
                        className="form-input"
                        rows={3}
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Откуда узнал, что интересует..."
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Отмена</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                        {saving ? 'Сохранение...' : 'Добавить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Edit Lead Modal ────────────────────────────────────────────

function EditLeadModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({ name: lead.name || '', phone: lead.phone || '', email: lead.email || '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.patch(`${API}/api/crm/leads/${lead.id}`, form, { headers: authHeaders() });
            toast.success('Лид обновлён');
            onSaved();
        } catch { toast.error('Ошибка'); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '700' }}>Редактировать лид</h3>
                {[
                    { key: 'name', label: 'Имя', placeholder: 'Имя клиента' },
                    { key: 'phone', label: 'Телефон', placeholder: '+77001234567' },
                    { key: 'email', label: 'Email', placeholder: 'email@example.com' },
                ].map(({ key, label, placeholder }) => (
                    <div key={key} className="form-group">
                        <label className="form-label">{label}</label>
                        <input
                            className="form-input"
                            placeholder={placeholder}
                            value={(form as any)[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        />
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Отмена</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
