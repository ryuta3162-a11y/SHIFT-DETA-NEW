import { useEffect, useMemo, useState } from 'react';
import { BrandTitle } from './BrandTitle.jsx';
import { APP_TAGLINE } from './appBrand.js';
import { api } from './api.js';
import { IconLoginArrow, LoginBgDecor } from './LoginHero.jsx';

const EMAIL_KEY = 'shiftapp_user_email';

const FALLBACK_STORES = [
  { store_id: 'S001', store_name: '経堂', area: '第7エリア', territory: '' },
  { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア', territory: '' },
];

/** 社員：この画面だけで登録／ログイン完結 */
export function ManagerLoginShell({
  busy,
  busyText,
  error,
  domain = 'okamoto-group.co.jp',
  stores: storesProp,
  areas: areasProp,
  onRegister,
  onLogin,
  onBack,
}) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '');
  const [displayName, setDisplayName] = useState('');
  const [byeCode, setByeCode] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [localError, setLocalError] = useState('');
  const [loadedStores, setLoadedStores] = useState(null);
  const [loadedAreas, setLoadedAreas] = useState(null);
  const [storesLoading, setStoresLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const propCount = Array.isArray(storesProp) ? storesProp.length : 0;
    if (propCount > 2) {
      setLoadedStores(storesProp);
      setLoadedAreas(areasProp || null);
      return undefined;
    }
    setStoresLoading(true);
    (async () => {
      try {
        const boot = await api.getBootstrap();
        if (cancelled) return;
        const list = Array.isArray(boot.allStores) ? boot.allStores : [];
        if (list.length) {
          setLoadedStores(list);
          setLoadedAreas(boot.areas || null);
        }
      } catch (e) {
        /* keep fallback */
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storesProp, areasProp]);

  const catalog = useMemo(() => {
    if (Array.isArray(loadedStores) && loadedStores.length) return loadedStores;
    if (Array.isArray(storesProp) && storesProp.length) return storesProp;
    return FALLBACK_STORES;
  }, [loadedStores, storesProp]);

  const areas = useMemo(() => {
    const src = (Array.isArray(loadedAreas) && loadedAreas.length)
      ? loadedAreas
      : (Array.isArray(areasProp) && areasProp.length ? areasProp : null);
    if (src) return src;
    const seen = {};
    const out = [];
    catalog.forEach((s) => {
      const a = String(s.area || '').trim();
      if (!a || seen[a]) return;
      seen[a] = true;
      out.push(a);
    });
    return out.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [loadedAreas, areasProp, catalog]);

  const territories = useMemo(() => {
    const filtered = selectedArea ? catalog.filter((s) => s.area === selectedArea) : catalog;
    const seen = {};
    const out = [];
    filtered.forEach((s) => {
      const t = String(s.territory || '').trim();
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [catalog, selectedArea]);

  const visibleStores = useMemo(() => catalog.filter((s) => {
    if (selectedArea && s.area !== selectedArea) return false;
    if (selectedTerritory && s.territory !== selectedTerritory) return false;
    return true;
  }), [catalog, selectedArea, selectedTerritory]);

  const err = localError || error;
  const storeHint = storesLoading
    ? '店舗一覧を読み込み中…'
    : (catalog.length <= 2
      ? '店舗データがまだ読めません。再読み込みしてください。'
      : `${catalog.length}店（店舗データ）`);

  function toggleStore(id) {
    setSelectedStores((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLocalError('');
    const em = String(email || '').trim();
    const name = String(displayName || '').trim();
    const code = String(byeCode || '').trim();
    if (!em) { setLocalError('メールアドレスを入力してください'); return; }
    if (!code) { setLocalError('社員番号を入力してください'); return; }
    if (!selectedStores.length) { setLocalError('管轄店舗を1つ以上選んでください'); return; }
    try {
      await onRegister({
        email: em,
        display_name: name || em.split('@')[0],
        bye_code: code,
        store_ids: selectedStores,
      });
    } catch (ex) {
      setLocalError(ex.message || String(ex));
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLocalError('');
    const em = String(email || '').trim();
    if (!em) { setLocalError('メールアドレスを入力してください'); return; }
    try {
      await onLogin(em);
    } catch (ex) {
      setLocalError(ex.message || String(ex));
    }
  }

  return (
    <div className="staff-login-shell">
      <div className="staff-login-shell__bg" aria-hidden="true">
        <LoginBgDecor />
      </div>

      {busy && (
        <div className="staff-login-shell__overlay">
          <div className="staff-login-shell__spinner" />
          <p>{busyText || '処理中…'}</p>
        </div>
      )}

      <div className="staff-login-shell__inner">
        <header className="staff-login-shell__hero">
          <BrandTitle size="compact" />
          <p className="staff-login-shell__tagline">{APP_TAGLINE}</p>
        </header>

        <div className="staff-login-shell__card">
          <div className="login-card-float login-card-float--scroll">
            <p className="pwa-role-back">
              <button type="button" className="pwa-role-back__btn" onClick={onBack}>
                ← ログイン種別を選び直す
              </button>
            </p>

            <div className="login-mode-tabs mt-2 mb-1">
              <button
                type="button"
                className={`login-mode-tab ${mode === 'register' ? 'login-mode-tab--on' : ''}`}
                onClick={() => { setMode('register'); setLocalError(''); }}
              >
                登録
              </button>
              <button
                type="button"
                className={`login-mode-tab ${mode === 'login' ? 'login-mode-tab--on' : ''}`}
                onClick={() => { setMode('login'); setLocalError(''); }}
              >
                ログイン
              </button>
            </div>

            <h2 className="login-card-title">{mode === 'register' ? '社員登録' : 'ログイン'}</h2>
            <p className="login-card-sub mt-2">
              {mode === 'register' ? 'この画面だけで登録が完了します' : '登録済みの会社メールでログイン'}
            </p>

            {mode === 'register' ? (
              <form className="space-y-3.5 mt-5" onSubmit={handleRegister}>
                <div>
                  <label className="login-form-label" htmlFor="mgr-reg-email">メールアドレス</label>
                  <input id="mgr-reg-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${domain}`} className="login-form-input" />
                </div>
                <div>
                  <label className="login-form-label" htmlFor="mgr-reg-name">表示名（フルネーム）</label>
                  <input id="mgr-reg-name" type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="日下 竜汰" className="login-form-input" />
                </div>
                <div>
                  <label className="login-form-label" htmlFor="mgr-reg-code">社員番号</label>
                  <input id="mgr-reg-code" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} required value={byeCode} onChange={(e) => setByeCode(e.target.value)} placeholder="304642" className="login-form-input" />
                </div>
                {areas.length > 0 && (
                  <div>
                    <label className="login-form-label" htmlFor="mgr-reg-area">エリア（絞り込み）</label>
                    <select id="mgr-reg-area" className="login-form-input" value={selectedArea} onChange={(e) => { setSelectedArea(e.target.value); setSelectedTerritory(''); }}>
                      <option value="">すべて</option>
                      {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}
                {territories.length > 0 && (
                  <div>
                    <label className="login-form-label" htmlFor="mgr-reg-territory">テリトリー（絞り込み）</label>
                    <select id="mgr-reg-territory" className="login-form-input" value={selectedTerritory} onChange={(e) => setSelectedTerritory(e.target.value)}>
                      <option value="">すべて</option>
                      {territories.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <p className="login-form-label">管轄店舗（タップして選択）</p>
                  <p className="text-[12px] text-slate-500 font-semibold mt-0.5 mb-1.5">{storeHint}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5 max-h-40 overflow-y-auto">
                    {visibleStores.length === 0 ? (
                      <p className="text-[13px] text-slate-500 font-semibold">該当する店舗がありません</p>
                    ) : visibleStores.map((s) => {
                      const on = selectedStores.includes(s.store_id);
                      return (
                        <button
                          key={s.store_id}
                          type="button"
                          onClick={() => toggleStore(s.store_id)}
                          className={`px-3.5 py-2 rounded-xl text-[14px] font-bold border ${
                            on ? 'bg-[#039be5] text-white border-[#039be5]' : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {s.store_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {err && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{err}</p>}
                <button type="submit" disabled={busy || storesLoading} className="login-submit">
                  <span>{busy ? '登録中…' : '登録して始める'}</span>
                  <IconLoginArrow />
                </button>
              </form>
            ) : (
              <form className="space-y-4 mt-5" onSubmit={handleLogin}>
                <div>
                  <label className="login-form-label" htmlFor="mgr-login-email">メールアドレス</label>
                  <input id="mgr-login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${domain}`} className="login-form-input" />
                </div>
                {err && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{err}</p>}
                <button type="submit" disabled={busy} className="login-submit">
                  <span>{busy ? 'ログイン中…' : 'ログイン'}</span>
                  <IconLoginArrow />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
