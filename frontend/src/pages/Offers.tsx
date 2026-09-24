import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtMoney, Offer } from '../api/client';
import { Badge, Button, Card, ErrorBanner, Input, Table, Td } from '../components/ui';

const emptyForm = { name: '', url_template: '', payout: '0', is_active: '1' };

export default function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setOffers(await api.offers.list());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(o: Offer) {
    setEditingId(o.id);
    setForm({
      name: o.name,
      url_template: o.url_template,
      payout: String(o.payout),
      is_active: String(o.is_active),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      url_template: form.url_template,
      payout: Number(form.payout),
      is_active: form.is_active === '1' ? 1 : 0,
    };
    try {
      if (editingId !== null) {
        await api.offers.update(editingId, payload);
      } else {
        await api.offers.create(payload);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(o: Offer) {
    if (!window.confirm(`Удалить оффер «${o.name}»?`)) return;
    try {
      await api.offers.remove(o.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Офферы</h1>
      <ErrorBanner message={error} />

      <Card title={editingId !== null ? 'Редактировать оффер' : 'Новый оффер'}>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Название</label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Offer #1" required />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              URL-шаблон <span className="text-slate-400">({'{click_id}'} {'{sub1}'} {'{sub2}'} {'{sub3}'})</span>
            </label>
            <Input
              value={form.url_template}
              onChange={(e) => set('url_template', e.target.value)}
              placeholder="https://offers.example/click?id={click_id}&s1={sub1}"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Payout</label>
            <Input value={form.payout} onChange={(e) => set('payout', e.target.value)} type="number" min="0" step="0.01" required />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.is_active === '1'}
                onChange={(e) => set('is_active', e.target.checked ? '1' : '0')}
                className="accent-indigo-600 w-4 h-4"
              />
              Активен
            </label>
            <div className="flex gap-2">
              <Button type="submit">{editingId !== null ? 'Сохранить' : 'Добавить'}</Button>
              {editingId !== null && (
                <Button variant="ghost" onClick={cancelEdit}>
                  Отмена
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>

      <Card title="Список офферов">
        {loading ? (
          <div className="text-slate-400 text-sm">Загрузка…</div>
        ) : offers.length === 0 ? (
          <div className="text-slate-400 text-sm">Офферов пока нет. Добавьте первый.</div>
        ) : (
          <Table head={['ID', 'Название', 'URL-шаблон', 'Payout', 'Статус', 'Создан', '']}>
            {offers.map((o) => (
              <tr key={o.id}>
                <Td>{o.id}</Td>
                <Td>
                  <span className="font-medium text-slate-800">{o.name}</span>
                </Td>
                <Td className="font-mono text-xs text-slate-500 max-w-md truncate">{o.url_template}</Td>
                <Td>${fmtMoney(o.payout)}</Td>
                <Td>{o.is_active ? <Badge tone="green">активен</Badge> : <Badge tone="gray">выкл</Badge>}</Td>
                <Td>{fmtDate(o.created_at)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => startEdit(o)}>
                      Изменить
                    </Button>
                    <Button variant="danger" onClick={() => remove(o)}>
                      Удалить
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}