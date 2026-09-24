import db from '../db/index.js';

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
export type GroupBy = 'offer' | 'sub1' | 'day' | 'none';

/** Форматирует локальную дату в строку SQLite (UTC-мгновение). */
function fmtLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function periodRange(period: Period, from?: string, to?: string): { from: string; to: string } {
  const nowLocal = new Date();
  const todayStart = startOfDay(nowLocal);

  switch (period) {
    case 'today': {
      const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      return { from: fmtLocal(todayStart), to: fmtLocal(end) };
    }
    case 'yesterday': {
      const from = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      return { from: fmtLocal(from), to: fmtLocal(todayStart) };
    }
    case '7d':
      return { from: fmtLocal(new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)), to: fmtLocal(nowLocal) };
    case '30d':
      return { from: fmtLocal(new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000)), to: fmtLocal(nowLocal) };
    case 'custom': {
      const f = from ? from.replace('T', ' ') : '1970-01-01 00:00:00';
      const t = to ? to.replace('T', ' ') : fmtLocal(nowLocal);
      return { from: f, to: t };
    }
    default:
      return { from: '1970-01-01 00:00:00', to: fmtLocal(nowLocal) };
  }
}

export interface Summary {
  clicks: number;
  conversions: number;
  payout: number;
  spend: number;
  ecpm: number;
  roi: number;
  period: { from: string; to: string };
  group_by: GroupBy;
}

export interface GroupRow extends Omit<Summary, 'period' | 'group_by'> {
  key: string;
  name: string;
}

function computeDerived(clicks: number, conversions: number, payout: number, spend: number) {
  const ecpm = clicks > 0 ? Math.round((payout / clicks) * 1000 * 100) / 100 : 0;
  const roi = spend > 0 ? Math.round(((payout - spend) / spend) * 100 * 100) / 100 : 0;
  return { clicks, conversions, payout: Math.round(payout * 100) / 100, spend, ecpm, roi };
}

const summaryQuery = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM clicks WHERE created_at BETWEEN @from AND @to) AS clicks,
    (SELECT COUNT(*) FROM conversions WHERE status = 'approved' AND created_at BETWEEN @from AND @to) AS conversions,
    (SELECT COALESCE(SUM(payout),0) FROM conversions WHERE status = 'approved' AND created_at BETWEEN @from AND @to) AS payout
`);
const spendQuery = db.prepare('SELECT COALESCE(SUM(amount),0) AS spend FROM spends');

export function getSummary(period: Period, from?: string, to?: string, groupBy: GroupBy = 'none'): Summary {
  const { from: f, to: t } = periodRange(period, from, to);
  const row = summaryQuery.get({ from: f, to: t }) as { clicks: number; conversions: number; payout: number };
  const spend = (spendQuery.get() as { spend: number }).spend || 0;
  return { ...computeDerived(row.clicks, row.conversions, row.payout, spend), period: { from: f, to: t }, group_by: groupBy };
}

export function getStats(period: Period, from?: string, to?: string, groupBy: GroupBy = 'none'): Summary | { summary: Summary; rows: GroupRow[] } {
  const { from: f, to: t } = periodRange(period, from, to);

  if (groupBy === 'none') {
    return getSummary(period, from, to, groupBy);
  }

  const rows = groupedRows(groupBy, f, t);
  const summary = getSummary(period, from, to, groupBy);
  return { summary, rows };
}

function groupedRows(groupBy: GroupBy, from: string, to: string): GroupRow[] {
  if (groupBy === 'day') {
    const rows = db
      .prepare(`
        SELECT substr(c.created_at, 1, 10) AS key,
               COUNT(*) AS clicks,
               COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN 1 ELSE 0 END), 0) AS conversions,
               COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN cv.payout ELSE 0 END), 0) AS payout
        FROM clicks c
        LEFT JOIN conversions cv ON cv.click_id = c.id
        WHERE c.created_at BETWEEN ? AND ?
        GROUP BY substr(c.created_at, 1, 10)
        ORDER BY key DESC
      `)
      .all(from, to) as { key: string; clicks: number; conversions: number; payout: number }[];
    return rows.map((r) => {
      const derived = computeDerived(r.clicks, r.conversions, r.payout, totalSpend(r.key));
      return { ...derived, key: r.key, name: r.key };
    });
  }

  if (groupBy === 'offer') {
    const rows = db
      .prepare(`
        SELECT COALESCE(c.offer_id, 0) AS key,
               COALESCE(o.name, 'unknown') AS name,
               COUNT(*) AS clicks,
               COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN 1 ELSE 0 END), 0) AS conversions,
               COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN cv.payout ELSE 0 END), 0) AS payout
        FROM clicks c
        LEFT JOIN conversions cv ON cv.click_id = c.id
        LEFT JOIN offers o ON o.id = c.offer_id
        WHERE c.created_at BETWEEN ? AND ?
        GROUP BY c.offer_id
        ORDER BY clicks DESC
      `)
      .all(from, to) as { key: number; name: string; clicks: number; conversions: number; payout: number }[];
    return rows.map((r) => {
      const key = String(r.key);
      const derived = computeDerived(r.clicks, r.conversions, r.payout, spendForOffer(Number(r.key)));
      return { ...derived, key, name: r.name };
    });
  }

  // groupBy === 'sub1'
  const rows = db
    .prepare(`
      SELECT COALESCE(c.sub1, '(empty)') AS key,
             COUNT(*) AS clicks,
             COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN 1 ELSE 0 END), 0) AS conversions,
             COALESCE(SUM(CASE WHEN cv.status = 'approved' THEN cv.payout ELSE 0 END), 0) AS payout
      FROM clicks c
      LEFT JOIN conversions cv ON cv.click_id = c.id
      WHERE c.created_at BETWEEN ? AND ?
      GROUP BY c.sub1
      ORDER BY clicks DESC
    `)
    .all(from, to) as { key: string; clicks: number; conversions: number; payout: number }[];
  return rows.map((r) => {
    const derived = computeDerived(r.clicks, r.conversions, r.payout, spendForSub1(r.key === '(empty)' ? '' : r.key));
    return { ...derived, key: r.key, name: r.key };
  });
}

function spendForOffer(offerId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM spends WHERE offer_id = ? OR offer_id IS NULL')
    .get(offerId) as { s: number };
  return row.s || 0;
}

function spendForSub1(sub1: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM spends WHERE sub1 = ? OR sub1 IS NULL')
    .get(sub1) as { s: number };
  return row.s || 0;
}

function totalSpend(_day: string): number {
  return (db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM spends').get() as { s: number }).s || 0;
}