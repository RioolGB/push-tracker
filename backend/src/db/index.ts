import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';
import logger from '../logger.js';

// Используем встроенный SQLite из Node.js (node:sqlite) — без нативных зависимостей.
import { DatabaseSync } from 'node:sqlite';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(SCHEMA_SQL);

export function seedAdmin(): void {
  const hash = bcrypt.hashSync(config.adminPassword, 10);
  const existing = db
    .prepare('SELECT id, password_hash FROM admins ORDER BY id LIMIT 1')
    .get() as { id: number | bigint; password_hash: string } | undefined;

  if (existing && !bcrypt.compareSync(config.adminPassword, existing.password_hash)) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
    logger.info('Admin password updated from .env');
  } else if (!existing) {
    db.prepare('INSERT INTO admins (password_hash) VALUES (?)').run(hash);
    logger.info('Admin account created from .env password');
  }
}

export function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export default db;