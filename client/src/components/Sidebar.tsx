import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
    LayoutDashboard,
    Megaphone,
    Settings,
    LogOut,
    ChevronRight,
} from 'lucide-react';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/campaigns', icon: Megaphone, label: 'Кампании' },
    { to: '/settings', icon: Settings, label: 'Настройки' },
];

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">A</div>
                <span className="sidebar-logo-text">AITarget</span>
            </div>

            <nav className="sidebar-nav">
                <span className="nav-section-title">Навигация</span>
                {navItems.map(({ to, icon: Icon, label }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`nav-item ${location.pathname.startsWith(to) ? 'active' : ''}`}
                        id={`nav-${label.toLowerCase()}`}
                    >
                        <Icon size={18} />
                        <span style={{ flex: 1 }}>{label}</span>
                        {location.pathname.startsWith(to) && (
                            <ChevronRight size={14} style={{ opacity: 0.5 }} />
                        )}
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="user-card">
                    <div className="user-avatar">
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} />
                        ) : (
                            user?.name?.[0]?.toUpperCase() || 'U'
                        )}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{user?.name}</div>
                        <div className="user-email">{user?.email}</div>
                    </div>
                    <button
                        className="btn-icon"
                        onClick={handleLogout}
                        title="Выйти"
                        id="logout-btn"
                        style={{ border: 'none', padding: '6px' }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
