import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import passport from '../config/passport';

import crypto from 'crypto';

const router = Router();

// Авторизация через Telegram Mini App (InitData)
router.post('/telegram/auth', async (req: Request, res: Response) => {
    try {
        const { initData } = req.body;
        if (!initData) return res.status(400).json({ error: 'Нет initData' });

        // Парсим initData
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        // Сортируем параметры по алфавиту
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Создаём секретный ключ из токена бота
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return res.status(500).json({ error: 'Бот не настроен' });

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (calculatedHash !== hash) {
            return res.status(403).json({ error: 'Неверная подпись Telegram' });
        }

        // Данные пользователя Telegram
        const tgUserStr = urlParams.get('user');
        if (!tgUserStr) return res.status(400).json({ error: 'Нет данных пользователя' });
        const tgUser = JSON.parse(tgUserStr);

        const db = getDb();
        const existingUser = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(String(tgUser.id)) as any;

        let userId = existingUser?.id;

        if (!userId) {
            // Создаём нового пользователя, если он зашёл впервые через TG
            userId = uuidv4();
            db.prepare(
                'INSERT INTO users (id, name, telegram_id, provider) VALUES (?, ?, ?, ?)'
            ).run(userId, tgUser.first_name || 'Telegram User', String(tgUser.id), 'telegram');
        }

        // Выдаём обычный JWT токен как при обычной авторизации
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
        });

        res.json({
            message: 'Успешно авторизовано через Telegram',
            token,
            user: {
                id: userId,
                name: tgUser.first_name,
                telegram_id: String(tgUser.id)
            }
        });

    } catch (err: any) {
        console.error('Ошибка Telegram Auth:', err);
        res.status(500).json({ error: 'Ошибка авторизации' });
    }
});

// Привязка Telegram к существующему аккаунту
router.post('/telegram/link', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { initData } = req.body;
        if (!initData) return res.status(400).json({ error: 'Нет initData' });

        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return res.status(500).json({ error: 'Бот не настроен' });

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (calculatedHash !== hash) {
            return res.status(403).json({ error: 'Неверная подпись Telegram' });
        }

        const tgUserStr = urlParams.get('user');
        if (!tgUserStr) return res.status(400).json({ error: 'Нет данных пользователя' });
        const tgUser = JSON.parse(tgUserStr);

        const db = getDb();
        db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(String(tgUser.id), req.user!.id);

        res.json({ message: 'Telegram аккаунт успешно привязан' });
    } catch (err: any) {
        console.error('Ошибка привязки Telegram:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Регистрация
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

        if (existing) {
            return res.status(409).json({ error: 'Email уже используется' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = uuidv4();

        db.prepare(
            'INSERT INTO users (id, email, password, name, provider) VALUES (?, ?, ?, ?, ?)'
        ).run(userId, email, hashedPassword, name, 'local');

        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
        });

        const user = db.prepare('SELECT id, email, name, avatar, provider, created_at FROM users WHERE id = ?').get(userId);

        res.status(201).json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        if (!user.password) {
            return res.status(401).json({ error: 'Этот аккаунт использует авторизацию через Facebook' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
        });

        const { password: _, ...safeUser } = user;
        res.json({ token, user: safeUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить текущего пользователя
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
    const { password, ...safeUser } = req.user;
    res.json({ user: safeUser });
});

// Facebook OAuth — проверяем JWT, передаём userId через state параметр
router.get('/facebook', (req: any, res: Response, next: any) => {
    const token = req.query.token as string;

    if (!token) {
        return res.redirect(`${process.env.CLIENT_URL}/settings?fb_error=true`);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id) as any;
        if (!user) {
            return res.redirect(`${process.env.CLIENT_URL}/settings?fb_error=true`);
        }

        // Вызываем passport.authenticate напрямую с state=userId
        passport.authenticate('facebook', {
            scope: [
                'email',
                'public_profile',
                // Ads
                'ads_management',
                'ads_read',
                // Pages — required for /me/accounts, creatives, lead forms
                'pages_show_list',
                'pages_read_engagement',
                'pages_manage_ads',
                // Business Manager — required for pixels, WABA, assets
                'business_management',
            ],
            state: user.id,
        } as any)(req, res, next);
    } catch {
        return res.redirect(`${process.env.CLIENT_URL}/settings?fb_error=true`);
    }
});

// Facebook OAuth callback — читаем userId из state параметра
router.get(
    '/facebook/callback',
    (req: any, res: Response, next: any) => {
        // Читаем userId из state параметра (передан при инициации OAuth)
        const userId = req.query.state as string;
        if (userId) {
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (user) {
                req.user = user;
                // Кладём в сессию для passport
                if (req.session) req.session.userId = userId;
            }
        }
        next();
    },
    passport.authenticate('facebook', { session: false, failureRedirect: `${process.env.CLIENT_URL}/settings?fb_error=true` }),
    (req: AuthRequest, res: Response) => {
        res.redirect(`${process.env.CLIENT_URL}/settings?fb_success=true`);
    }
);

// Отключить Facebook аккаунт
router.delete('/facebook/:fbAccountId', authenticate, (req: AuthRequest, res: Response) => {
    try {
        const db = getDb();
        const result = db
            .prepare('DELETE FROM facebook_accounts WHERE id = ? AND user_id = ?')
            .run(req.params.fbAccountId, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Аккаунт не найден' });
        }

        res.json({ message: 'Facebook аккаунт отключён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить подключённые FB аккаунты
router.get('/facebook-accounts', authenticate, (req: AuthRequest, res: Response) => {
    try {
        const db = getDb();
        const accounts = db
            .prepare('SELECT id, fb_user_id, fb_name, fb_email, created_at FROM facebook_accounts WHERE user_id = ?')
            .all(req.user.id);
        res.json({ accounts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
