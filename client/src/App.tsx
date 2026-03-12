import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CampaignsPage from './pages/CampaignsPage';
import SettingsPage from './pages/SettingsPage';
import AIAnalystPage from './pages/AIAnalystPage';

export default function App() {
  const { fetchMe, token } = useAuthStore();

  useEffect(() => {
    // 1. Проверяем Telegram WebApp
    const tgInitData = (window as any).Telegram?.WebApp?.initData;

    if (tgInitData && !token) {
      // Идёт вход через Telegram
      axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/telegram/auth`, {
        initData: tgInitData
      }).then(res => {
        useAuthStore.getState().setAuth(res.data.user, res.data.token);
      }).catch(err => {
        console.error('Telegram auth failed:', err);
      });
    } else if (token) {
      // 2. Иначе обычный fetchMe по JWT 토кeну
      fetchMe();
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: 'white' },
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/ai" element={<AIAnalystPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
