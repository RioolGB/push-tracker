import { useEffect, useState } from 'react';
import { api, fmtInt, fmtMoney, GroupRow, Summary } from '../api/client';
import { Badge, Card, ErrorBanner, Select, StatCard, Table, Td } from '../components/ui';

const periods = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: 'custom', label: 'Произвольный' },
];

const groups = [
  { value: 'none', label: 'Без группировки' },
  { value: 'offer', label: 'По офферу' },
  { value: 'sub1', label: 'По sub1' },
  { value: 'day', label: 'По дню' },
];

export default function Dashboard() {
  const [period, setPeriod] = useState('today');
  const [groupBy, setGroupBy] = useState('offer');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    params.set('group_by', groupBy);
    if (period === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    setLoading(true);
    api
      .stats(params)
      .then((data) => {
        if ('summary' in data && data.summary) {
          setSummary(data.summary);
          setRows(data.rows ?? []);
        } else {
          setSummary(data as Summary);
          setRows([]);
        }
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [period, groupBy, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Дашборд</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40">
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-44">
            {groups.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
          {period === 'custom' && (
            <>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading && <div className="text-slate-400 text-sm">Загрузка…</div>}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Клики" value={fmtInt(summary.clicks)} />
            <StatCard label="Конверсии (approved)" value={fmtInt(summary.conversions)} tone="green" />
            <StatCard label="Payout" value={`$${fmtMoney(summary.payout)}`} />
            <StatCard label="Spend" value={`$${fmtMoney(summary.spend)}`} />
            <StatCard label="eCPM" value={`$${fmtMoney(summary.ecpm)}`} />
            <StatCard
              label="ROI"
              value={`${Math.round(summary.roi)}%`}
              tone={summary.roi >= 0 ? 'green' : 'red'}
            />
          </div>

          {rows.length > 0 && (
            <Card title={groupLabel(groupBy)}>
              <Table head={['Показатель', 'Клики', 'Конверсии', 'Payout', 'Spend', 'eCPM', 'ROI']}>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <Td>
                      <span className="font-medium text-slate-800">{r.name}</span>
                      {groupBy === 'sub1' && (r.key === '(empty)' || r.key === '') && (
                        <Badge tone="gray">нет sub1</Badge>
                      )}
                    </Td>
                    <Td>{fmtInt(r.clicks)}</Td>
                    <Td>{fmtInt(r.conversions)}</Td>
                    <Td>${fmtMoney(r.payout)}</Td>
                    <Td>${fmtMoney(r.spend)}</Td>
                    <Td>${fmtMoney(r.ecpm)}</Td>
                    <Td className={r.roi >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {Math.round(r.roi)}%
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {rows.length === 0 && groupBy !== 'none' && (
            <Card>
              <div className="text-slate-400 text-sm">Нет данных за выбранный период.</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function groupLabel(g: string): string {
  switch (g) {
    case 'offer':
      return 'Статистика по офферам';
    case 'sub1':
      return 'Статистика по sub1';
    case 'day':
      return 'Статистика по дням';
    default:
      return 'Статистика';
  }
}