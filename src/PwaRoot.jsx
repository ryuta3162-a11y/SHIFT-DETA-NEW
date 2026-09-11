import { lazy, Suspense, useEffect, useState } from 'react';
import { applyAccentTheme, readStoredAccentId } from './accentThemes.js';
import { api } from './api.js';
import { isStandaloneApp } from './pwaEnv.js';
import { StaffInstallFirst } from './StaffInstallFirst.jsx';
import { StaffLoginShell } from './StaffLoginShell.jsx';
import { STAFF_CODE_KEY, STAFF_TOKEN_KEY } from './staffAuth.js';

const StaffApp = lazy(() => import('./StaffApp.jsx').then((m) => ({ default: m.StaffApp })));

function initialPhase() {
  if (!isStandaloneApp()) return 'install';
  return localStorage.getItem(STAFF_TOKEN_KEY) ? 'loading' : 'login';
}

/** PWA：インストール → ログイン → 閲覧 */
export default function PwaRoot() {
  const [phase, setPhase] = useState(initialPhase); // install | loading | login | app
  const [user, setUser] = useState(null);
  const [storeId, setStoreId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('処理中…');

  const storeName = user?.stores?.find((s) => s.store_id === storeId)?.store_name || '';

  useEffect(() => {
    applyAccentTheme(readStoredAccentId());
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    let cancelled = false;
    (async () => {
      const staffToken = localStorage.getItem(STAFF_TOKEN_KEY) || '';
      if (!staffToken) {
        setPhase('login');
        return;
      }
      try {
        await resumeStaffSession(staffToken);
      } catch (e) {
        if (cancelled) return;
        setLoginError(e.message || String(e));
        setPhase('login');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function applyStaffUser(res) {
    localStorage.setItem(STAFF_TOKEN_KEY, res.sessionToken);
    localStorage.setItem(STAFF_CODE_KEY, res.bye_code);
    setUser(res);
    setStoreId(res.stores?.[0]?.store_id || '');
    setPhase('app');
    setLoginError('');
  }

  async function resumeStaffSession(token) {
    setLoginError('');
    setBusyText('ログイン中…');
    setBusy(true);
    try {
      const res = await api.staffResumeSession(token);
      applyStaffUser(res);
    } catch (e) {
      localStorage.removeItem(STAFF_TOKEN_KEY);
      localStorage.removeItem(STAFF_CODE_KEY);
      setLoginError(e.message || String(e));
      setPhase('login');
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function staffVerify(code, name) {
    setBusyText('確認中…');
    setBusy(true);
    try {
      return await api.staffVerifyIdentity(code, name);
    } finally {
      setBusy(false);
    }
  }

  async function staffSetPassword(code, name, password) {
    setLoginError('');
    setBusyText('登録中…');
    setBusy(true);
    try {
      const res = await api.staffSetPassword(code, name, password);
      applyStaffUser(res);
    } catch (e) {
      setLoginError(e.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function staffLogin(code, password) {
    setLoginError('');
    setBusyText('ログイン中…');
    setBusy(true);
    try {
      const res = await api.staffLogin(code, password);
      applyStaffUser(res);
    } catch (e) {
      setLoginError(e.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function staffLogout() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_CODE_KEY);
    setUser(null);
    setStoreId('');
    setLoginError('');
    setPhase('login');
  }

  if (phase === 'install') {
    return <StaffInstallFirst />;
  }

  if (phase === 'loading') {
    return (
      <div className="boot" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 700 }}>
        ログイン中…
      </div>
    );
  }

  if (phase === 'app') {
    return (
      <Suspense fallback={<div className="boot" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 700 }}>読み込み中…</div>}>
        <StaffApp
          user={user}
          storeId={storeId}
          storeName={storeName}
          onLogout={staffLogout}
        />
      </Suspense>
    );
  }

  return (
    <StaffLoginShell
      busy={busy}
      busyText={busyText}
      error={loginError}
      onVerify={staffVerify}
      onSetPassword={staffSetPassword}
      onLogin={staffLogin}
    />
  );
}
