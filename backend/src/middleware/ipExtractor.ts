import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { normalizeIp } from '../utils/subnet.js';

/**
 * Достаёт реальный IP клиента.
 * Если включён TRUST_PROXY — берём первый hop из X-Forwarded-For
 * (правый ИЛИ левый элемент? Безопасный вариант: первый слева — тот, что добавил ближайший прокси).
 */
export function ipExtractor(req: Request): string {
  const connectionIp = req.ip || req.socket?.remoteAddress || 'unknown';
  const fallback = normalizeIp(connectionIp.replace(/^::ffff:/, '')) || 'unknown';

  if (!config.trustProxy) return fallback;

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0].trim();
    if (first) return normalizeIp(first) || fallback;
  }
  if (Array.isArray(xff) && xff.length > 0) {
    const first = xff[0].split(',')[0].trim();
    if (first) return normalizeIp(first) || fallback;
  }
  return fallback;
}

export function ipExtractorMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as Request & { clientIp: string }).clientIp = ipExtractor(req);
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientIp: string;
    }
  }
}