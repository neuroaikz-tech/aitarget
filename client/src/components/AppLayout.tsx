import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-with-sidebar" style={{ flex: 1, minHeight: '100vh' }}>
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
