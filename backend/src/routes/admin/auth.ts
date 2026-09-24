import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db/index.js';
import {
  config,
  SESSION_COOKIE,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  LOGIN_FAIL_PREFIX,
} from '../../config.js';
import { kv } from '../../redis.js';
import { createSessionToken } from '../../utils/session.js';
import { requireAuth } from '../../middleware/auth.js';
import logger from '../../logger.js';

export const authRouter = Router();

function getAdminHash(): string {
  const row = db.prepare('SELECT password_hash FROM admins ORDER BY id LIMIT 1').get() as
    | { password_hash: string }
    | undefined;
  return row?.password_hash ?? '';
}

async function failCount(ip: string): Promise<number> {
  const v = await kv.get(LOGIN_FAIL_PREFIX + ip);
  return Number.parseInt(v ?? '0', 10) || 0;
}

authRouter.post('/login', async (req, res) => {
  const ip = req.clientIp || 'unknown';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const attempts = await failCount(ip);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    logger.warn({ ip }, 'login blocked by brute-force protection');
    res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
    return;
  }

  const hash = getAdminHash();
  const ok = hash !== '' && bcrypt.compareSync(password, hash);

  if (!ok) {
    const next = await kv.incr(LOGIN_FAIL_PREFIX + ip);
    if (next === 1) void kv.expire(LOGIN_FAIL_PREFIX + ip, LOGIN_WINDOW_SECONDS);
    logger.warn({ ip }, 'login failed');
    res.status(401).json({ error: 'Неверный пароль' });
    return;
  }

  await kv.del(LOGIN_FAIL_PREFIX + ip);
  const token = createSessionToken();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && config.trustProxy,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  logger.info({ ip }, 'admin logged in');
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ ok: true, authenticated: true });
});