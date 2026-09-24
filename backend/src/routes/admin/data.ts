import { Router } from 'express';
import db from '../../db/index.js';

export const dataRouter = Router();

function buildWhere(query: Record<string, unknown>, params: (string | number)[]): string {
  const clauses: string[] = [];
  if (query.offer_id) {
    clauses.push('c.offer_id = ?');
    params.push(Number(query.offer_id));
  }
  if (query.sub1 || query.sub1 === '') {
    clauses.push('c.sub1 = ?');
    params.push(String(query.sub1));
  }
  if (query.from) {
    clauses.push('c.created_at >= ?');
    params.push(String(query.from).replace('T', ' '));
  }
  if (query.to) {
    clauses.push('c.created_at <= ?');
    params.push(String(query.to).replace('T', ' '));
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

dataRouter.get('/clicks', (req, res) => {
  const params: (string | number)[] = [];
  const where = buildWhere(req.query, params);
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db
    .prepare(
      `SELECT c.id, c.offer_id, o.name AS offer_name, c.ip, c.user_agent, c.referer, c.country,
              c.sub1, c.sub2, c.sub3, c.redirected, c.created_at
       FROM clicks c
       LEFT JOIN offers o ON o.id = c.offer_id
       ${where}
       ORDER BY c.id DESC
       LIMIT ${limit}`,
    )
    .all(...params);
  res.json(rows);
});

dataRouter.get('/conversions', (req, res) => {
  const params: (string | number)[] = [];
  const clauses: string[] = [];
  if (req.query.offer_id) {
    clauses.push('cv.offer_id = ?');
    params.push(Number(req.query.offer_id));
  }
  if (req.query.status) {
    clauses.push('cv.status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.click_id) {
    clauses.push('cv.click_id = ?');
    params.push(Number(req.query.click_id));
  }
  if (req.query.from) {
    clauses.push('cv.created_at >= ?');
    params.push(String(req.query.from).replace('T', ' '));
  }
  if (req.query.to) {
    clauses.push('cv.created_at <= ?');
    params.push(String(req.query.to).replace('T', ' '));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db
    .prepare(
      `SELECT cv.id, cv.click_id, cv.offer_id, o.name AS offer_name, cv.payout, cv.status,
              cv.external_id, cv.created_at, c.ip, c.sub1, c.sub2, c.sub3
       FROM conversions cv
       LEFT JOIN clicks c ON c.id = cv.click_id
       LEFT JOIN offers o ON o.id = cv.offer_id
       ${where}
       ORDER BY cv.id DESC
       LIMIT ${limit}`,
    )
    .all(...params);
  res.json(rows);
});