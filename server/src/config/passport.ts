import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';

// JWT Strategy — всегда регистрируем
passport.use(
    'jwt',
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
        },
        (payload: any, done: any) => {
            try {
                const db = getDb();
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) as any;
                if (user) return done(null, user);
                return done(null, false);
            } catch (err) {
                return done(err, false);
            }
        }
    )
);

// Facebook Strategy — регистрируем только если APP_ID задан
export function setupFacebookStrategy() {
    if (!process.env.FB_APP_ID || process.env.FB_APP_ID === 'YOUR_FACEBOOK_APP_ID') {
        console.warn('⚠️  FB_APP_ID не задан — Facebook OAuth недоступен');
        return;
    }

    const { Strategy: FacebookStrategy } = require('passport-facebook');

    passport.use(
        'facebook',
        new FacebookStrategy(
            {
                clientID: process.env.FB_APP_ID!,
                clientSecret: process.env.FB_APP_SECRET!,
                callbackURL: process.env.FB_CALLBACK_URL!,
                profileFields: ['id', 'displayName', 'email', 'photos'],
                passReqToCallback: true,
            },
            async (req: any, accessToken: string, _refreshToken: string, profile: any, done: any) => {
                try {
                    const db = getDb();
                    // userId может быть в req.user (установлен в callback middleware) или в session
                    const userId = req.user?.id || req.session?.userId;

                    if (!userId) {
                        return done(new Error('User not authenticated'), false);
                    }

                    const fbUserId = profile.id;
                    const fbName = profile.displayName;
                    const fbEmail = profile.emails?.[0]?.value || null;

                    const existing = db
                        .prepare('SELECT * FROM facebook_accounts WHERE user_id = ? AND fb_user_id = ?')
                        .get(userId, fbUserId) as any;

                    if (existing) {
                        db.prepare(
                            'UPDATE facebook_accounts SET access_token = ?, fb_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                        ).run(accessToken, fbName, existing.id);
                    } else {
                        db.prepare(
                            'INSERT INTO facebook_accounts (id, user_id, fb_user_id, fb_name, fb_email, access_token) VALUES (?, ?, ?, ?, ?, ?)'
                        ).run(uuidv4(), userId, fbUserId, fbName, fbEmail, accessToken);
                    }

                    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
                    return done(null, user);
                } catch (err) {
                    return done(err, false);
                }
            }
        )
    );

    console.log('✅ Facebook OAuth стратегия зарегистрирована');
}

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser((id: string, done) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;
