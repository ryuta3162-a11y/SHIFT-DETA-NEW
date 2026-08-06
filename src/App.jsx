import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { applyAccentTheme } from './accentThemes.js';
import { api } from './api.js';

const EMAIL_KEY = 'shiftapp_user_email';
const STATUS_LABEL = { work: '勤務', off: '公休', pto: '有休', absent: '欠勤', undef: '未定' };
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** 土日テキスト色（アクセントカラーとは独立） */
function weekdayTextClass(wd) {
  if (wd === 0) return 'text-red-600';
  if (wd === 6) return 'text-blue-600';
  return 'text-slate-700';
}

function initialOf(name) {
  const s = String(name || '?').trim();
  return s ? s.charAt(0) : '?';
}

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

function toYmDay(ym, day) {
  return `${ym}-${pad2(day)}`;
}

function shiftYearMonth(ym, deltaMonths) {
  const parts = String(ym || '').split('-').map(Number);
  if (!parts[0] || !parts[1]) return ym;
  const d = new Date(parts[0], parts[1] - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function formatYmJa(ym) {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return '';
  return `${y}年${Number(m)}月`;
}

/** 0:00〜24:00 を step 分刻みで生成 */
function buildTimeOptions(stepMin = 30) {
  const step = stepMin === 15 ? 15 : 30;
  const out = [];
  for (let total = 0; total <= 24 * 60; total += step) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 24 && m > 0) break;
    out.push(`${pad2(h)}:${pad2(m)}`);
    if (h === 24) break;
  }
  return out;
}

function snapToStep(hm, stepMin = 30) {
  const step = stepMin === 15 ? 15 : 30;
  const raw = String(hm || '').slice(0, 5);
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return step === 15 ? '12:00' : '12:00';
  let total = Number(m[1]) * 60 + Number(m[2]);
  if (Number.isNaN(total)) return '12:00';
  total = Math.max(0, Math.min(24 * 60, Math.round(total / step) * step));
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${pad2(h)}:${pad2(mm)}`;
}

function visibleDaysForRange(daysInMonth, range) {
  if (!daysInMonth) return [];
  let from = 1;
  let to = daysInMonth;
  if (range === '1-10') {
    from = 1;
    to = Math.min(10, daysInMonth);
  } else if (range === '11-20') {
    from = Math.min(11, daysInMonth);
    to = Math.min(20, daysInMonth);
    if (from > to) return [];
  } else if (range === '21-end') {
    from = Math.min(21, daysInMonth);
    to = daysInMonth;
    if (from > to) return [];
  }
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const DAY_RANGE_OPTIONS = [
  { id: '1-10', label: '1–10' },
  { id: '11-20', label: '11–20' },
  { id: '21-end', label: '21–末' },
  { id: 'all', label: 'オール' },
];

const SHIFT_STATUS_OPTIONS = [
  { id: 'work', label: '勤務' },
  { id: 'off', label: '公休' },
  { id: 'pto', label: '有休' },
  { id: 'absent', label: '欠勤' },
  { id: 'undef', label: '未定' },
];

/** アルバイト勤務時間の選択肢（時間） */
const PART_HOUR_OPTIONS = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
const TIME_STEP_MIN = 30;
/** 社員: 実働8h + 休憩1h = 拘束9h */
const FULLTIME_SPAN_HOURS = 9;

function normalizeEmpType(type) {
  const t = String(type || '社員').trim();
  if (t === 'パート' || t === 'アルバイト') return 'アルバイト';
  return '社員';
}

function isFullTimeEmp(emp) {
  return normalizeEmpType(emp?.employment_type) === '社員';
}

function spanHoursForEmp(emp) {
  if (isFullTimeEmp(emp)) return FULLTIME_SPAN_HOURS;
  const wh = Number(emp?.work_hours);
  return wh > 0 ? wh : 4;
}

function addHoursToHm(hm, hours) {
  const snapped = snapToStep(hm || '12:00', TIME_STEP_MIN);
  const m = snapped.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '21:00';
  let total = Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(hours) * 60);
  if (total > 24 * 60) total = 24 * 60;
  if (total < 0) total = 0;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function workTimesFromIn(emp, inHm) {
  const start = snapToStep(inHm || '12:00', TIME_STEP_MIN);
  const end = addHoursToHm(start, spanHoursForEmp(emp));
  return { status: 'work', start_time: start, end_time: end };
}

function statusBadgeClass(status) {
  switch (status) {
    case 'work': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'off': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'pto': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'absent': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

const card = 'bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4 sm:p-5';
const btnPrimary = 'px-5 py-3 rounded-2xl bg-[var(--acc-500)] text-white font-bold shadow-lg shadow-[var(--acc-500)]/25 disabled:opacity-50';
const btnSecondary = 'px-5 py-3 rounded-2xl bg-white border border-black/5 font-bold text-slate-700 disabled:opacity-50';
const inputCls = 'bg-slate-100/90 border-0 rounded-xl px-3 py-3 font-medium text-slate-900 w-full';
const labelCls = 'flex flex-col gap-1.5 text-xs font-semibold text-[var(--acc-600)]';

export default function App() {
  const [authStep, setAuthStep] = useState('loading'); // loading | login | ready
  const [page, setPage] = useState('home'); // home | jurisdiction | employees | weekly | monthly
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('処理中…');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState('');

  const [storeId, setStoreId] = useState('');
  const [yearMonth, setYearMonth] = useState('');

  // jurisdiction form
  const [displayName, setDisplayName] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);

  // employees
  const [employees, setEmployees] = useState([]);
  const [empForm, setEmpForm] = useState({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 });

  // weekly
  const [weekly, setWeekly] = useState([]); // map-like array
  const [weeklyEmpId, setWeeklyEmpId] = useState('');

  // monthly grid
  const [shifts, setShifts] = useState([]);
  const [memos, setMemos] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [dirtyMemoKeys, setDirtyMemoKeys] = useState(() => new Set());
  const [focusCell, setFocusCell] = useState(null); // { employee_id, date, layer?: 'shift'|'memo' }
  const [dayRange, setDayRange] = useState('1-10'); // 1-10 | 11-20 | 21-end | all
  const [shiftEditor, setShiftEditor] = useState(null); // { employee_id, date }
  const [empEditorId, setEmpEditorId] = useState(null); // employee_id — 左列クイック編集
  const sheetAreaRef = useRef(null);
  const [colPx, setColPx] = useState(72);

  const accountInitial = useMemo(() => initialOf(user?.name || user?.email), [user]);
  const domain = meta?.companyDomain || 'okamoto-group.co.jp';
  const storeName = user?.stores?.find((s) => s.store_id === storeId)?.store_name || '';

  useEffect(() => {
    applyAccentTheme('black');
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
        if (saved) await login(saved, boot);
        else setAuthStep('login');
      } catch (e) {
        if (cancelled) return;
        setLoginError(e.message || String(e));
        setAuthStep('login');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function notify(text, kind = '') {
    setMsg(text);
    setMsgKind(kind);
  }

  async function withBusy(label, fn) {
    setBusyText(label || '処理中…');
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  async function login(email, bootMeta = meta) {
    setLoginError('');
    setBusyText('ログイン中…');
    setBusy(true);
    try {
      const res = await api.loginWithEmail(email);
      localStorage.setItem(EMAIL_KEY, res.email);
      setUser(res);
      setDisplayName(res.name || '');
      const firstStore = res.stores?.[0]?.store_id || '';
      const ym = (bootMeta || meta)?.serverYearMonth || yearMonth;
      setStoreId(firstStore);
      setYearMonth(ym);
      setAuthStep('ready');
      if (res.needsJurisdiction) {
        setPage('jurisdiction');
        notify('管轄店舗を登録してください。');
      } else if (firstStore && ym) {
        setBusyText('月間シフトを準備中…');
        const shiftRes = await api.getShifts(firstStore, ym, res.email);
        setEmployees(shiftRes.employees || []);
        setShifts(shiftRes.shifts || []);
        setMemos(shiftRes.memos || []);
        setCanEdit(!!shiftRes.canEdit);
        setDirtyKeys(new Set());
        setDirtyMemoKeys(new Set());
        setFocusCell(null);
        setShiftEditor(null);
        setEmpEditorId(null);
        setPage('monthly');
        notify('ログインしました', 'ok');
      } else {
        setPage('jurisdiction');
        notify('管轄店舗を登録してください。');
      }
    } catch (e) {
      setLoginError(e.message || String(e));
      setAuthStep('login');
      localStorage.removeItem(EMAIL_KEY);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(EMAIL_KEY);
    setUser(null);
    setAccountOpen(false);
    setAuthStep('login');
    setPage('monthly');
    setLoginError('');
  }

  const areaStores = useMemo(() => {
    const all = user?.allStores || [];
    if (!selectedArea) return all;
    return all.filter((s) => s.area === selectedArea);
  }, [user, selectedArea]);

  function toggleStore(id) {
    setSelectedStores((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveJurisdiction() {
    const name = String(displayName || '').trim();
    if (!name) {
      notify('表示名（フルネーム）を入力してください。', 'err');
      return;
    }
    if (!selectedStores.length) {
      notify('管轄店舗を1つ以上選んでください。', 'err');
      return;
    }
    try {
      await withBusy('保存中…', async () => {
        const res = await api.saveJurisdiction({
          user_email: user.email,
          display_name: name,
          store_ids: selectedStores,
          role: 'editor',
        });
        setUser(res);
        setStoreId(res.stores?.[0]?.store_id || '');
        const ym = meta?.serverYearMonth || yearMonth;
        setYearMonth(ym);
        notify(user?.needsJurisdiction ? '初回登録が完了しました' : '管轄店舗を保存しました', 'ok');
        const sid = res.stores?.[0]?.store_id || '';
        if (sid && ym) {
          setBusyText('月間シフトを準備中…');
          const shiftRes = await api.getShifts(sid, ym, res.email || user.email);
          setEmployees(shiftRes.employees || []);
          setShifts(shiftRes.shifts || []);
          setMemos(shiftRes.memos || []);
          setCanEdit(!!shiftRes.canEdit);
          setDirtyKeys(new Set());
          setDirtyMemoKeys(new Set());
          setPage('monthly');
        } else {
          setPage('monthly');
        }
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function loadEmployees(sid = storeId, opts = {}) {
    if (!user?.email || !sid) return;
    const run = async () => {
      const res = await api.listEmployees(sid, user.email);
      setEmployees(res.employees || []);
      setCanEdit(!!res.canEdit);
    };
    try {
      if (opts.quiet) await run();
      else await withBusy('読み込み中…', run);
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function saveEmployee() {
    try {
      await withBusy('従業員を保存中…', async () => {
        await api.upsertEmployee({
          user_email: user.email,
          store_id: storeId,
          ...empForm,
        });
        setEmpForm({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 });
        await loadEmployees(storeId, { quiet: true });
        notify('従業員を保存しました', 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function loadWeekly(sid = storeId, opts = {}) {
    if (!user?.email || !sid) return;
    const run = async () => {
      const res = await api.getWeeklySchedule(sid, user.email);
      setEmployees(res.employees || []);
      setWeekly(res.weekly || []);
      setCanEdit(!!res.canEdit);
      if (!weeklyEmpId && res.employees?.[0]) setWeeklyEmpId(res.employees[0].employee_id);
    };
    try {
      if (opts.quiet) await run();
      else await withBusy('読み込み中…', run);
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function weeklyCell(empId, weekday) {
    return weekly.find((w) => w.employee_id === empId && Number(w.weekday) === weekday) || {
      employee_id: empId, weekday, status: 'undef', start_time: '12:00', end_time: '21:00',
    };
  }

  function setWeeklyCell(empId, weekday, patch) {
    setWeekly((prev) => {
      const idx = prev.findIndex((w) => w.employee_id === empId && Number(w.weekday) === weekday);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [...prev, { employee_id: empId, weekday, status: 'undef', start_time: '12:00', end_time: '21:00', ...patch }];
    });
  }

  async function saveWeekly() {
    try {
      await withBusy('週間スケジュールを保存中…', async () => {
        const items = [];
        employees.forEach((e) => {
          for (let wd = 0; wd <= 6; wd++) {
            const cell = weeklyCell(e.employee_id, wd);
            items.push({
              employee_id: e.employee_id,
              weekday: wd,
              status: cell.status || 'undef',
              start_time: cell.start_time || '',
              end_time: cell.end_time || '',
              break_minutes: cell.break_minutes ?? '',
            });
          }
        });
        const res = await api.saveWeeklySchedule({ user_email: user.email, store_id: storeId, items });
        setWeekly(res.weekly || []);
        // 保存した週間を、表示中の月へテンプレ反映（未編集日のみ）
        if (yearMonth) {
          try {
            await api.generateMonthlyShifts({
              user_email: user.email,
              store_id: storeId,
              year_month: yearMonth,
              overwrite: false,
            });
          } catch {
            // 月未選択やパターンなしは無視
          }
        }
        notify('週間スケジュールを保存しました。月間を開くとテンプレが入ります。', 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function loadMonthly(sid = storeId, ym = yearMonth, opts = {}) {
    if (!user?.email || !sid || !ym) return;
    const run = async () => {
      // getShifts 側で週間テンプレを自動展開（空き・未定のみ）
      const res = await api.getShifts(sid, ym, user.email);
      setEmployees(res.employees || []);
      setShifts(res.shifts || []);
      setMemos(res.memos || []);
      setCanEdit(!!res.canEdit);
      setDirtyKeys(new Set());
      setDirtyMemoKeys(new Set());
      setFocusCell(null);
      const applied = res.appliedFromWeekly;
      if (!opts.quiet) {
        if (applied?.reason === 'already_filled') {
          notify(`${ym} / ${(res.shifts || []).length}件`, 'ok');
        } else if (applied?.applied && applied.created) {
          notify(`${ym}：週間テンプレを反映（${applied.created}件）`, 'ok');
        } else if (applied && applied.applied === false && applied.reason === 'no_weekly') {
          notify('週間スケジュールが未保存です。先に週間で ○／× を保存してください。', 'err');
        } else if (applied && applied.applied === false && applied.reason === 'no_pattern') {
          notify('週間で出勤○／休み×を設定して保存してください。', 'err');
        } else {
          notify(`${ym} / ${(res.shifts || []).length}件`, 'ok');
        }
      }
    };
    try {
      if (opts.quiet) await run();
      else await withBusy('月間を準備中…', run);
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function resetMonthFromWeekly() {
    if (!confirm('この月を週間テンプレでやり直します（個別の修正は消えます）。よろしいですか？')) return;
    try {
      await withBusy('週間テンプレでやり直しています…', async () => {
        const res = await api.generateMonthlyShifts({
          user_email: user.email,
          store_id: storeId,
          year_month: yearMonth,
          overwrite: true,
        });
        setEmployees(res.employees || []);
        setShifts(res.shifts || []);
        setMemos(res.memos || []);
        setCanEdit(!!res.canEdit);
        setDirtyKeys(new Set());
        setDirtyMemoKeys(new Set());
        const g = res.generated || {};
        notify(`週間テンプレで再作成しました（${g.created || 0}件）`, 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function copyByeBye() {
    if (!user?.email || !storeId || !yearMonth) {
      notify('店舗と年月を選んでください。', 'err');
      return;
    }
    try {
      await withBusy('バイバイ形式を作成中…', async () => {
        const res = await api.buildByeByePaste(storeId, yearMonth, user.email);
        const text = res.tsv || '';
        if (!text) throw new Error('コピーするデータが空です。');

        let copied = false;
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }

        const warn = (res.warnings || []).length ? `\n注意: ${res.warnings.join(' / ')}` : '';
        notify(
          (copied ? 'バイバイ形式をコピーしました。Ctrl+V で貼り付けできます。' : 'コピーに失敗しました。スプシ「バイバイ貼り付け」を直接コピーしてください。') +
            `\n対象 ${res.staffCount} 名 / ${res.rowCount} 行` +
            (res.wroteSheet ? '（シートにも出力済み）' : '') +
            warn,
          copied ? 'ok' : 'err'
        );
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function shiftKey(employeeId, date) {
    return `${employeeId}__${date}`;
  }

  function getCellShift(employeeId, date) {
    return shiftMap.get(shiftKey(employeeId, date)) || {
      shift_id: '',
      employee_id: employeeId,
      date,
      status: 'undef',
      start_time: '',
      end_time: '',
    };
  }

  function getCellMemo(employeeId, date) {
    return memoMap.get(shiftKey(employeeId, date)) || {
      memo_id: '',
      employee_id: employeeId,
      date,
      store_id: storeId,
      kind: 'note',
      title: '',
      body: '',
    };
  }

  function patchCellLocal(employeeId, date, patch) {
    const key = shiftKey(employeeId, date);
    setShifts((prev) => {
      const idx = prev.findIndex((s) => s.employee_id === employeeId && s.date === date);
      const base = idx >= 0
        ? prev[idx]
        : { shift_id: '', employee_id: employeeId, date, store_id: storeId, status: 'undef', start_time: '', end_time: '' };
      let nextRow = { ...base, ...patch };
      if (nextRow.status === 'work') {
        if (!nextRow.start_time) nextRow = { ...nextRow, start_time: '12:00' };
        if (!nextRow.end_time) nextRow = { ...nextRow, end_time: '21:00' };
      } else if (patch.status && patch.status !== 'work') {
        nextRow = { ...nextRow, start_time: '', end_time: '' };
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = nextRow;
        return next;
      }
      return [...prev, nextRow];
    });
    setDirtyKeys((prev) => {
      const n = new Set(prev);
      n.add(key);
      return n;
    });
  }

  function patchMemoLocal(employeeId, date, body) {
    const key = shiftKey(employeeId, date);
    setMemos((prev) => {
      const idx = prev.findIndex((m) => m.employee_id === employeeId && m.date === date);
      const base = idx >= 0
        ? prev[idx]
        : { memo_id: '', employee_id: employeeId, date, store_id: storeId, kind: 'note', title: '', body: '' };
      const nextRow = { ...base, body: String(body ?? ''), kind: base.kind || 'note' };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = nextRow;
        return next;
      }
      return [...prev, nextRow];
    });
    setDirtyMemoKeys((prev) => {
      const n = new Set(prev);
      n.add(key);
      return n;
    });
  }

  function openShiftEditor(employeeId, date) {
    if (!canEdit || busy) return;
    setEmpEditorId(null);
    setFocusCell({ employee_id: employeeId, date, layer: 'shift' });
    setShiftEditor({ employee_id: employeeId, date });
  }

  function closeShiftEditor() {
    setShiftEditor(null);
  }

  function openEmpEditor(employeeId) {
    if (!canEdit || busy) return;
    setShiftEditor(null);
    setEmpEditorId(employeeId);
  }

  function closeEmpEditor() {
    setEmpEditorId(null);
  }

  /** 従業員区分・時間を更新し、当月の勤務セル OUT も再計算 */
  async function updateEmployeeProfile(employeeId, patch) {
    if (!user?.email || !canEdit) return;
    const emp = employees.find((x) => x.employee_id === employeeId);
    if (!emp) return;

    let next = { ...emp, ...patch };
    const typ = normalizeEmpType(next.employment_type);
    if (typ === '社員') {
      next = { ...next, employment_type: '社員', work_hours: '' };
    } else {
      const wh = Number(next.work_hours);
      next = {
        ...next,
        employment_type: 'アルバイト',
        work_hours: wh > 0 ? wh : 4,
      };
    }

    setEmployees((prev) => prev.map((e) => (e.employee_id === employeeId ? next : e)));

    const ym = yearMonth;
    setShifts((prev) => {
      const nextShifts = prev.map((s) => {
        if (s.employee_id !== employeeId || s.status !== 'work') return s;
        if (ym && String(s.date || '').slice(0, 7) !== ym) return s;
        const times = workTimesFromIn(next, s.start_time || '12:00');
        return { ...s, start_time: times.start_time, end_time: times.end_time };
      });
      return nextShifts;
    });
    setDirtyKeys((prev) => {
      const n = new Set(prev);
      (shifts || []).forEach((s) => {
        if (s.employee_id !== employeeId || s.status !== 'work') return;
        if (ym && String(s.date || '').slice(0, 7) !== ym) return;
        n.add(shiftKey(s.employee_id, s.date));
      });
      return n;
    });

    try {
      await api.upsertEmployee({
        user_email: user.email,
        store_id: storeId,
        employee_id: next.employee_id,
        name: next.name,
        bye_code: next.bye_code,
        employment_type: next.employment_type,
        work_hours: next.employment_type === 'アルバイト' ? next.work_hours : '',
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function applyEditorStatus(status) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    if (status === 'work') {
      const cur = getCellShift(eid, date);
      patchCellLocal(eid, date, workTimesFromIn(emp, cur.start_time || '12:00'));
    } else {
      patchCellLocal(eid, date, { status, start_time: '', end_time: '' });
    }
  }

  function applyEditorIn(value) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    patchCellLocal(eid, date, workTimesFromIn(emp, value));
  }

  async function applyEditorPartHours(hours) {
    if (!shiftEditor) return;
    await updateEmployeeProfile(shiftEditor.employee_id, {
      employment_type: 'アルバイト',
      work_hours: hours,
    });
  }

  async function saveDirtyShifts() {
    const shiftCount = dirtyKeys.size;
    const memoCount = dirtyMemoKeys.size;
    if (!shiftCount && !memoCount) {
      notify('変更はありません');
      return;
    }
    const shiftItems = shiftCount
      ? [...dirtyKeys].map((key) => {
          const [employeeId, date] = key.split('__');
          const s = shifts.find((row) => row.employee_id === employeeId && row.date === date) || {
            shift_id: '', status: 'undef', start_time: '', end_time: '',
          };
          const status = s.status || 'undef';
          return {
            shift_id: s.shift_id || '',
            employee_id: employeeId,
            date,
            status,
            start_time: status === 'work' ? String(s.start_time || '').slice(0, 5) : '',
            end_time: status === 'work' ? String(s.end_time || '').slice(0, 5) : '',
          };
        })
      : [];
    const memoItems = memoCount
      ? [...dirtyMemoKeys].map((key) => {
          const [employeeId, date] = key.split('__');
          const m = memos.find((row) => row.employee_id === employeeId && row.date === date) || {
            memo_id: '', body: '',
          };
          return {
            memo_id: m.memo_id || '',
            employee_id: employeeId,
            date,
            kind: 'note',
            body: String(m.body || ''),
          };
        })
      : [];
    try {
      await withBusy(`変更を保存中…（シフト${shiftCount}・メモ${memoCount}）`, async () => {
        let savedShift = 0;
        let savedMemo = 0;
        let latestMemos = memos;
        if (shiftItems.length) {
          const res = await api.upsertShiftsBatch({
            user_email: user.email,
            store_id: storeId,
            items: shiftItems,
          });
          setEmployees(res.employees || employees);
          setShifts(res.shifts || []);
          if (res.memos) latestMemos = res.memos;
          setCanEdit(!!res.canEdit);
          setDirtyKeys(new Set());
          savedShift = res.saved || shiftItems.length;
        }
        if (memoItems.length) {
          const res = await api.upsertMemosBatch({
            user_email: user.email,
            store_id: storeId,
            items: memoItems,
          });
          latestMemos = res.memos || latestMemos;
          setDirtyMemoKeys(new Set());
          savedMemo = (res.saved || 0) + (res.deleted || 0);
        }
        setMemos(latestMemos);
        notify(`保存しました（シフト${savedShift}・メモ${savedMemo}）`, 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function cellLabel(status) {
    switch (status) {
      case 'work': return '勤務';
      case 'off': return '公休';
      case 'pto': return '有休';
      case 'absent': return '欠勤';
      default: return '—';
    }
  }

  function cellTone(status, weekendBg) {
    switch (status) {
      case 'work': return 'bg-emerald-50 text-emerald-900';
      case 'off': return 'bg-orange-50 text-orange-900';
      case 'pto': return 'bg-amber-50 text-amber-900';
      case 'absent': return 'bg-rose-50 text-rose-900';
      default: return weekendBg;
    }
  }

  const [ymYear, ymMonth] = (yearMonth || '').split('-');
  const daysInMonth = ymYear && ymMonth ? new Date(Number(ymYear), Number(ymMonth), 0).getDate() : 0;
  const shiftMap = useMemo(() => {
    const map = new Map();
    (shifts || []).forEach((s) => map.set(`${s.employee_id}__${s.date}`, s));
    return map;
  }, [shifts]);
  const memoMap = useMemo(() => {
    const map = new Map();
    (memos || []).forEach((m) => map.set(`${m.employee_id}__${m.date}`, m));
    return map;
  }, [memos]);
  const dirtyTotal = dirtyKeys.size + dirtyMemoKeys.size;
  const visibleDays = useMemo(
    () => visibleDaysForRange(daysInMonth, dayRange),
    [daysInMonth, dayRange],
  );
  const timeOptions = useMemo(() => buildTimeOptions(TIME_STEP_MIN), []);

  useEffect(() => {
    const el = sheetAreaRef.current;
    if (!el || page !== 'monthly') return undefined;
    const update = () => {
      const nameW = 140;
      const avail = Math.max(120, el.clientWidth - nameW);
      const n = Math.max(1, visibleDays.length);
      const minW = dayRange === 'all' ? 40 : 64;
      const maxW = dayRange === 'all' ? 56 : 110;
      const w = Math.min(maxW, Math.max(minW, Math.floor(avail / n)));
      setColPx(w);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [page, dayRange, visibleDays.length, employees.length]);

  const editorShift = shiftEditor
    ? getCellShift(shiftEditor.employee_id, shiftEditor.date)
    : null;
  const editorEmp = shiftEditor
    ? (employees.find((x) => x.employee_id === shiftEditor.employee_id) || null)
    : null;
  const editorEmpName = editorEmp?.name || '';
  const editorOutAuto = editorEmp && editorShift
    ? addHoursToHm(editorShift.start_time || '12:00', spanHoursForEmp(editorEmp))
    : '';
  const empEditor = empEditorId
    ? (employees.find((x) => x.employee_id === empEditorId) || null)
    : null;

  async function changeMonth(targetYm) {
    if (!targetYm || targetYm === yearMonth) return;
    if (dirtyKeys.size || dirtyMemoKeys.size) {
      if (!confirm('未保存の変更があります。破棄して月を切り替えますか？')) return;
      setDirtyKeys(new Set());
      setDirtyMemoKeys(new Set());
    }
    setFocusCell(null);
    setShiftEditor(null);
    setEmpEditorId(null);
    setYearMonth(targetYm);
    await loadMonthly(storeId, targetYm);
  }

  async function go(pageName) {
    if (busy) return;
    if ((dirtyKeys.size || dirtyMemoKeys.size) && page === 'monthly' && pageName !== 'monthly') {
      if (!confirm('未保存の変更があります。破棄して移動しますか？')) return;
      setDirtyKeys(new Set());
      setDirtyMemoKeys(new Set());
    }

    if (pageName === 'home' || pageName === 'monthly') {
      try {
        await withBusy('月間シフトを準備中…', async () => {
          await loadMonthly(storeId, yearMonth || meta?.serverYearMonth, { quiet: true });
          setMsg('');
          setPage('monthly');
        });
      } catch (e) {
        notify(e.message || String(e), 'err');
      }
      return;
    }

    if (pageName === 'jurisdiction') {
      setBusyText('準備中…');
      setBusy(true);
      try {
        setSelectedStores((user?.stores || []).map((s) => s.store_id));
        const firstArea = user?.areas?.[0] || user?.allStores?.[0]?.area || '';
        setSelectedArea(firstArea);
        setMsg('');
        setPage('jurisdiction');
      } finally {
        setBusy(false);
      }
      return;
    }

    const labels = {
      employees: '従業員を読み込み中…',
      weekly: '週間スケジュールを読み込み中…',
      monthly: '月間シフトを準備中…',
    };

    try {
      await withBusy(labels[pageName] || '読み込み中…', async () => {
        if (pageName === 'employees') await loadEmployees(storeId, { quiet: true });
        if (pageName === 'weekly') await loadWeekly(storeId, { quiet: true });
        if (pageName === 'monthly') await loadMonthly(storeId, yearMonth, { quiet: true });
        setMsg('');
        setPage(pageName);
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  if (authStep === 'loading') {
    return <div className="min-h-[100dvh] bg-[#f2f2f7] flex items-center justify-center text-slate-500 font-semibold">読み込み中…</div>;
  }

  if (authStep === 'login') {
    return (
      <div className="min-h-[100dvh] bg-[#f2f2f7] flex items-center justify-center p-6 relative overflow-hidden">
        {busy && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-black/5 px-8 py-7 min-w-[16rem] text-center">
              <div className="mx-auto mb-4 h-10 w-10 rounded-full border-[3px] border-slate-200 border-t-[var(--acc-500)] animate-spin" />
              <p className="text-sm font-bold text-slate-800">{busyText}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">完了するまでお待ちください</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute -top-16 -left-10 w-72 h-72 rounded-full bg-[var(--acc-200)] blur-3xl opacity-50" />
        <div className="w-full max-w-xl relative z-10 bg-white rounded-2xl border border-[var(--acc-200)]/40 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.18)] p-10">
          <div className="w-[5.25rem] h-[5.25rem] mx-auto mb-7 rounded-[1.15rem] bg-gradient-to-br from-[var(--acc-400)] to-[var(--acc-700)] text-white text-3xl font-black flex items-center justify-center shadow-xl">S</div>
          <p className="text-center text-[11px] font-semibold tracking-[0.28em] text-slate-500 uppercase mb-2.5">Task Force Team</p>
          <h1 className="text-center text-3xl font-bold text-slate-900">{meta?.appTitle || 'シフト・キンタイ・カレンダー'}</h1>
          <p className="text-center text-lg font-bold text-slate-700 mt-5 mb-7">全店シフトを一元管理</p>
          <div className="rounded-2xl bg-gradient-to-b from-[var(--acc-50)]/80 to-white border border-[var(--acc-200)]/50 px-5 py-4 mb-8 text-center text-sm text-slate-600 font-medium space-y-2">
            <p>必ず <span className="font-bold text-[var(--acc-700)]">@{domain}</span> の個人メールでログインしてください。</p>
            <p className="text-xs text-slate-500">初回はログイン後に「表示名」と「管轄店舗」の登録が必要です。</p>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login(loginEmail); }}>
            <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={`name@${domain}`} className={`${inputCls} text-center py-4`} />
            {loginError && <p className="text-rose-500 text-sm font-bold text-center whitespace-pre-wrap">{loginError}</p>}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-4`}>ログイン</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#f2f2f7] relative flex flex-col overflow-hidden">
      {busy && (
        <div className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-black/5 px-8 py-7 min-w-[16rem] text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border-[3px] border-slate-200 border-t-[var(--acc-500)] animate-spin" />
            <p className="text-sm font-bold text-slate-800">{busyText}</p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">完了してから画面を切り替えます</p>
          </div>
        </div>
      )}

      {/* ===== 月間：スプシ専用フルスクリーン ===== */}
      {page === 'monthly' ? (
        <div className={`absolute inset-0 z-50 flex flex-col bg-[#fafafa] text-zinc-900 ${busy ? 'pointer-events-none' : ''}`}>
          <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-2 px-3 h-12">
              {(() => {
                const baseYm = meta?.serverYearMonth || yearMonth;
                const prevYm = shiftYearMonth(baseYm, -1);
                const nextYm = shiftYearMonth(baseYm, 1);
                const monthBtns = [
                  { id: 'prev', ym: prevYm, label: '先月' },
                  { id: 'cur', ym: baseYm, label: '当月' },
                  { id: 'next', ym: nextYm, label: '翌月' },
                ];
                return (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center p-0.5 rounded-full bg-zinc-100 border border-zinc-200/80">
                      {monthBtns.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          disabled={busy || !b.ym}
                          onClick={() => changeMonth(b.ym)}
                          className={`sheet-chip ${yearMonth === b.ym ? 'sheet-chip-on shadow-sm' : 'sheet-chip-ghost border-0'}`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[12px] font-semibold text-zinc-500 tabular-nums tracking-wide hidden sm:inline pl-1">
                      {formatYmJa(yearMonth)}
                    </span>
                  </div>
                );
              })()}
              <div className="w-px h-5 shrink-0 bg-zinc-200" />
              <select
                className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-700 max-w-[8rem]"
                value={storeId}
                onChange={(e) => {
                  const sid = e.target.value;
                  setStoreId(sid);
                  if (yearMonth) loadMonthly(sid, yearMonth);
                }}
              >
                {(user?.stores || []).map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>
              <div className="flex items-center gap-1 overflow-x-auto">
                {[
                  { id: 'jurisdiction', label: '管轄' },
                  { id: 'employees', label: '従業員' },
                  { id: 'weekly', label: '週間' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => go(t.id)}
                    className="sheet-chip sheet-chip-off shrink-0"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetMonthFromWeekly}
                  className="sheet-chip sheet-chip-off hidden lg:inline-flex"
                >週間でやり直す</button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={copyByeBye}
                className="sheet-chip sheet-chip-off"
              >バイバイ</button>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy || !dirtyTotal}
                  onClick={saveDirtyShifts}
                  className="sheet-chip sheet-chip-on disabled:opacity-40"
                >
                  保存{dirtyTotal ? ` ${dirtyTotal}` : ''}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
              <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase mr-1">Range</span>
              {DAY_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDayRange(opt.id)}
                  className={`sheet-chip ${dayRange === opt.id ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <p
              className={`shrink-0 px-4 py-1.5 text-[11px] font-medium border-b border-zinc-100 ${
                msgKind === 'err'
                  ? 'text-rose-600 bg-rose-50/80'
                  : msgKind === 'ok'
                    ? 'text-emerald-700 bg-emerald-50/60'
                    : 'text-zinc-500 bg-white'
              }`}
            >{msg}</p>
          )}

          {!daysInMonth || !employees.length ? (
            <p className="flex-1 flex items-center justify-center font-medium text-sm text-zinc-400 tracking-wide">従業員登録と表示を行ってください</p>
          ) : (
            <div ref={sheetAreaRef} className="flex-1 min-h-0 overflow-auto sheet-scroll bg-white">
              <table className="border-collapse min-h-full w-full" style={{ minHeight: '100%', tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th
                      className="sticky left-0 z-40 border-b border-r px-3 py-2 text-left text-[10px] font-semibold tracking-wider text-zinc-500 bg-[#fafafa]"
                      style={{ width: 140, minWidth: 140, maxWidth: 140, borderColor: 'var(--sheet-line-strong)' }}
                    >
                      従業員
                    </th>
                    {visibleDays.map((day) => {
                      const date = toYmDay(yearMonth, day);
                      const wd = new Date(`${date}T00:00:00`).getDay();
                      const headCls = wd === 0
                        ? 'bg-rose-50 text-rose-600'
                        : wd === 6
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-[#fafafa] text-zinc-600';
                      return (
                        <th
                          key={date}
                          className={`border-b border-r px-0 py-2 text-center ${headCls}`}
                          style={{ width: colPx, minWidth: colPx, maxWidth: colPx, borderColor: 'var(--sheet-line-strong)' }}
                        >
                          <div className="text-[13px] font-semibold leading-none tabular-nums tracking-tight">{day}</div>
                          <div className="text-[9px] font-medium mt-1 opacity-70 tracking-wide">{WEEKDAY_LABELS[wd]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <Fragment key={e.employee_id}>
                      <tr>
                        <td
                          className={`sticky left-0 z-20 border-b border-r p-0 bg-white ${empEditorId === e.employee_id ? 'ring-2 ring-inset ring-zinc-900/40' : ''}`}
                          style={{ width: 140, minWidth: 140, maxWidth: 140, borderColor: 'var(--sheet-line)' }}
                        >
                          <button
                            type="button"
                            disabled={busy || !canEdit}
                            onClick={() => openEmpEditor(e.employee_id)}
                            className="w-full h-10 px-2.5 text-left hover:bg-zinc-50/80 disabled:opacity-60 transition-colors"
                            title="タップして社員／アルバイト・勤務時間を編集"
                          >
                            <div className="font-semibold text-[11px] leading-tight whitespace-nowrap truncate max-w-[124px] text-zinc-900">{e.name}</div>
                            <div className="flex items-center gap-1 mt-1 min-w-0">
                              <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full tracking-wide ${isFullTimeEmp(e) ? 'bg-zinc-900 text-white' : 'bg-sky-600 text-white'}`}>
                                {isFullTimeEmp(e) ? '社' : 'ア'}
                              </span>
                              <span className={`text-[9px] font-semibold tabular-nums ${isFullTimeEmp(e) ? 'text-zinc-400' : 'text-sky-700'}`}>
                                {isFullTimeEmp(e) ? '9h' : `${spanHoursForEmp(e)}h`}
                              </span>
                              <span className="text-[9px] font-medium text-zinc-400 truncate">{e.bye_code || ''}</span>
                            </div>
                          </button>
                        </td>
                        {visibleDays.map((day) => {
                          const date = toYmDay(yearMonth, day);
                          const s = getCellShift(e.employee_id, date);
                          const status = s.status || 'undef';
                          const dirty = dirtyKeys.has(shiftKey(e.employee_id, date));
                          const focused = focusCell?.employee_id === e.employee_id && focusCell?.date === date && focusCell?.layer !== 'memo';
                          const top = status === 'work'
                            ? String(s.start_time || '').slice(0, 5)
                            : cellLabel(status);
                          const bottom = status === 'work' ? String(s.end_time || '').slice(0, 5) : '';
                          const isLeave = status === 'off' || status === 'pto' || status === 'absent';
                          const fg = isLeave ? '#e11d48' : '#18181b';
                          return (
                            <td
                              key={`${e.employee_id}-${date}`}
                              className={`border-b border-r p-0 h-10 bg-white ${dirty ? 'ring-2 ring-inset ring-amber-300' : ''}`}
                              style={{
                                width: colPx,
                                minWidth: colPx,
                                maxWidth: colPx,
                                borderColor: 'var(--sheet-line)',
                                color: fg,
                                ...(focused ? { boxShadow: 'inset 0 0 0 1.5px #18181b' } : null),
                              }}
                            >
                              <button
                                type="button"
                                disabled={busy || !canEdit}
                                onClick={() => openShiftEditor(e.employee_id, date)}
                                className="w-full h-10 px-0.5 flex flex-col items-center justify-center leading-none hover:bg-zinc-50/90 disabled:opacity-60 transition-colors"
                                title="タップして勤務区分・時間を選択"
                              >
                                <span className="text-[10px] font-semibold tabular-nums tracking-tight">{top}</span>
                                {bottom ? <span className="text-[9px] font-medium tabular-nums text-zinc-500 mt-0.5">{bottom}</span> : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td
                          className="sticky left-0 z-20 border-b border-r px-2.5 py-0 h-7 bg-[#fcfcfc] text-zinc-400"
                          style={{ width: 140, minWidth: 140, maxWidth: 140, borderColor: 'var(--sheet-line)' }}
                        >
                          <div className="text-[9px] font-medium tracking-wide">メモ</div>
                        </td>
                        {visibleDays.map((day) => {
                          const date = toYmDay(yearMonth, day);
                          const m = getCellMemo(e.employee_id, date);
                          const body = String(m.body || '');
                          const dirty = dirtyMemoKeys.has(shiftKey(e.employee_id, date));
                          const focused = focusCell?.employee_id === e.employee_id && focusCell?.date === date && focusCell?.layer === 'memo';
                          return (
                            <td
                              key={`memo-${e.employee_id}-${date}`}
                              className={`border-b border-r p-0 h-7 bg-[#fcfcfc] ${dirty ? 'ring-2 ring-inset ring-amber-300' : ''}`}
                              style={{
                                width: colPx,
                                minWidth: colPx,
                                maxWidth: colPx,
                                borderColor: 'var(--sheet-line)',
                                ...(focused ? { boxShadow: 'inset 0 0 0 1.5px #18181b' } : null),
                              }}
                            >
                              <input
                                type="text"
                                disabled={busy || !canEdit}
                                value={body}
                                onFocus={() => {
                                  setShiftEditor(null);
                                  setFocusCell({ employee_id: e.employee_id, date, layer: 'memo' });
                                }}
                                onChange={(ev) => patchMemoLocal(e.employee_id, date, ev.target.value)}
                                className="w-full h-7 px-1 text-[9px] font-medium text-zinc-700 bg-transparent border-0 outline-none disabled:opacity-60"
                                title="メモは直接入力"
                                placeholder=""
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  ))}
                  {Array.from({ length: Math.max(6, 16 - employees.length * 2) }, (_, fi) => (
                    <tr key={`pad-${fi}`}>
                      <td
                        className="sticky left-0 z-20 border-b border-r h-8 bg-white"
                        style={{ width: 140, minWidth: 140, maxWidth: 140, borderColor: 'var(--sheet-line)' }}
                      />
                      {visibleDays.map((day) => (
                        <td
                          key={`pad-${fi}-${day}`}
                          className="border-b border-r h-8 bg-white"
                          style={{ width: colPx, minWidth: colPx, maxWidth: colPx, borderColor: 'var(--sheet-line)' }}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {empEditor && (
            <div className="shrink-0 border-t border-zinc-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
                <p className="text-[12px] font-semibold text-zinc-800 truncate">
                  {empEditor.name}
                  <span className="ml-2 text-[10px] font-medium text-zinc-400 tracking-wide">従業員設定</span>
                </p>
                <button type="button" onClick={closeEmpEditor} className="sheet-chip sheet-chip-off">
                  閉じる
                </button>
              </div>
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateEmployeeProfile(empEditor.employee_id, { employment_type: '社員', work_hours: '' })}
                  className={`sheet-chip ${isFullTimeEmp(empEditor) ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                >
                  社員（9時間）
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateEmployeeProfile(empEditor.employee_id, {
                    employment_type: 'アルバイト',
                    work_hours: empEditor.work_hours || 4,
                  })}
                  className={`sheet-chip ${!isFullTimeEmp(empEditor) ? 'bg-sky-600 text-white border-sky-600' : 'sheet-chip-off'}`}
                >
                  アルバイト
                </button>
              </div>
              {!isFullTimeEmp(empEditor) && (
                <div className="px-4 pb-3.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium text-zinc-400 mr-1 tracking-wide">勤務時間</span>
                  {PART_HOUR_OPTIONS.map((h) => {
                    const active = Number(spanHoursForEmp(empEditor)) === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={busy}
                        onClick={() => updateEmployeeProfile(empEditor.employee_id, {
                          employment_type: 'アルバイト',
                          work_hours: h,
                        })}
                        className={`sheet-chip min-w-[2.75rem] ${active ? 'bg-sky-600 text-white border-sky-600' : 'sheet-chip-off'}`}
                      >
                        {h}h
                      </button>
                    );
                  })}
                </div>
              )}
              {isFullTimeEmp(empEditor) && (
                <p className="px-4 pb-3.5 text-[10px] font-medium text-zinc-400">
                  社員は IN 入力で OUT が +9時間（実働8h+休憩1h）になります
                </p>
              )}
            </div>
          )}

          {shiftEditor && editorShift && (
            <div className="shrink-0 border-t border-zinc-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
                <p className="text-[12px] font-semibold text-zinc-800 truncate">
                  {editorEmpName}
                  <span className="ml-2 text-[10px] font-medium text-zinc-400 tabular-nums">{shiftEditor.date}</span>
                </p>
                <button type="button" onClick={closeShiftEditor} className="sheet-chip sheet-chip-off">
                  閉じる
                </button>
              </div>
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {SHIFT_STATUS_OPTIONS.map((st) => {
                  const active = (editorShift.status || 'undef') === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={busy}
                      onClick={() => applyEditorStatus(st.id)}
                      className={`sheet-chip ${active ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
              {(editorShift.status || 'undef') === 'work' && (
                <div className="px-4 pb-3.5 space-y-2.5">
                  <p className="text-[10px] font-medium text-zinc-400">
                    {isFullTimeEmp(editorEmp)
                      ? '社員: IN を選ぶと OUT は +9時間（実働8h+休憩1h）で自動'
                      : `アルバイト: IN を選ぶと OUT は +${spanHoursForEmp(editorEmp)}時間で自動`}
                  </p>
                  {!isFullTimeEmp(editorEmp) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-medium text-zinc-400 mr-1">勤務時間</span>
                      {PART_HOUR_OPTIONS.map((h) => {
                        const active = Number(spanHoursForEmp(editorEmp)) === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={busy}
                            onClick={() => applyEditorPartHours(h)}
                            className={`sheet-chip min-w-[2.75rem] ${active ? 'bg-sky-600 text-white border-sky-600' : 'sheet-chip-off'}`}
                          >
                            {h}h
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 min-w-[7.5rem]">
                      <span className="text-[10px] font-medium text-zinc-400 tracking-wide">IN</span>
                      <select
                        className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
                        value={snapToStep(editorShift.start_time || '12:00', TIME_STEP_MIN)}
                        onChange={(ev) => applyEditorIn(ev.target.value)}
                        disabled={busy}
                      >
                        {timeOptions.map((t) => <option key={`in-${t}`} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <div className="flex flex-col gap-1 min-w-[7.5rem]">
                      <span className="text-[10px] font-medium text-zinc-400 tracking-wide">OUT（自動）</span>
                      <div className="h-9 rounded-xl border border-zinc-100 bg-zinc-50 px-3 flex items-center text-sm font-semibold text-zinc-700 tabular-nums">
                        {editorOutAuto || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      <div className={`flex flex-col flex-1 min-h-0 ${busy ? 'pointer-events-none select-none' : ''}`}>
        <header className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200/80">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-500 mb-0.5">Task Force Team</p>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{user?.appTitle || meta?.appTitle}</h1>
            <p className="text-xs font-semibold text-slate-500">{storeName || '店舗未選択'}</p>
          </div>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setAccountOpen((v) => !v)} className="w-9 h-9 rounded-full bg-slate-800 text-white text-sm font-bold flex items-center justify-center ring-2 ring-white shadow-md">
              {accountInitial}
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setAccountOpen(false)} />
                <div className="absolute right-0 mt-2 w-[min(18rem,92vw)] z-50 bg-white rounded-2xl shadow-2xl border border-black/[0.06] overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <p className="font-semibold text-slate-900 text-sm">{user?.name}</p>
                    <p className="text-[11px] text-slate-500">{user?.email}</p>
                  </div>
                  <button type="button" onClick={logout} className="w-full text-left px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50">ログアウト</button>
                </div>
              </>
            )}
          </div>
        </header>

        {page !== 'jurisdiction' && (
          <div className="shrink-0 flex flex-wrap gap-1.5 px-3 sm:px-4 py-2 bg-white border-b border-slate-200/80">
            {[
              { id: 'monthly', label: '月間シフト' },
              { id: 'jurisdiction', label: user?.needsJurisdiction ? '初回登録' : '管轄設定' },
              { id: 'employees', label: '従業員登録' },
              { id: 'weekly', label: '週間スケジュール' },
            ].map((t) => (
              <button key={t.id} type="button" onClick={() => go(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${page === t.id ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {msg && (
          <p className={`shrink-0 px-3 sm:px-4 py-2 text-sm font-semibold whitespace-pre-wrap bg-white border-b border-slate-100 ${msgKind === 'err' ? 'text-rose-600' : msgKind === 'ok' ? 'text-emerald-600' : 'text-slate-500'}`}>{msg}</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full px-4 py-4 pb-10">
              {/* HOME（後方互換・通常は月間へ直行） */}
              {page === 'home' && (
          <div className="space-y-3">
            <section className={card}>
              <p className="text-sm font-semibold text-[var(--acc-600)] border-b border-slate-200/80 pb-2 mb-3">月間シフトへ</p>
              <p className="text-sm text-slate-600 font-medium mb-4">ログイン後は月間シフトがスタート画面です。下のボタンから開けます。</p>
              <button type="button" onClick={() => go('monthly')} className={btnPrimary}>月間シフトを開く</button>
            </section>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { id: 'jurisdiction', title: '管轄設定', desc: 'エリア・店舗を選ぶ' },
                { id: 'employees', title: '従業員登録', desc: 'フルネームと社員コード' },
                { id: 'weekly', title: '週間スケジュール', desc: '固定出勤パターン' },
                { id: 'monthly', title: '月間シフト', desc: 'スプシ風フルスクリーンで添削' },
              ].map((x) => (
                <button key={x.id} type="button" onClick={() => go(x.id)} className={`${card} text-left hover:border-[var(--acc-300)] transition`}>
                  <p className="font-bold text-slate-900">{x.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{x.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* JURISDICTION / 初回登録 */}
        {page === 'jurisdiction' && (
          <section className={card}>
            <p className="text-sm font-semibold text-[var(--acc-600)] border-b border-slate-200/80 pb-2 mb-3">
              {user?.needsJurisdiction ? '初回登録' : '管轄店舗の変更'}
            </p>
            {user?.needsJurisdiction && (
              <p className="text-sm text-slate-600 font-medium mb-4">
                ToDoリストと同様、最初に<strong className="font-bold text-slate-800">表示名</strong>と<strong className="font-bold text-slate-800">管轄店舗</strong>を登録します。同じ管轄の人は同じ店舗データを共有します。
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <label className={labelCls}>表示名（フルネーム）
                <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="日下 竜汰" required />
              </label>
              <label className={labelCls}>エリア絞り込み
                <select className={inputCls} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                  <option value="">すべて</option>
                  {(user?.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs font-bold text-slate-500 mb-2">管轄店舗（複数選択可）</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {areaStores.map((s) => {
                const on = selectedStores.includes(s.store_id);
                return (
                  <button key={s.store_id} type="button" onClick={() => toggleStore(s.store_id)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${on ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white text-slate-700 border-slate-200'}`}>
                    {s.store_name}{s.area ? `（${s.area}）` : ''}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy || !selectedStores.length || !String(displayName || '').trim()} onClick={saveJurisdiction} className={btnPrimary}>
                {user?.needsJurisdiction ? '登録して進む' : '保存して進む'}
              </button>
              {!user?.needsJurisdiction && <button type="button" onClick={() => go('monthly')} className={btnSecondary}>月間シフトへ</button>}
            </div>
          </section>
        )}

        {/* EMPLOYEES */}
        {page === 'employees' && (
          <div className="space-y-3">
            <section className={card}>
              <div className="flex flex-wrap gap-3 items-end mb-3">
                <label className={`${labelCls} min-w-[12rem] flex-1`}>店舗
                  <select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    {(user?.stores || []).map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => loadEmployees()} className={btnPrimary}>表示</button>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">名前・社員コード・区分は登録後も変更できます。月間の左列からも社員／アルバイトと勤務時間を変えられます。</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className={labelCls}>フルネーム
                  <input className={inputCls} value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} placeholder="蜂谷 有加" />
                </label>
                <label className={labelCls}>社員コード
                  <input className={inputCls} value={empForm.bye_code} onChange={(e) => setEmpForm({ ...empForm, bye_code: e.target.value })} placeholder="303879" />
                </label>
                <label className={labelCls}>区分
                  <select
                    className={inputCls}
                    value={normalizeEmpType(empForm.employment_type)}
                    onChange={(e) => setEmpForm({
                      ...empForm,
                      employment_type: e.target.value,
                      work_hours: e.target.value === 'アルバイト' ? (empForm.work_hours || 4) : '',
                    })}
                  >
                    <option value="社員">社員（9時間拘束）</option>
                    <option value="アルバイト">アルバイト</option>
                  </select>
                </label>
                {normalizeEmpType(empForm.employment_type) === 'アルバイト' && (
                  <div className={labelCls}>
                    <span>勤務時間</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {PART_HOUR_OPTIONS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setEmpForm({ ...empForm, employment_type: 'アルバイト', work_hours: h })}
                          className={`h-9 min-w-[2.75rem] px-2 rounded-xl border text-xs font-bold ${
                            Number(empForm.work_hours) === h
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" disabled={busy} onClick={saveEmployee} className={btnPrimary}>{empForm.employee_id ? '更新' : '追加'}</button>
                <button type="button" onClick={() => setEmpForm({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 })} className={btnSecondary}>クリア</button>
              </div>
            </section>
            <section className={card}>
              <p className="text-sm font-semibold text-[var(--acc-600)] border-b border-slate-200/80 pb-2 mb-3">登録済み従業員</p>
              {!employees.length ? (
                <p className="text-sm text-slate-500 font-semibold py-6 text-center">まだいません</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {employees.map((e) => (
                    <li key={e.employee_id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          {e.name}
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isFullTimeEmp(e) ? 'bg-slate-800 text-white' : 'bg-sky-600 text-white'}`}>
                            {isFullTimeEmp(e) ? '社員' : 'アルバイト'}
                          </span>
                          {!isFullTimeEmp(e) && (
                            <span className="text-xs font-bold text-sky-700">{spanHoursForEmp(e)}時間</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">コード: {e.bye_code || '—'}</p>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200"
                          onClick={() => setEmpForm({
                            employee_id: e.employee_id,
                            name: e.name,
                            bye_code: e.bye_code,
                            employment_type: normalizeEmpType(e.employment_type),
                            work_hours: e.work_hours || 4,
                          })}
                        >編集</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* WEEKLY */}
        {page === 'weekly' && (
          <div className="space-y-3">
            <section className={card}>
              <div className="flex flex-wrap gap-3 items-end mb-3">
                <label className={`${labelCls} min-w-[12rem] flex-1`}>店舗
                  <select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    {(user?.stores || []).map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => loadWeekly()} className={btnPrimary}>表示</button>
                {canEdit && <button type="button" disabled={busy} onClick={saveWeekly} className={btnPrimary}>保存</button>}
              </div>
              <p className="text-xs text-slate-500 font-medium">曜日ごとの固定出勤。後から変更できます。月間シフト作成時に展開されます。</p>
            </section>
            {!employees.length ? (
              <section className={card}><p className="text-center text-slate-500 font-semibold py-8 text-sm">先に従業員を登録してください</p></section>
            ) : (
              <section className={card}>
                <div className="flex flex-wrap gap-2 mb-4">
                  {employees.map((e) => (
                    <button key={e.employee_id} type="button" onClick={() => setWeeklyEmpId(e.employee_id)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${weeklyEmpId === e.employee_id ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white border-slate-200'}`}>{e.name}</button>
                  ))}
                </div>
                {weeklyEmpId && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2.5rem_5.5rem_1fr] gap-2 items-center px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>曜</span>
                      <span>出勤</span>
                      <span className="text-right sm:text-left">時間（出勤時のみ）</span>
                    </div>
                    {WEEKDAY_LABELS.map((label, wd) => {
                      const cell = weeklyCell(weeklyEmpId, wd);
                      const isWork = cell.status === 'work';
                      const emp = employees.find((x) => x.employee_id === weeklyEmpId);
                      const autoOut = addHoursToHm(cell.start_time || '12:00', spanHoursForEmp(emp));
                      return (
                        <div key={wd} className="grid grid-cols-[2.5rem_5.5rem_1fr] gap-2 items-center py-1.5 border-b border-slate-100 last:border-0">
                          <div className={`text-sm font-black tabular-nums ${weekdayTextClass(wd)}`}>{label}</div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={!canEdit}
                              title="出勤"
                              onClick={() => setWeeklyCell(weeklyEmpId, wd, workTimesFromIn(emp, cell.start_time || '12:00'))}
                              className={`w-10 h-10 rounded-xl text-lg font-black border transition ${isWork ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'}`}
                            >○</button>
                            <button
                              type="button"
                              disabled={!canEdit}
                              title="休み"
                              onClick={() => setWeeklyCell(weeklyEmpId, wd, { status: 'off', start_time: '', end_time: '' })}
                              className={`w-10 h-10 rounded-xl text-lg font-black border transition ${!isWork ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-200 hover:border-orange-300'}`}
                            >×</button>
                          </div>
                          <div className={`flex items-center gap-2 min-w-0 ${isWork ? '' : 'opacity-40 pointer-events-none'}`}>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">IN</span>
                            <select
                              disabled={!canEdit || !isWork}
                              className={`${inputCls} py-2.5`}
                              value={snapToStep(cell.start_time || '12:00', TIME_STEP_MIN)}
                              onChange={(e) => setWeeklyCell(weeklyEmpId, wd, workTimesFromIn(emp, e.target.value))}
                            >
                              {buildTimeOptions(TIME_STEP_MIN).map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span className="text-slate-400 font-bold shrink-0">→</span>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">OUT</span>
                            <div className="h-10 min-w-[5.5rem] rounded-xl bg-slate-100 px-3 flex items-center text-sm font-bold text-slate-700 tabular-nums">
                              {isWork ? autoOut : '—'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

          </div>
        </div>
      </div>
      )}
    </div>
  );
}

