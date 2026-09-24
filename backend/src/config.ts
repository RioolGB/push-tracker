import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = {
  port: int(process.env.PORT, 3000),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
  postbackToken: process.env.POSTBACK_TOKEN || 'postback-secret',
  rateLimitPerMin: int(process.env.RATE_LIMIT_PER_MIN, 30),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(__dirname, '..', 'data', 'tracker.db'),
  logFileEnabled: bool(process.env.LOG_FILE_ENABLED, true),
  logDir: path.resolve(__dirname, '..', process.env.LOG_DIR || 'logs'),
  trustProxy: bool(process.env.TRUST_PROXY, false),
};

export const AUTO_BAN_HOURS = 24;
export const CLICK_BAN_KEY_PREFIX = 'ban:';
export const CLICK_RATE_KEY_PREFIX = 'ratelimit:';
export const LOGIN_FAIL_PREFIX = 'loginfail:';
export const SESSION_COOKIE = 'pt_session';
export const SESSION_TTL_DAYS = 7;
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 10 * 60;