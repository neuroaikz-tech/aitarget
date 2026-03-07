import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import passport from '../config/passport';

const router = Router();

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

// Facebook OAuth — инициировать подключение аккаунта
// Принимает токен через query param т.к. OAuth redirect не несёт Authorization header
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
        req.user = user;
        req.session.userId = user.id;
        next();
    } catch {
        return res.redirect(`${process.env.CLIENT_URL}/settings?fb_error=true`);
    }
}, passport.authenticate('facebook', {
    scope: ['email', 'ads_management', 'ads_read', 'business_management', 'public_profile'],
}));

// Facebook OAuth callback
router.get(
    '/facebook/callback',
    (req: any, res: Response, next: any) => {
        // Восстанавливаем user из сессии
        if (req.session.userId) {
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
            req.user = user;
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
