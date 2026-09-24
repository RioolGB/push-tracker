import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Offers from './pages/Offers';
import ListPage from './pages/ListPage';
import Clicks from './pages/Clicks';
import Conversions from './pages/Conversions';
import Spend from './pages/Spend';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    api
      .me()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('fail'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        Проверка авторизации…
      </div>
    );
  }
  return status === 'ok' ? <>{children}</> : <Navigate to="/login" replace />;
}

function UnauthorizedRedirect() {
  const location = useLocation();

  useEffect(() => {
    const handler = () => {
      // Не перезагружать, если мы уже на странице входа — иначе вечный цикл.
      if (location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('pt:unauthorized', handler);
    return () => window.removeEventListener('pt:unauthorized', handler);
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <UnauthorizedRedirect />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="offers" element={<Offers />} />
          <Route path="blacklist" element={<ListPage key="blacklist" kind="blacklist" />} />
          <Route path="whitelist" element={<ListPage key="whitelist" kind="whitelist" />} />
          <Route path="clicks" element={<Clicks />} />
          <Route path="conversions" element={<Conversions />} />
          <Route path="spend" element={<Spend />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => (window.location.href = '/'))
      .catch(() => setChecked(true));
  }, []);

  if (!checked) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Загрузка…</div>;
  }
  return <>{children}</>;
}