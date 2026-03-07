import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) {
            toast.error('Заполните все поля');
            return;
        }
        if (password.length < 6) {
            toast.error('Пароль должен быть минимум 6 символов');
            return;
        }

        setIsLoading(true);
        try {
            const res = await authApi.register({ email, password, name });
            setAuth(res.data.user, res.data.token);
            toast.success('Аккаунт создан!');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Ошибка регистрации');
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
                        Начните <span>управлять рекламой</span> прямо сейчас
                    </h1>
                    <p className="auth-hero-desc">
                        Зарегистрируйтесь бесплатно и подключите Facebook Ads Manager
                        для полного контроля над вашими рекламными кампаниями.
                    </p>
                    <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            {['Регистрация', 'Подключение FB', 'Управление'].map((step, i) => (
                                <div key={i} style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    padding: '8px',
                                    background: i === 0 ? 'var(--accent-glow)' : 'transparent',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${i === 0 ? 'rgba(79,110,247,0.4)' : 'var(--border)'}`,
                                }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: i === 0 ? 'var(--accent-gradient)' : 'var(--bg-card-hover)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 6px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: i === 0 ? 'white' : 'var(--text-muted)',
                                    }}>
                                        {i + 1}
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: i === 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            Три простых шага до полного контроля над рекламой
                        </p>
                    </div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-brand">
                    <div className="auth-brand-icon">A</div>
                    <div className="auth-brand-name">AITarget</div>
                </div>

                <h2 className="auth-title">Создать аккаунт</h2>
                <p className="auth-subtitle">Начните управлять рекламой за минуты</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Имя</label>
                        <input
                            id="register-name"
                            type="text"
                            className="form-input"
                            placeholder="Ваше имя"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            id="register-email"
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
                                id="register-password"
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Минимум 6 символов"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingRight: '44px' }}
                                autoComplete="new-password"
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
                        {password && password.length < 6 && (
                            <span className="form-error">Пароль слишком короткий</span>
                        )}
                    </div>

                    <button
                        id="register-submit"
                        type="submit"
                        className="btn btn-primary btn-full btn-lg"
                        disabled={isLoading}
                    >
                        {isLoading ? <span className="loading-spinner" /> : null}
                        {isLoading ? 'Создаём...' : 'Создать аккаунт'}
                    </button>
                </form>

                <div className="divider-text" style={{ marginTop: '24px' }}>
                    Уже есть аккаунт?
                </div>

                <Link
                    to="/login"
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: '12px' }}
                    id="go-to-login"
                >
                    Войти
                </Link>
            </div>
        </div>
    );
}
