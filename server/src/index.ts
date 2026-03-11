import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from './config/passport';
import { setupFacebookStrategy } from './config/passport';
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import aiRoutes from './routes/ai';
import { getDb } from './db/database';
import { startScheduler } from './services/scheduler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Инициализируем БД и Facebook OAuth стратегию
getDb();
setupFacebookStrategy();

// Middlewares
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'change_me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 10 * 60 * 1000, // 10 минут (только для OAuth flow)
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/ads', campaignRoutes);
app.use('/api/ai', aiRoutes);

// Запускаем планировщик ИИ-анализа
if (process.env.NODE_ENV !== 'test') {
    startScheduler();
}

// Health check
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
    console.log(`📦 Среда: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
