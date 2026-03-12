import Sidebar from './Sidebar';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Brain, Settings } from 'lucide-react';

const mobileNavItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
    { to: '/campaigns', icon: Megaphone, label: 'Кампании' },
    { to: '/ai', icon: Brain, label: 'ИИ', badge: true },
    { to: '/settings', icon: Settings, label: 'Настройки' },
];

export default function AppLayout() {
    const location = useLocation();

    return (
        <div className="app-layout">
            <Sidebar />
            
            <div className="main-with-sidebar" style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <main className="page-content">
                    <Outlet />
                </main>
            </div>

            {/* Мобильная нижняя навигация */}
            <nav className="mobile-nav">
                {mobileNavItems.map(({ to, icon: Icon, label, badge }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`mobile-nav-item ${location.pathname.startsWith(to) ? 'active' : ''}`}
                    >
                        <Icon size={24} />
                        <span>{label}</span>
                        {badge && !location.pathname.startsWith(to) && <div className="badge"></div>}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
