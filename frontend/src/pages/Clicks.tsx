import { useEffect, useState } from 'react';
import { api, Click, fmtDate, fmtInt, Offer } from '../api/client';
import { Card, ErrorBanner, Input, Select, Table, Td } from '../components/ui';

export default function Clicks() {
  const [clicks, setClicks] = useState<Click[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [sub1, setSub1] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
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
      .clicks(filters)
      .then((data) => {
        setClicks(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (offerId) params.set('offer_id', offerId);
    if (sub1.trim()) params.set('sub1', sub1.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setFilters(params);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Клики</h1>
      <ErrorBanner message={error} />

      <Card>
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Оффер</label>
            <Select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="w-40">
              <option value="">Все</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">sub1</label>
            <Input value={sub1} onChange={(e) => setSub1(e.target.value)} placeholder="eva_123" className="w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">От</label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="w-52" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">До</label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="w-52" />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            Применить
          </button>
        </form>
      </Card>

      <Card title={`Последние клики (${fmtInt(clicks.length)})`}>
        {loading ? (
          <div className="text-slate-400 text-sm">Загрузка…</div>
        ) : clicks.length === 0 ? (
          <div className="text-slate-400 text-sm">Кликов с такими фильтрами нет.</div>
        ) : (
          <Table
            head={['ID', 'Оффер', 'IP', 'sub1', 'sub2', 'sub3', 'User-Agent', 'Дата']}
          >
            {clicks.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-xs">{c.id}</Td>
                <Td>{c.offer_name ?? `#${c.offer_id}`}</Td>
                <Td className="font-mono text-xs">{c.ip}</Td>
                <Td>{c.sub1 ?? '—'}</Td>
                <Td>{c.sub2 ?? '—'}</Td>
                <Td>{c.sub3 ?? '—'}</Td>
                <Td className="max-w-xs truncate text-xs text-slate-500">{c.user_agent ?? '—'}</Td>
                <Td>{fmtDate(c.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}