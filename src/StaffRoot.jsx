import { useEffect, useState } from 'react';
import { applyAccentTheme, readStoredAccentId } from './accentThemes.js';
import { api } from './api.js';
import { LoginLoadingPanel } from './LoginHero.jsx';
import { StaffApp } from './StaffApp.jsx';
import { StaffLoginShell } from './StaffLoginShell.jsx';
import { needsInstallGate, StaffInstallFirst } from './StaffInstallFirst.jsx';
import { STAFF_CODE_KEY, STAFF_TOKEN_KEY } from './staffAuth.js';

export default function StaffRoot() {
  const [installDone, setInstallDone] = useState(() => !needsInstallGate());
  const [authStep, setAuthStep] = useState('loading');
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('処理中…');
  const [storeId, setStoreId] = useState('');
  const [yearMonth, setYearMonth] = useState('');

  const storeName = user?.stores?.find((s) => s.store_id === storeId)?.store_name || '';

  useEffect(() => {
    applyAccentTheme(readStoredAccentId());
  }, []);

  useEffect(() => {
    if (!installDone) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const boot = await api.getBootstrap();
        if (cancelled) return;
        setMeta(boot);
        setYearMonth(boot.serverYearMonth || '');
        const staffToken = localStorage.getItem(STAFF_TOKEN_KEY) || '';
        if (staffToken) {
          await resumeStaffSession(staffToken, boot);
        } else {
          setAuthStep('login');
        }
      } catch (e) {
        if (cancelled) return;
        setLoginError(e.message || String(e));
        setAuthStep('login');
      }
    })();
    return () => { cancelled = true; };
  }, [installDone]);

  async function withBusy(label, fn) {
    setBusyText(label || '処理中…');
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  function applyStaffUser(res, bootMeta = meta) {
    localStorage.setItem(STAFF_TOKEN_KEY, res.sessionToken);
    localStorage.setItem(STAFF_CODE_KEY, res.bye_code);
    setUser(res);
    const firstStore = res.stores?.[0]?.store_id || '';
    setStoreId(firstStore);
    setYearMonth(bootMeta?.serverYearMonth || yearMonth);
    setAuthStep('staff_ready');
    setLoginError('');
  }

  async function resumeStaffSession(token, bootMeta = meta) {
    setLoginError('');
    setBusyText('ログイン中…');
    setBusy(true);
    try {
      const res = await api.staffResumeSession(token);
      applyStaffUser(res, bootMeta);
    } catch (e) {
      localStorage.removeItem(STAFF_TOKEN_KEY);
      localStorage.removeItem(STAFF_CODE_KEY);
      setLoginError(e.message || String(e));
      setAuthStep('login');
    } finally {
      setBusy(false);
    }
  }

  async function staffVerify(code, name) {
    return withBusy('確認中…', () => api.staffVerifyIdentity(code, name));
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

  function logout() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_CODE_KEY);
    setUser(null);
    setStoreId('');
    setAuthStep('login');
    setLoginError('');
  }

  if (!installDone) {
    return <StaffInstallFirst onContinue={() => setInstallDone(true)} />;
  }

  if (authStep === 'loading') {
    return (
      <div className="login-hero">
        <div className="login-hero-inner login-hero-inner--splash">
          <LoginLoadingPanel />
        </div>
      </div>
    );
  }

  if (authStep === 'login') {
    return (
      <StaffLoginShell
        busy={busy}
        busyText={busyText}
        error={loginError}
        onVerify={staffVerify}
        onSetPassword={staffSetPassword}
        onLogin={staffLogin}
        onSwitchManager={() => {}}
      />
    );
  }

  if (authStep === 'staff_ready') {
    return (
      <StaffApp
        user={user}
        storeId={storeId}
        storeName={storeName}
        onLogout={logout}
      />
    );
  }

  return null;
}
