import { Router } from 'express';
import { listService } from '../../services/listService.js';
import { isValidListValue } from '../../utils/subnet.js';
import logger from '../../logger.js';

export const listsRouter = Router();

function mkEntryTracker(kind: 'blacklist' | 'whitelist') {
  return {
    list: () => (kind === 'blacklist' ? listService.listBlacklist() : listService.listWhitelist()),
add: (type: string, value: string, reason?: string | null, expiresAt?: string | null) =>
      kind === 'blacklist'
        ? listService.addBlacklist(type, value, reason, expiresAt)
        : listService.addWhitelist(type, value),
    remove: (id: number) => (kind === 'blacklist' ? listService.removeBlacklist(id) : listService.removeWhitelist(id)),
  };
}

function validateListBody(body: { type?: string; value?: string; reason?: string | null; expires_at?: string | null }) {
  const type = body.type === 'subnet' ? 'subnet' : 'ip';
  const value = typeof body.value === 'string' ? body.value.trim() : '';
  if (!value) return { error: 'Поле value обязательно' };
  if (!isValidListValue(value, type)) {
    return { error: type === 'ip' ? 'Некорректный IP-адрес' : 'Некорректный IP или подсеть (CIDR)' };
  }
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
  let expiresAt: string | null = null;
  if (body.expires_at) {
    const d = new Date(String(body.expires_at));
    if (Number.isNaN(d.getTime())) return { error: 'Некорректное expires_at' };
    expiresAt = d.toISOString().replace('T', ' ').slice(0, 19);
  }
  return { data: { type, value, reason, expiresAt } };
}

for (const kind of ['blacklist', 'whitelist'] as const) {
  const tracker = mkEntryTracker(kind);

  listsRouter.get(`/${kind}`, (_req, res) => {
    res.json(tracker.list());
  });

  listsRouter.post(`/${kind}`, (req, res) => {
    const { data, error } = validateListBody(req.body ?? {});
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const row = tracker.add(data!.type, data!.value, data!.reason, data!.expiresAt);
    logger.info({ kind, value: data!.value }, `${kind} entry added`);
    res.status(201).json(row);
  });

  listsRouter.delete(`/${kind}/:id`, (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const ok = tracker.remove(id);
    if (!ok) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    logger.info({ kind, id }, `${kind} entry removed`);
    res.json({ ok: true });
  });
}