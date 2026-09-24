import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, fmtDate, ListEntry } from '../api/client';
import { Badge, Button, Card, ErrorBanner, Input, Select, Table, Td } from '../components/ui';

interface Props {
  kind: 'blacklist' | 'whitelist';
}

export default function ListPage({ kind }: Props) {
  const [rows, setRows] = useState<ListEntry[]>([]);
  const [type, setType] = useState<'ip' | 'subnet'>('ip');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = kind === 'blacklist' ? await api.blacklist.list() : await api.whitelist.list();
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload: { type: 'ip' | 'subnet'; value: string; reason?: string; expires_at?: string } = {
        type,
        value,
      };
      if (kind === 'blacklist' && reason.trim()) payload.reason = reason.trim();
      if (kind === 'blacklist' && expiresAt) payload.expires_at = expiresAt;
      if (kind === 'blacklist') {
        await api.blacklist.add(payload);
      } else {
        await api.whitelist.add({ type, value });
      }
      setValue('');
      setReason('');
      setExpiresAt('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Удалить запись?')) return;
    try {
      if (kind === 'blacklist') await api.blacklist.remove(id);
      else await api.whitelist.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isBlack = kind === 'blacklist';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">{isBlack ? 'Блек-лист' : 'Вайт-лист'}</h1>
      <ErrorBanner message={error} />

      <Card title="Добавить запись">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Тип</label>
            <Select value={type} onChange={(e) => setType(e.target.value as 'ip' | 'subnet')} className="w-36">
              <option value="ip">IP</option>
              <option value="subnet">Подсеть (CIDR)</option>
            </Select>
          </div>
          <div className="min-w-52 flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Значение</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'ip' ? '192.168.1.55' : '192.168.1.0/24'}
              required
            />
          </div>
          {isBlack && (
            <div className="min-w-52 flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Причина (необязательно)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Спам, rate limit…" />
            </div>
          )}
          {isBlack && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Срок действия (необязательно)</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-52"
              />
            </div>
          )}
          <Button type="submit">Добавить</Button>
        </form>
      </Card>

      <Card title={`Записи (${rows.length})`}>
        {loading ? (
          <div className="text-slate-400 text-sm">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="text-slate-400 text-sm">Список пуст.</div>
        ) : (
          <Table head={['ID', 'Тип', 'Значение', isBlack ? 'Причина' : undefined, isBlack ? 'Действует до' : undefined, 'Создан', ''].filter(Boolean) as string[]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{r.id}</Td>
                <Td>{r.type === 'subnet' ? <Badge tone="blue">subnet</Badge> : <Badge>IP</Badge>}</Td>
                <Td className="font-mono">{r.value}</Td>
                {isBlack && <Td>{r.reason || '—'}</Td>}
                {isBlack && (
                  <Td>
                    {r.expires_at ? (
                      <span className="text-amber-600">{fmtDate(r.expires_at)}</span>
                    ) : (
                      <Badge tone="gray">бессрочно</Badge>
                    )}
                  </Td>
                )}
                <Td>{fmtDate(r.created_at)}</Td>
                <Td>
                  <Button variant="danger" onClick={() => remove(r.id)}>
                    Удалить
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}