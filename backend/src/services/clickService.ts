import type { Request } from 'express';
import db, { now } from '../db/index.js';
import { kv } from '../redis.js';
import { config, CLICK_RATE_KEY_PREFIX } from '../config.js';
import { listService } from './listService.js';
import { applyUrlTemplate } from '../utils/urlTemplate.js';
import logger from '../logger.js';

export type ClickAction = 'redirected' | 'blocked';

export interface ClickResult {
  action: ClickAction;
  redirectUrl?: string;
  clickId?: number;
  reason?: string;
}

interface OfferRow {
  id: number;
  name: string;
  url_template: string;
  payout: number;
  is_active: number;
}

function str(q: unknown, fallback = ''): string {
  if (typeof q === 'string' && q.length < 200) return q;
  return fallback;
}

function pickOffer(offerIdParam?: number): OfferRow | undefined {
  if (offerIdParam) {
    return db
      .prepare('SELECT * FROM offers WHERE id = ? AND is_active = 1')
      .get(offerIdParam) as OfferRow | undefined;
  }
  return db
    .prepare('SELECT * FROM offers WHERE is_active = 1 ORDER BY id LIMIT 1')
    .get() as OfferRow | undefined;
}

const insertClick = db.prepare(
  `INSERT INTO clicks (offer_id, ip, user_agent, referer, country, sub1, sub2, sub3, redirected, created_at)
   VALUES (@offer_id, @ip, @user_agent, @referer, @country, @sub1, @sub2, @sub3, 1, @created_at)`,
);

export async function handleClick(req: Request): Promise<ClickResult> {
  const ip = req.clientIp || 'unknown';
  const ua = str(req.headers['user-agent']);
  const referer = str(req.headers['referer']);
  const sub1 = str(req.query.sub1);
  const sub2 = str(req.query.sub2);
  const sub3 = str(req.query.sub3);
  const offerIdParam = Number.parseInt(str(req.query.offer_id), 10) || undefined;

  const whitelisted = listService.isWhitelisted(ip);
  if (!whitelisted) {
    const banned = await listService.isBlacklisted(ip);
    if (banned) {
      logger.info({ ip }, 'click blocked by blacklist/whitelist-check');
      return { action: 'blocked', reason: 'blacklist' };
    }

    const count = await kv.incr(CLICK_RATE_KEY_PREFIX + ip);
    if (count === 1) void kv.expire(CLICK_RATE_KEY_PREFIX + ip, 60);
    if (count > config.rateLimitPerMin) {
      await listService.autoBan(ip, `Превышение частоты: ${count} кликов/мин`);
      logger.warn({ ip, count }, 'click blocked by rate limit, ip auto-banned');
      return { action: 'blocked', reason: 'rate_limit' };
    }
  }

  const offer = pickOffer(offerIdParam);
  if (!offer) {
    logger.warn({ ip }, 'no active offer for click');
    return { action: 'blocked', reason: 'no_offer' };
  }

  const clickId = Number(
    insertClick.run({
      offer_id: offer.id,
      ip,
      user_agent: ua || null,
      referer: referer || null,
      country: null,
      sub1: sub1 || null,
      sub2: sub2 || null,
      sub3: sub3 || null,
      created_at: now(),
    }).lastInsertRowid,
  );

  const url = applyUrlTemplate(offer.url_template, {
    click_id: String(clickId),
    sub1,
    sub2,
    sub3,
    offer_id: String(offer.id),
  });

  if (!url) {
    logger.warn({ clickId, offerId: offer.id }, 'invalid url_template, click saved without redirect');
    return { action: 'blocked', reason: 'invalid_url' };
  }

  logger.info({ clickId, ip, offerId: offer.id, sub1 }, 'click recorded');
  return { action: 'redirected', redirectUrl: url, clickId };
}