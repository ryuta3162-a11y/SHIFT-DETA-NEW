import { useEffect, useMemo, useState } from 'react';
import { ACCENT_THEMES, applyAccentTheme, readStoredAccentId } from './accentThemes.js';
import { api } from './api.js';

const EMAIL_KEY = 'shiftapp_user_email';

const STATUS_LABEL = {
  work: '勤務',
  off: '公休',
  pto: '有休',
  absent: '欠勤',
  undef: '未定',
};

function initialOf(name) {
  const s = String(name || '?').trim();
  return s ? s.charAt(0) : '?';
}

export default function App() {
  const [accentId, setAccentId] = useState('black');
  const [authStep, setAuthStep] = useState('loading'); // loading | login | ready
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  const [storeId, setStoreId] = useState('');
  const [yearMonth, setYearMonth] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [statusKind, setStatusKind] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    shift_id: '',
    date: '',
    employee_id: '',
    status: 'work',
    start_time: '12:00',
    end_time: '21:00',
    break_minutes: '',
  });

  const accountInitial = useMemo(() => initialOf(user?.name || user?.email), [user]);
  const domain = meta?.companyDomain || 'okamoto-group.co.jp';

  useEffect(() => {
    const id = readStoredAccentId();
    applyAccentTheme(id);
    setAccentId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boot = await api.getBootstrap();
        if (cancelled) return;
        setMeta(boot);
        setYearMonth(boot.serverYearMonth || '');
        if (boot.sessionEmail) setLoginEmail(boot.sessionEmail);
        const saved = localStorage.getItem(EMAIL_KEY) || '';
        if (saved) {
          await login(saved, boot);
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
  }, []);

  async function login(email, bootMeta = meta) {
    setLoginError('');
    setBusy(true);
    try {
      const res = await api.loginWithEmail(email);
      localStorage.setItem(EMAIL_KEY, res.email);
      setUser(res);
      setStoreId(res.stores?.[0]?.store_id || '');
      setYearMonth((bootMeta || meta)?.serverYearMonth || yearMonth);
      setAuthStep('ready');
      setStatusLine('店舗を選んで表示してください。');
      setStatusKind('');
      if (res.stores?.length) {
        await loadShifts(res, res.stores[0].store_id, (bootMeta || meta)?.serverYearMonth || yearMonth);
      }
    } catch (e) {
      setLoginError(e.message || String(e));
      setAuthStep('login');
      localStorage.removeItem(EMAIL_KEY);
    } finally {
      setBusy(false);
    }
  }

  async function loadShifts(currentUser = user, sid = storeId, ym = yearMonth) {
    if (!currentUser?.email || !sid || !ym) {
      setStatusLine('店舗と年月を選んでください。');
      setStatusKind('err');
      return;
    }
    setBusy(true);
    setStatusLine('読み込み中…');
    setStatusKind('');
    try {
      const res = await api.getShifts(sid, ym, currentUser.email);
      setCanEdit(!!res.canEdit);
      setEmployees(res.employees || []);
      setShifts(res.shifts || []);
      setStatusLine(`${res.yearMonth} / ${(res.shifts || []).length}件${res.canEdit ? '（編集可）' : '（閲覧のみ）'}`);
      setStatusKind('ok');
    } catch (e) {
      setStatusLine(e.message || String(e));
      setStatusKind('err');
    } finally {
      setBusy(false);
    }
  }

  function empName(id) {
    return employees.find((e) => e.employee_id === id)?.name || id;
  }

  function resetForm() {
    setForm({
      shift_id: '',
      date: '',
      employee_id: employees[0]?.employee_id || '',
      status: 'work',
      start_time: '12:00',
      end_time: '21:00',
      break_minutes: '',
    });
  }

  async function saveShift() {
    setBusy(true);
    try {
      await api.upsertShift({
        user_email: user.email,
        ...form,
        store_id: storeId,
        start_time: String(form.start_time || '').slice(0, 5),
        end_time: String(form.end_time || '').slice(0, 5),
      });
      resetForm();
      setStatusLine('保存しました');
      setStatusKind('ok');
      await loadShifts();
    } catch (e) {
      setStatusLine(e.message || String(e));
      setStatusKind('err');
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(id) {
    if (!confirm('このシフトを削除しますか？')) return;
    setBusy(true);
    try {
      await api.deleteShift(id, storeId, user.email);
      setStatusLine('削除しました');
      setStatusKind('ok');
      await loadShifts();
    } catch (e) {
      setStatusLine(e.message || String(e));
      setStatusKind('err');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(EMAIL_KEY);
    setUser(null);
    setAccountOpen(false);
    setAuthStep('login');
    setLoginError('');
  }

  const storeName = user?.stores?.find((s) => s.store_id === storeId)?.store_name || '店舗シフト';

  if (authStep === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-[#f2f2f7] flex items-center justify-center text-slate-500 font-semibold">
        読み込み中…
      </div>
    );
  }

  if (authStep === 'login') {
    return (
      <div className="min-h-[100dvh] bg-[#f2f2f7] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -left-10 w-72 h-72 rounded-full bg-[var(--acc-200)] blur-3xl opacity-50" />
        <div className="pointer-events-none absolute bottom-[10%] -right-12 w-56 h-56 rounded-full bg-[var(--acc-100)] blur-3xl opacity-50" />
        <div className="w-full max-w-xl relative z-10 bg-white rounded-2xl border border-[var(--acc-200)]/40 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.18)] p-10 sm:p-12">
          <div className="w-[5.25rem] h-[5.25rem] mx-auto mb-7 rounded-[1.15rem] bg-gradient-to-br from-[var(--acc-400)] to-[var(--acc-700)] text-white text-3xl font-black flex items-center justify-center shadow-xl shadow-[var(--acc-500)]/35 ring-4 ring-white/90">
            S
          </div>
          <p className="text-center text-[11px] font-semibold tracking-[0.28em] text-slate-500 uppercase mb-2.5">Task Force Team</p>
          <h1 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {meta?.appTitle || 'シフト・キンタイ・カレンダー'}
          </h1>
          <p className="text-center text-lg font-bold text-slate-700 mt-5 mb-7">全店シフトを一元管理</p>
          <div className="rounded-2xl bg-gradient-to-b from-[var(--acc-50)]/80 to-white border border-[var(--acc-200)]/50 px-5 py-4 mb-8 text-center text-sm text-slate-600 font-medium leading-relaxed">
            必ず <span className="font-bold text-[var(--acc-700)]">@{domain}</span> のメールでログインしてください。
            <br />「権限」シートに登録済みの方のみ利用できます。
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login(loginEmail);
            }}
          >
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder={`name@${domain}`}
              className="w-full text-center bg-slate-100/90 border-0 rounded-xl px-4 py-4 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--acc-500)]/35"
            />
            {loginError && <p className="text-rose-500 text-sm font-bold text-center whitespace-pre-wrap">{loginError}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-[var(--acc-500)] text-white font-bold shadow-lg shadow-[var(--acc-500)]/25 hover:bg-[var(--acc-600)] disabled:opacity-50"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f2f7]">
      <div className="max-w-4xl mx-auto px-4 py-4 pb-14">
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-500 mb-0.5">Task Force Team</p>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">{user?.appTitle || meta?.appTitle}</h1>
            <p className="text-xs font-semibold text-slate-500">{storeName}</p>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--acc-500)] to-[var(--acc-700)] text-white text-sm font-bold flex items-center justify-center ring-2 ring-white shadow-md"
            >
              {accountInitial}
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={() => setAccountOpen(false)} />
                <div className="absolute right-0 mt-2 w-[min(18rem,92vw)] z-50 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/[0.06] overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex gap-3 items-center">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--acc-500)] to-[var(--acc-700)] text-white font-bold flex items-center justify-center shrink-0">
                      {accountInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-sm">{user?.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3 border-b border-slate-100">
                    <p className="text-[9px] font-black text-[var(--acc-600)] uppercase tracking-widest mb-0.5">権限</p>
                    <p className="text-xs font-bold text-slate-900 mb-3">{user?.isAdmin ? 'admin' : user?.roleMax}</p>
                    <p className="text-[9px] font-black text-[var(--acc-600)] uppercase tracking-widest mb-1">担当店舗</p>
                    <div className="flex flex-wrap gap-1">
                      {(user?.stores || []).map((s) => (
                        <span key={s.store_id} className="bg-gray-100 border border-slate-400 text-slate-900 text-[9px] px-1.5 py-0.5 rounded font-bold">
                          {s.store_name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 py-2.5 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                    <p className="text-[9px] font-black text-[var(--acc-600)] uppercase tracking-widest mb-2">アクセントカラー</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {ACCENT_THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          title={t.label}
                          onClick={() => {
                            applyAccentTheme(t.id);
                            setAccentId(t.id);
                          }}
                          className={`h-8 rounded-lg border-2 ${accentId === t.id ? 'border-black ring-2 ring-black/25' : 'border-slate-200'}`}
                          style={{ background: t['500'] }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold text-center mt-2">
                      現在: <span className="text-[var(--acc-700)]">{ACCENT_THEMES.find((x) => x.id === accentId)?.label}</span>
                    </p>
                  </div>
                  <button type="button" onClick={logout} className="w-full text-left px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50">
                    ログアウト
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <section className="bg-white/95 rounded-2xl border border-[var(--acc-200)]/45 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.08)] p-4 sm:p-5 mb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--acc-600)] min-w-[10rem] flex-1">
              店舗
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-slate-100/90 border-0 rounded-xl px-3 py-3 font-medium text-slate-900"
              >
                {(user?.stores || []).map((s) => (
                  <option key={s.store_id} value={s.store_id}>{s.store_name}{s.area ? `（${s.area}）` : ''}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--acc-600)]">
              年月
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="bg-slate-100/90 border-0 rounded-xl px-3 py-3 font-medium text-slate-900"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => loadShifts()}
              className="px-5 py-3 rounded-2xl bg-[var(--acc-500)] text-white font-bold shadow-lg shadow-[var(--acc-500)]/25 disabled:opacity-50"
            >
              表示
            </button>
          </div>
          <p className={`mt-3 text-sm font-semibold whitespace-pre-wrap ${statusKind === 'err' ? 'text-rose-600' : statusKind === 'ok' ? 'text-emerald-600' : 'text-slate-500'}`}>
            {statusLine}
          </p>
        </section>

        {canEdit && (
          <section className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4 sm:p-5 mb-3">
            <p className="text-sm font-semibold text-[var(--acc-600)] border-b border-slate-200/80 pb-2 mb-3">シフトを追加／更新</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                日付
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                従業員
                <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5">
                  <option value="">選択</option>
                  {employees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>{e.name}{e.is_primary ? '' : '（他店）'}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                区分
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                開始
                <input type="time" disabled={form.status !== 'work'} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5 disabled:opacity-50" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                終了
                <input type="time" disabled={form.status !== 'work'} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5 disabled:opacity-50" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--acc-600)]">
                休憩(分)
                <input type="number" min="0" step="15" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} className="bg-slate-100/90 rounded-xl px-3 py-2.5" placeholder="任意" />
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" disabled={busy} onClick={saveShift} className="px-5 py-3 rounded-2xl bg-[var(--acc-500)] text-white font-bold disabled:opacity-50">保存</button>
              <button type="button" onClick={resetForm} className="px-5 py-3 rounded-2xl bg-white border border-black/5 font-bold text-slate-700">クリア</button>
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-[var(--acc-600)] border-b border-slate-200/80 pb-2 mb-3">シフト一覧</p>
          {!shifts.length ? (
            <p className="text-center text-slate-500 font-semibold py-8 text-sm">この月のシフトはまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 font-bold">
                    <th className="py-2">日付</th>
                    <th className="py-2">従業員</th>
                    <th className="py-2">区分</th>
                    <th className="py-2">時間</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.shift_id} className="border-t border-slate-100">
                      <td className="py-3">{s.date}</td>
                      <td className="py-3">{empName(s.employee_id)}</td>
                      <td className="py-3">
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[var(--acc-50)] text-[var(--acc-700)] border border-black/5">
                          {STATUS_LABEL[s.status] || s.status}
                        </span>
                      </td>
                      <td className="py-3">{s.status === 'work' ? `${s.start_time}–${s.end_time}` : '—'}</td>
                      <td className="py-3 text-right space-x-1">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-black/5"
                              onClick={() => setForm({
                                shift_id: s.shift_id,
                                date: s.date,
                                employee_id: s.employee_id,
                                status: s.status,
                                start_time: s.start_time || '12:00',
                                end_time: s.end_time || '21:00',
                                break_minutes: s.break_minutes ?? '',
                              })}
                            >
                              編集
                            </button>
                            <button type="button" className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white" onClick={() => removeShift(s.shift_id)}>
                              削除
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
