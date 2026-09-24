import db, { now } from '../db/index.js';
import logger from '../logger.js';

export type PostbackStatus = 'approved' | 'pending' | 'rejected';

export interface PostbackInput {
  clickId: number;
  payout: number;
  status: PostbackStatus;
  externalId?: string;
}

function normalizeStatus(value: unknown): PostbackStatus {
  if (value === 'approved' || value === 'pending' || value === 'rejected') return value;
  return 'approved'; // по умолчанию считаем конверсию подтверждённой
}

const insertConversion = db.prepare(
  `INSERT INTO conversions (click_id, offer_id, payout, status, external_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export async function handlePostback(input: PostbackInput): Promise<'OK' | 'ERROR'> {
  const { clickId, payout } = input;
  const status = normalizeStatus(input.status);

  if (!Number.isInteger(clickId) || clickId <= 0) {
    logger.warn({ clickId }, 'postback: invalid click_id');
    return 'ERROR';
  }

  const click = db.prepare('SELECT id, offer_id FROM clicks WHERE id = ?').get(clickId) as
    | { id: number; offer_id: number }
    | undefined;
  if (!click) {
    logger.warn({ clickId }, 'postback: click not found');
    return 'ERROR';
  }

  const amount = Number.isFinite(payout) ? payout : 0;
  const existing = db.prepare('SELECT id, status FROM conversions WHERE click_id = ?').get(clickId) as
    | { id: number; status: string }
    | undefined;

  if (existing) {
    db.prepare(
      'UPDATE conversions SET status = ?, payout = ?, external_id = ?, created_at = ? WHERE id = ?',
    ).run(status, amount, input.externalId ?? null, now(), existing.id);
    logger.info({ clickId, status, amount }, 'postback: conversion updated');
    return 'OK';
  }

  insertConversion.run(click.id, click.offer_id, amount, status, input.externalId ?? null, now());
  logger.info({ clickId, offerId: click.offer_id, status, amount }, 'postback: conversion saved');
  return 'OK';
}

export async function parsePostback(query: Record<string, unknown>): Promise<PostbackInput | null> {
  const clickId = Number.parseInt(String(query.click_id ?? ''), 10);
  const payout = Number(String(query.payout ?? '0'));
  const externalId = typeof query.external_id === 'string' ? query.external_id.slice(0, 200) : undefined;
  return {
    clickId,
    payout,
    status: normalizeStatus(query.status),
    externalId,
  };
}