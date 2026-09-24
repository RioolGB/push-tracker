import db, { now } from '../db/index.js';
import { kv } from '../redis.js';
import { ipInNet } from '../utils/subnet.js';
import { AUTO_BAN_HOURS, CLICK_BAN_KEY_PREFIX } from '../config.js';
import logger from '../logger.js';

export interface ListEntry {
  id: number;
  type: 'ip' | 'subnet';
  value: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

function rowsMatchingIp(table: 'blacklist' | 'whitelist', ip: string): boolean {
  const rows = db.prepare(`SELECT type, value FROM ${table}`).all() as {
    type: string;
    value: string;
  }[];
  return rows.some((row) => ipInNet(ip, row.value));
}

export async function isBlacklisted(ip: string): Promise<boolean> {
  const ttlBan = await kv.get(CLICK_BAN_KEY_PREFIX + ip);
  if (ttlBan) return true;
  return rowsMatchingIp('blacklist', ip);
}

export function isWhitelisted(ip: string): boolean {
  return rowsMatchingIp('whitelist', ip);
}

export async function autoBan(ip: string, reason: string): Promise<void> {
  const existing = db
    .prepare("SELECT id FROM blacklist WHERE type='ip' AND value = ?")
    .get(ip) as { id: number } | undefined;
  if (!existing) {
    const expires = new Date(Date.now() + AUTO_BAN_HOURS * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    db.prepare(
      "INSERT INTO blacklist (type, value, reason, expires_at, created_at) VALUES ('ip', ?, ?, ?, ?)",
    ).run(ip, reason, expires, now());
    logger.warn({ ip, reason }, 'ip auto-banned');
  }
  await kv.setex(CLICK_BAN_KEY_PREFIX + ip, AUTO_BAN_HOURS * 60 * 60, '1');
}

function listColumns(table: 'blacklist' | 'whitelist'): string {
  return table === 'blacklist'
    ? 'id, type, value, reason, expires_at, created_at'
    : 'id, type, value, NULL AS reason, NULL AS expires_at, created_at';
}

function listTable(table: 'blacklist' | 'whitelist'): ListEntry[] {
  return db
    .prepare(`SELECT ${listColumns(table)} FROM ${table} ORDER BY id DESC`)
    .all() as unknown as ListEntry[];
}

function addRow(
  table: 'blacklist' | 'whitelist',
  type: string,
  value: string,
  reason?: string | null,
  expiresAt?: string | null,
): ListEntry {
  if (type !== 'ip' && type !== 'subnet') {
    throw new Error('type должен быть ip или subnet');
  }
  const ts = now();
  const info =
    table === 'blacklist'
      ? db
          .prepare(
            `INSERT INTO blacklist (type, value, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(type, value.trim(), reason ?? null, expiresAt ?? null, ts)
      : db
          .prepare(`INSERT INTO whitelist (type, value, created_at) VALUES (?, ?, ?)`)
          .run(type, value.trim(), ts);
  const id = Number(info.lastInsertRowid);
  const inserted = db
    .prepare(`SELECT ${listColumns(table)} FROM ${table} WHERE id = ?`)
    .get(id) as unknown as ListEntry;
  return inserted;
}

function removeRow(table: 'blacklist' | 'whitelist', id: number): boolean {
  const row = db
    .prepare(`SELECT value FROM ${table} WHERE id = ?`)
    .get(id) as { value: string } | undefined;
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  const removed = info.changes > 0;
  if (removed && table === 'blacklist' && row) {
    // удаляем TTL-бан из Redis, если он есть
    void kv.del(CLICK_BAN_KEY_PREFIX + row.value);
  }
  return removed;
}

export const listService = {
  isBlacklisted,
  isWhitelisted,
  autoBan,
  listBlacklist: () => listTable('blacklist'),
  listWhitelist: () => listTable('whitelist'),
  addBlacklist: (type: string, value: string, reason?: string | null, expiresAt?: string | null) =>
    addRow('blacklist', type, value, reason, expiresAt),
  addWhitelist: (type: string, value: string) => addRow('whitelist', type, value),
  removeBlacklist: (id: number) => removeRow('blacklist', id),
  removeWhitelist: (id: number) => removeRow('whitelist', id),
};