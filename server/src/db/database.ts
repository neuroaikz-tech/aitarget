import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Пути к БД по платформам:
// - Fly.io: /data (persistent volume)
// - Railway: /tmp (эфемерно, но работает)
// - Локально: ./data
function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.FLY_APP_NAME) return '/data/aitarget.db';
  if (process.env.RAILWAY_ENVIRONMENT) return '/tmp/aitarget.db';
  return path.join(process.cwd(), 'data', 'aitarget.db');
}
const DB_PATH = getDbPath();

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      avatar TEXT,
      provider TEXT DEFAULT 'local',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS facebook_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      fb_user_id TEXT NOT NULL,
      fb_name TEXT NOT NULL,
      fb_email TEXT,
      access_token TEXT NOT NULL,
      token_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, fb_user_id)
    );

    CREATE TABLE IF NOT EXISTS ad_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      fb_account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      currency TEXT,
      timezone TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      analysis_interval_hours INTEGER DEFAULT 6,
      auto_actions_enabled INTEGER DEFAULT 0,
      max_budget_increase_pct INTEGER DEFAULT 20,
      alert_cpa_threshold REAL,
      alert_spend_threshold REAL,
      gemini_api_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ad_account_id TEXT,
      ad_account_name TEXT,
      summary TEXT,
      insights TEXT,
      recommendations TEXT,
      total_spend REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

export default getDb;
