import { Router } from 'express';
import db, { now } from '../../db/index.js';
import logger from '../../logger.js';

export const spendRouter = Router();

interface SpendBody {
  offer_id?: unknown;
  sub1?: unknown;
  amount?: unknown;
}

spendRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.offer_id, o.name AS offer_name, s.sub1, s.amount, s.created_at
       FROM spends s
       LEFT JOIN offers o ON o.id = s.offer_id
       ORDER BY s.id DESC`,
    )
    .all();
  res.json(rows);
});

function validateSpend(body: SpendBody) {
  const offerId = body.offer_id === '' || body.offer_id === null || body.offer_id === undefined
    ? null
    : Number(body.offer_id);
  const sub1 = typeof body.sub1 === 'string' && body.sub1.trim()
    ? body.sub1.trim()
    : null;
  const amount = Number(body.amount ?? 0);
  if (offerId !== null && (!Number.isInteger(offerId) || offerId <= 0)) {
    return { error: 'Некорректный offer_id' };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'amount должен быть числом >= 0' };
  }
  return { data: { offerId, sub1, amount } };
}

spendRouter.post('/', (req, res) => {
  const { data, error } = validateSpend(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }

  // upsert по (offer_id, sub1): null считается отдельным ключом
  const existing = db
    .prepare('SELECT id, amount FROM spends WHERE offer_id IS ? AND sub1 IS ?')
    .get(data!.offerId, data!.sub1) as { id: number; amount: number } | undefined;

  let row;
  if (existing) {
    db.prepare('UPDATE spends SET amount = ? WHERE id = ?').run(data!.amount, existing.id);
    row = db.prepare('SELECT * FROM spends WHERE id = ?').get(existing.id);
  } else {
    const info = db
      .prepare('INSERT INTO spends (offer_id, sub1, amount, created_at) VALUES (?, ?, ?, ?)')
      .run(data!.offerId, data!.sub1, data!.amount, now());
    row = db.prepare('SELECT * FROM spends WHERE id = ?').get(Number(info.lastInsertRowid));
  }
  if (!row) {
    res.status(500).json({ error: 'Не удалось сохранить запись' });
    return;
  }
  logger.info({ id: row.id }, 'spend saved');
  res.json(row);
});

spendRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM spends WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Запись не найдена' });
    return;
  }
  res.json({ ok: true });
});