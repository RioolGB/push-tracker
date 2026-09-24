import { useEffect, useState } from 'react';
import { api, Conversion, fmtDate, fmtInt, fmtMoney, Offer } from '../api/client';
import { Badge, Card, ErrorBanner, Select, Table, Td } from '../components/ui';

const statuses = [
  '',
  'approved',
  'pending',
  'rejected',
];

export default function Conversions() {
  const [rows, setRows] = useState<Conversion[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<URLSearchParams>(new URLSearchParams());

  useEffect(() => {
    api.offers
      .list()
      .then(setOffers)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .conversions(filters)
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (offerId) params.set('offer_id', offerId);
    if (status) params.set('status', status);
    setFilters(params);
  }

  function tone(s: string) {
    switch (s) {
      case 'approved':
        return 'green' as const;
      case 'pending':
        return 'amber' as const;
      case 'rejected':
        return 'red' as const;
      default:
        return 'gray' as const;
    }
  }

  function label(s: string) {
    switch (s) {
      case 'approved':
        return 'approved';
      case 'pending':
        return 'pending';
      case 'rejected':
        return 'rejected';
      default:
        return s;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Конверсии</h1>
      <ErrorBanner message={error} />

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Оффер</label>
            <Select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="w-44">
              <option value="">Все</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Статус</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">Все</option>
              {statuses.slice(1).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <button
            onClick={applyFilters}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            Применить
          </button>
        </div>
      </Card>

      <Card title={`Конверсии (${fmtInt(rows.length)})`}>
        {loading ? (
          <div className="text-slate-400 text-sm">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="text-slate-400 text-sm">Конверсий нет.</div>
        ) : (
          <Table head={['ID', 'Click ID', 'Оффер', 'Payout', 'Статус', 'External ID', 'sub1', 'Дата']}>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-xs">{c.id}</Td>
                <Td className="font-mono text-xs">{c.click_id}</Td>
                <Td>{c.offer_name ?? `#${c.offer_id}`}</Td>
                <Td>${fmtMoney(c.payout)}</Td>
                <Td>
                  <Badge tone={tone(c.status)}>{label(c.status)}</Badge>
                </Td>
                <Td className="font-mono text-xs">{c.external_id ?? '—'}</Td>
                <Td>{c.sub1 ?? '—'}</Td>
                <Td>{fmtDate(c.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}