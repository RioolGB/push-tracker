export interface Offer {
  id: number;
  name: string;
  url_template: string;
  payout: number;
  is_active: number;
  created_at: string;
}

export interface Click {
  id: number;
  offer_id: number;
  offer_name: string | null;
  ip: string;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  redirected: number;
  created_at: string;
}

export interface Conversion {
  id: number;
  click_id: number;
  offer_id: number;
  offer_name: string | null;
  payout: number;
  status: 'approved' | 'pending' | 'rejected';
  external_id: string | null;
  created_at: string;
  ip: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
}

export interface ListEntry {
  id: number;
  type: 'ip' | 'subnet';
  value: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Spend {
  id: number;
  offer_id: number | null;
  offer_name: string | null;
  sub1: string | null;
  amount: number;
  created_at: string;
}

export interface Summary {
  clicks: number;
  conversions: number;
  payout: number;
  spend: number;
  ecpm: number;
  roi: number;
  period: { from: string; to: string };
  group_by: 'none' | 'offer' | 'sub1' | 'day';
}

export interface GroupRow extends Omit<Summary, 'period' | 'group_by'> {
  key: string;
  name: string;
}

export interface StatsResponse {
  summary?: Summary;
  rows?: GroupRow[];
}

async function request<T>(path: string, options: RequestInit = {}, opts: { silent401?: boolean } = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });

  if (res.status === 401 && !opts.silent401) {
    // Событие только когда сессия протухла посреди работы. Проверки логина
    // (me/login) обрабатываются самими страницами — иначе на /login возникает
    // бесконечный цикл перезагрузки.
    window.dispatchEvent(new CustomEvent('pt:unauthorized'));
    throw new ApiError('Сессия истекла', 401);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const api = {
  login: (password: string) => request<{ ok: boolean }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }, { silent401: true }),
  logout: () => request<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  me: () => request<{ ok: boolean; authenticated: boolean }>('/admin/me', {}, { silent401: true }),

  stats: (params: URLSearchParams) => request<Summary | StatsResponse>(`/admin/stats?${params.toString()}`),

  offers: {
    list: () => request<Offer[]>('/admin/offers'),
    create: (data: Partial<Offer>) => request<Offer>('/admin/offers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Offer>) => request<Offer>(`/admin/offers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/admin/offers/${id}`, { method: 'DELETE' }),
  },

  blacklist: {
    list: () => request<ListEntry[]>('/admin/blacklist'),
    add: (data: Partial<ListEntry> & { value: string; type: 'ip' | 'subnet' }) =>
      request<ListEntry>('/admin/blacklist', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/admin/blacklist/${id}`, { method: 'DELETE' }),
  },

  whitelist: {
    list: () => request<ListEntry[]>('/admin/whitelist'),
    add: (data: { value: string; type: 'ip' | 'subnet' }) =>
      request<ListEntry>('/admin/whitelist', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/admin/whitelist/${id}`, { method: 'DELETE' }),
  },

  clicks: (params: URLSearchParams) => request<Click[]>(`/admin/clicks?${params.toString()}`),
  conversions: (params: URLSearchParams) => request<Conversion[]>(`/admin/conversions?${params.toString()}`),

  spend: {
    list: () => request<Spend[]>('/admin/spend'),
    save: (data: { offer_id: number | null; sub1?: string; amount: number }) =>
      request<Spend>('/admin/spend', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/admin/spend/${id}`, { method: 'DELETE' }),
  },
};

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function fmtInt(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}