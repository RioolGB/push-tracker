import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';

const nav = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/offers', label: 'Офферы', end: false },
  { to: '/blacklist', label: 'Блек-лист', end: false },
  { to: '/whitelist', label: 'Вайт-лист', end: false },
  { to: '/clicks', label: 'Клики', end: false },
  { to: '/conversions', label: 'Конверсии', end: false },
  { to: '/spend', label: 'Spend', end: false },
];

export default function Layout() {
  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 py-5 text-lg font-bold text-white tracking-tight">
          Push<span className="text-indigo-400">Tracker</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}