import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtMoney, Offer, Spend } from '../api/client';
import { Button, Card, ErrorBanner, Input, Select, Table, Td } from '../components/ui';

export default function SpendPage() {
  const [rows, setRows] = useState<Spend[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [sub1, setSub1] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [spends, offerList] = await Promise.all([api.spend.list(), api.offers.list()]);
      setRows(spends);
      setOffers(offerList);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.spend.save({
        offer_id: offerId ? Number(offerId) : null,
        sub1: sub1.trim() || undefined,
        amount: Number(amount),
      });
      setAmount('');
      setSub1('');
      setOfferId('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Удалить запись spend?')) return;
    try {
      await api.spend.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Spend (затраты на трафик)</h1>
      <p className="text-sm text-slate-500 -mt-3">
        Используется для расчёта ROI. Можно указать затраты на оффер в целом, на sub1 или «общие» (без указания).
      </p>
      <ErrorBanner message={error} />

      <Card title="Добавить / обновить затраты">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Оффер</label>
            <Select value={offerId} onChange={(e) => setOfferId(e.target.value)} className="w-52">
              <option value="">Общие затраты</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">sub1 (необязательно)</label>
            <Input value={sub1} onChange={(e) => setSub1(e.target.value)} placeholder="eva_123" className="w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Сумма</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" className="w-36" required />
          </div>
          <Button type="submit">Сохранить</Button>
        </form>
      </Card>

      <Card title={`Затраты (${rows.length})`}>
        {loading ? (
          <div className="text-slate-400 text-sm">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="text-slate-400 text-sm">Затраты ещё не заданы.</div>
        ) : (
          <Table head={['ID', 'Оффер', 'sub1', 'Сумма', 'Создан', '']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{r.id}</Td>
                <Td>{r.offer_name ?? <span className="text-slate-400">(общие)</span>}</Td>
                <Td>{r.sub1 ?? '—'}</Td>
                <Td className="font-medium">${fmtMoney(r.amount)}</Td>
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