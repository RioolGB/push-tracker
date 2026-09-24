import { Router } from 'express';
import db, { now } from '../../db/index.js';
import { validateTemplate } from '../../utils/urlTemplate.js';
import logger from '../../logger.js';

export const offersRouter = Router();

interface OfferBody {
  name?: string;
  url_template?: string;
  payout?: unknown;
  is_active?: unknown;
}

interface OfferData {
  name: string;
  url_template: string;
  payout: number;
  is_active: number;
}

function validateBody(
  body: OfferBody,
): { data?: OfferData; error?: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const urlTemplate = typeof body.url_template === 'string' ? body.url_template.trim() : '';
  if (!name) return { error: 'Поле name обязательно' };
  if (!urlTemplate) return { error: 'Поле url_template обязательно' };
  if (!validateTemplate(urlTemplate) || !/^https?:\/\//i.test(urlTemplate)) {
    return { error: 'Некорректный url_template (плейсхолдеры: {click_id}, {sub1}, {sub2}, {sub3}, {offer_id})' };
  }
  const payout = Number(body.payout ?? 0);
  if (!Number.isFinite(payout) || payout < 0) return { error: 'payout должен быть числом >= 0' };
  const isActive = body.is_active === undefined ? 1 : body.is_active ? 1 : 0;
  return { data: { name, url_template: urlTemplate, payout, is_active: isActive } };
}

offersRouter.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM offers ORDER BY id DESC')
    .all();
  res.json(rows);
});

offersRouter.post('/', (req, res) => {
  const { data, error } = validateBody(req.body ?? {});
  if (error || !data) {
    res.status(400).json({ error: error ?? 'Некорректные данные' });
    return;
  }
  const info = db
    .prepare('INSERT INTO offers (name, url_template, payout, is_active, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(data.name, data.url_template, data.payout, data.is_active, now());
  const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(Number(info.lastInsertRowid));
  logger.info({ id: Number(info.lastInsertRowid) }, 'offer created');
  res.status(201).json(row);
});

offersRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id FROM offers WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Оффер не найден' });
    return;
  }
  const { data, error } = validateBody(req.body ?? {});
  if (error || !data) {
    res.status(400).json({ error: error ?? 'Некорректные данные' });
    return;
  }
  db.prepare('UPDATE offers SET name = ?, url_template = ?, payout = ?, is_active = ? WHERE id = ?').run(
    data.name,
    data.url_template,
    data.payout,
    data.is_active,
    id,
  );
  const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
  logger.info({ id }, 'offer updated');
  res.json(row);
});

offersRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM offers WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Оффер не найден' });
    return;
  }
  logger.info({ id }, 'offer deleted');
  res.json({ ok: true });
});