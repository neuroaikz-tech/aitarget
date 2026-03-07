import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, BarChart2, Target, Shield } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Заполните все поля');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authApi.login({ email, password });
            setAuth(res.data.user, res.data.token);
            toast.success('Добро пожаловать!');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка входа');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-glow" />
            <div className="auth-bg-glow-2" />

            <div className="auth-left">
                <div className="auth-hero">
                    <h1 className="auth-hero-title">
                        Управляйте <span>Facebook рекламой</span> эффективно
                    </h1>
                    <p className="auth-hero-desc">
                        Единая платформа для управления всеми вашими рекламными кампаниями.
                        Создавайте, оптимизируйте и анализируйте — всё в одном месте.
                    </p>
                    <div className="auth-feature-list">
                        <div className="auth-feature">
                            <div className="auth-feature-icon" style={{ background: 'rgba(79,110,247,0.15)' }}>
                                <Zap size={20} color="#4f6ef7" />
                            </div>
                            <div className="auth-feature-text">
                                <h4>Быстрое создание кампаний</h4>
                                <p>Запускайте рекламу за минуты через удобный интерфейс</p>
                            </div>
                        </div>
                        <div className="auth-feature">
                            <div className="auth-feature-icon" style={{ background: 'rgba(34,197,94,0.15)' }}>
                                <BarChart2 size={20} color="#22c55e" />
                            </div>
                            <div className="auth-feature-text">
                                <h4>Аналитика в реальном времени</h4>
                                <p>Отслеживайте метрики и ROI ваших кампаний</p>
                            </div>
                        </div>
                        <div className="auth-feature">
                            <div className="auth-feature-icon" style={{ background: 'rgba(168,85,247,0.15)' }}>
                                <Target size={20} color="#a855f7" />
                            </div>
                            <div className="auth-feature-text">
                                <h4>Управление несколькими аккаунтами</h4>
                                <p>Контролируйте все рекламные аккаунты в одном кабинете</p>
                            </div>
                        </div>
                        <div className="auth-feature">
                            <div className="auth-feature-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
                                <Shield size={20} color="#f59e0b" />
                            </div>
                            <div className="auth-feature-text">
                                <h4>Безопасное подключение</h4>
                                <p>OAuth 2.0 авторизация через официальный API Meta</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-brand">
                    <div className="auth-brand-icon">A</div>
                    <div className="auth-brand-name">AITarget</div>
                </div>

                <h2 className="auth-title">Войти в аккаунт</h2>
                <p className="auth-subtitle">Введите данные для входа на платформу</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Пароль</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingRight: '44px' }}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    padding: '4px',
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        id="login-submit"
                        type="submit"
                        className="btn btn-primary btn-full btn-lg"
                        disabled={isLoading}
                    >
                        {isLoading ? <span className="loading-spinner" /> : null}
                        {isLoading ? 'Входим...' : 'Войти'}
                    </button>
                </form>

                <div className="divider-text" style={{ marginTop: '24px' }}>
                    Нет аккаунта?
                </div>

                <Link
                    to="/register"
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: '12px' }}
                    id="go-to-register"
                >
                    Создать аккаунт
                </Link>
            </div>
        </div>
    );
}
