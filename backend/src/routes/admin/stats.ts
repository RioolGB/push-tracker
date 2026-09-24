import { Router } from 'express';
import { getStats, Period, GroupBy } from '../../services/statsService.js';

export const statsRouter = Router();

statsRouter.get('/', (req, res) => {
  const period = (String(req.query.period || 'today')) as Period;
  const groupBy = (String(req.query.group_by || 'none')) as GroupBy;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  const validPeriods: Period[] = ['today', 'yesterday', '7d', '30d', 'custom'];
  const validGroups: GroupBy[] = ['none', 'offer', 'sub1', 'day'];
  if (!validPeriods.includes(period) || !validGroups.includes(groupBy)) {
    res.status(400).json({ error: 'Некорректные period/group_by' });
    return;
  }

  res.json(getStats(period, from, to, groupBy));
});