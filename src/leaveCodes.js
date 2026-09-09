/** 勤怠未来の休日休暇コード（全件） */
export const LEAVE_CODES = [
  { code: 10, name: '法定休日' },
  { code: 11, name: '法定休日出勤' },
  { code: 12, name: '振休(法定)→休出' },
  { code: 20, name: '法定外休日' },
  { code: 21, name: '法定外休日出勤' },
  { code: 22, name: '振休(法定外)→休出' },
  { code: 30, name: '振替休日(法定)' },
  { code: 31, name: '振替出勤(法定)' },
  { code: 32, name: '振出(法定)→有休' },
  { code: 33, name: '振出(法定)→半日有休(前)' },
  { code: 34, name: '振出(法定)→半日有休(後)' },
  { code: 35, name: '振出(法定)→半日有休・半日欠勤' },
  { code: 40, name: '振替休日(法定外)' },
  { code: 41, name: '振替出勤(法定外)' },
  { code: 42, name: '振出(法定外)→有休' },
  { code: 43, name: '振出(法定外)→半日有休(前)' },
  { code: 44, name: '振出(法定外)→半日有休(後)' },
  { code: 45, name: '振出(法定外)→半日有休・半日欠勤' },
  { code: 50, name: '代休' },
  { code: 61, name: '有休' },
  { code: 62, name: '特別休暇(有給)' },
  { code: 63, name: '半日有休(前)' },
  { code: 64, name: '半日有休(後)' },
  { code: 65, name: '半日有休・半日欠勤' },
  { code: 71, name: '特別休暇(無給)' },
  { code: 73, name: '生理休暇' },
  { code: 74, name: '介護休暇' },
  { code: 75, name: '子の看護休暇' },
  { code: 76, name: '健康維持代休' },
  { code: 77, name: '産休・育休' },
  { code: 78, name: '母性健康管理' },
  { code: 80, name: '欠勤' },
  { code: 90, name: '休職' },
  { code: 999, name: '無効' },
];

const WORK_CODES = new Set([11, 12, 21, 22, 31, 32, 33, 34, 35, 41, 42, 43, 44, 45]);
const PTO_CODES = new Set([61, 62, 63, 64, 65, 71, 73, 74, 75, 76, 77, 78]);
const ABSENT_CODES = new Set([80, 90]);

export const LEAVE_BY_CODE = Object.fromEntries(LEAVE_CODES.map((c) => [c.code, c]));

export function parseLeaveCode(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function statusFromLeaveCode(code) {
  const n = parseLeaveCode(code);
  if (!n || n === 999) return 'undef';
  if (WORK_CODES.has(n)) return 'work';
  if (PTO_CODES.has(n)) return 'pto';
  if (ABSENT_CODES.has(n)) return 'absent';
  return 'off';
}

export function leaveCodeNeedsShiftTime(code) {
  const n = parseLeaveCode(code);
  return WORK_CODES.has(n);
}

export function leaveCodeNeedsDummyShift(code) {
  const n = parseLeaveCode(code);
  return PTO_CODES.has(n);
}

export function leaveCodeLabel(code) {
  const n = parseLeaveCode(code);
  return LEAVE_BY_CODE[n]?.name || '';
}

/** 掲示印刷用・必ず2文字（赤表示） */
const PRINT_LEAVE = {
  10: '公休',
  11: '休出',
  12: '振休',
  20: '公休',
  21: '休出',
  22: '振休',
  30: '振休',
  31: '振出',
  32: '有休',
  33: '半休',
  34: '半休',
  35: '半欠',
  40: '振休',
  41: '振出',
  42: '有休',
  43: '半休',
  44: '半休',
  45: '半欠',
  50: '代休',
  61: '有休',
  62: '特休',
  63: '半休',
  64: '半休',
  65: '半欠',
  71: '特休',
  73: '生理',
  74: '介護',
  75: '看護',
  76: '代休',
  77: '育休',
  78: '母性',
  80: '欠勤',
  90: '休職',
};

export function leaveCodePrintLabel(code) {
  const n = parseLeaveCode(code);
  if (!n) return '';
  const s = PRINT_LEAVE[n] || leaveCodeLabel(n);
  return String(s).slice(0, 2);
}

export function defaultLeaveCodeForStatus(status) {
  if (status === 'pto') return 61;
  if (status === 'absent') return 80;
  return '';
}

/** 公休として 10/20 を自動割当してよい日（有休・欠勤・出勤・その他コードは対象外） */
export function isAutoHouteiDay(s) {
  if (!s) return true;
  const st = String(s.status || 'undef');
  if (st === 'work' || st === 'pto' || st === 'absent') return false;
  const n = parseLeaveCode(s.leave_code);
  if (!n || n === 10 || n === 20) return true;
  return false;
}

function padDay(n) {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

/**
 * 週は日曜始まり〜土曜終わり。
 * 月の先頭で日曜を含まない端数週は、前月側ですでに法定休日済みとみなし全部 20。
 * 日曜を含む週は、その週の最後の休みが 10、それより前の休みが 20。
 * prefer10Date / prefer20Date で手動修正を優先する。
 */
export function computeAutoHouteiMap(shifts, employeeId, yearMonth, opts = {}) {
  const ym = String(yearMonth || '').trim();
  const parts = ym.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const out = {};
  if (!year || !month) return out;
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay = {};
  (shifts || []).forEach((s) => {
    if (String(s.employee_id) !== String(employeeId)) return;
    const date = String(s.date || '').slice(0, 10);
    if (!date.startsWith(ym)) return;
    byDay[Number(date.slice(-2))] = s;
  });
  // シフトが1日も登録されていない月は自動休日を付けない（空欄のまま）
  const hasSchedule = Object.keys(byDay).some((d) => {
    const s = byDay[d];
    const st = String(s?.status || '');
    if (st === 'work' || st === 'off' || st === 'pto' || st === 'absent') return true;
    return !!parseLeaveCode(s?.leave_code);
  });
  if (!hasSchedule) return out;

  const prefer10 = opts.prefer10Date ? Number(String(opts.prefer10Date).slice(-2)) : 0;
  const prefer20 = opts.prefer20Date ? Number(String(opts.prefer20Date).slice(-2)) : 0;

  let week = [];
  const flush = (hasSunday) => {
    const auto = week.filter((d) => isAutoHouteiDay(byDay[d]));
    week = [];
    if (!auto.length) return;
    let ten = 0;
    if (prefer10 && auto.includes(prefer10)) ten = prefer10;
    else if (hasSunday) {
      const candidates = prefer20 ? auto.filter((d) => d !== prefer20) : auto;
      const existing10 = candidates.filter((d) => parseLeaveCode(byDay[d]?.leave_code) === 10);
      ten = existing10.length === 1 ? existing10[0] : (candidates[candidates.length - 1] || 0);
    }
    auto.forEach((d) => {
      out[`${ym}-${padDay(d)}`] = d === ten ? 10 : 20;
    });
  };

  for (let d = 1; d <= daysInMonth; d += 1) {
    const wd = new Date(year, month - 1, d).getDay();
    if (wd === 0 && week.length) {
      const hasSunday = week.some((x) => new Date(year, month - 1, x).getDay() === 0);
      flush(hasSunday);
    }
    week.push(d);
  }
  if (week.length) {
    const hasSunday = week.some((x) => new Date(year, month - 1, x).getDay() === 0);
    flush(hasSunday);
  }
  return out;
}

export function applyAutoHouteiToShifts(shifts, employeeId, yearMonth, storeId, opts = {}) {
  const ym = String(yearMonth || '').trim();
  const parts = ym.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return { shifts, changedDates: [] };
  const daysInMonth = new Date(year, month, 0).getDate();
  const codes = computeAutoHouteiMap(shifts, employeeId, ym, opts);
  const byDate = {};
  (shifts || []).forEach((s, i) => {
    if (String(s.employee_id) !== String(employeeId)) return;
    byDate[String(s.date || '').slice(0, 10)] = i;
  });
  const next = [...(shifts || [])];
  const changedDates = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = `${ym}-${padDay(d)}`;
    const code = codes[date];
    if (!code) continue;
    const idx = byDate[date];
    if (idx == null) {
      next.push({
        shift_id: '',
        employee_id: employeeId,
        date,
        store_id: storeId,
        status: 'off',
        start_time: '',
        end_time: '',
        leave_code: code,
      });
      changedDates.push(date);
      continue;
    }
    const row = next[idx];
    if (!isAutoHouteiDay(row)) continue;
    if (parseLeaveCode(row.leave_code) === code && (row.status === 'off' || row.status === 'undef')) {
      if (row.status === 'undef') {
        next[idx] = { ...row, status: 'off', leave_code: code };
        changedDates.push(date);
      }
      continue;
    }
    next[idx] = { ...row, status: 'off', start_time: '', end_time: '', leave_code: code };
    changedDates.push(date);
  }
  return { shifts: next, changedDates };
}

export function hmFromMinutes(min) {
  const n = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(n / 60)}:${padDay(n % 60)}`;
}

export function shiftWorkMinutes(s) {
  if (!s) return 0;
  const st = String(s.status || '');
  const lc = parseLeaveCode(s.leave_code);
  const counts = st === 'work' || (st === 'pto' && leaveCodeNeedsDummyShift(lc));
  if (!counts) return 0;
  const a = String(s.start_time || '').match(/^(\d{1,2}):(\d{2})/);
  const b = String(s.end_time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!a || !b) return 0;
  let dur = (Number(b[1]) * 60 + Number(b[2])) - (Number(a[1]) * 60 + Number(a[2]));
  if (dur < 0) dur += 1440;
  let br = s.break_minutes === '' || s.break_minutes == null ? (dur > 360 ? 60 : 0) : Number(s.break_minutes);
  if (Number.isNaN(br) || br < 0) br = 0;
  return Math.max(0, dur - br);
}

/** 有休・特別休暇・産休育休など：所定労働として日数・時間に含める */
export function leaveCountsAsPrescribedWork(s) {
  if (!s) return false;
  const st = String(s.status || '');
  if (st === 'work') return true;
  if (st !== 'pto') return false;
  return leaveCodeNeedsDummyShift(parseLeaveCode(s.leave_code));
}

/**
 * 勤怠未来と同型の月所定労働日数。
 * 暦日数 − 月所定休日10日（週休2日相当を月で均した目安）。
 * 例: 31日→21日 / 30日→20日 / 28日→18日。所定時間は ×8時間。
 */
export function prescribedWeekdays(yearMonth) {
  const parts = String(yearMonth || '').split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return 0;
  const days = new Date(year, month, 0).getDate();
  return Math.max(0, days - 10);
}

export function summarizeEmpMonth(emp, shifts, yearMonth) {
  const ym = String(yearMonth || '');
  const rows = (shifts || []).filter((s) => String(s.employee_id) === String(emp?.employee_id) && String(s.date || '').startsWith(ym));
  let shiftDays = 0;
  let shiftMin = 0;
  const fullTime = normalizeEmpTypeLocal(emp);
  rows.forEach((s) => {
    if (!leaveCountsAsPrescribedWork(s)) return;
    shiftDays += 1;
    let min = shiftWorkMinutes(s);
    // 時刻未設定の有休等は社員8h／アルバイト既定時間でフォールバック
    if (!min && leaveCodeNeedsDummyShift(parseLeaveCode(s.leave_code))) {
      if (fullTime) min = 8 * 60;
      else {
        const wh = Number(emp?.work_hours);
        min = Math.round((wh > 0 ? wh : 4) * 60);
      }
    }
    shiftMin += min;
  });
  const prescribedDays = prescribedWeekdays(ym);
  const prescribedMin = prescribedDays * 8 * 60;
  return {
    shiftDays,
    shiftHm: hmFromMinutes(shiftMin),
    prescribedDays,
    prescribedHm: hmFromMinutes(prescribedMin),
    isFullTime: fullTime,
  };
}

function normalizeEmpTypeLocal(emp) {
  const t = String(emp?.employment_type || '社員').trim();
  return t !== 'パート' && t !== 'アルバイト';
}

function usageKey(email) {
  return `kintai_leave_usage_${String(email || '').trim().toLowerCase()}`;
}

function emptyLeavePrefs() {
  return { used: {}, hidden: [] };
}

function writeLeavePrefs(email, prefs) {
  try {
    localStorage.setItem(usageKey(email), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  return prefs;
}

/** @returns {{ used: Record<number, number>, hidden: number[] }} */
export function readLeavePrefs(email) {
  try {
    const raw = localStorage.getItem(usageKey(email));
    if (!raw) return emptyLeavePrefs();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return emptyLeavePrefs();
    if (!obj.used && !obj.hidden) {
      return { used: obj, hidden: [] };
    }
    return {
      used: obj.used && typeof obj.used === 'object' && !Array.isArray(obj.used) ? obj.used : {},
      hidden: Array.isArray(obj.hidden) ? obj.hidden.map(Number).filter(Boolean) : [],
    };
  } catch {
    return emptyLeavePrefs();
  }
}

/** @deprecated readLeavePrefs を使用 */
export function readLeaveUsage(email) {
  return readLeavePrefs(email).used;
}

export function markLeaveUsed(email, code) {
  const n = parseLeaveCode(code);
  if (!n) return readLeavePrefs(email);
  const prefs = readLeavePrefs(email);
  const next = {
    used: { ...prefs.used, [n]: Date.now() },
    hidden: prefs.hidden.filter((x) => x !== n),
  };
  return writeLeavePrefs(email, next);
}

export function moveLeaveToUsed(email, code) {
  const n = parseLeaveCode(code);
  if (!n) return readLeavePrefs(email);
  const prefs = readLeavePrefs(email);
  const next = {
    used: { ...prefs.used, [n]: Date.now() },
    hidden: prefs.hidden.filter((x) => x !== n),
  };
  return writeLeavePrefs(email, next);
}

export function moveLeaveToUnused(email, code) {
  const n = parseLeaveCode(code);
  if (!n) return readLeavePrefs(email);
  const prefs = readLeavePrefs(email);
  const used = { ...prefs.used };
  delete used[n];
  return writeLeavePrefs(email, { used, hidden: prefs.hidden });
}

export function hideLeaveCode(email, code) {
  const n = parseLeaveCode(code);
  if (!n) return readLeavePrefs(email);
  const prefs = readLeavePrefs(email);
  const used = { ...prefs.used };
  delete used[n];
  const hidden = prefs.hidden.includes(n) ? prefs.hidden : [...prefs.hidden, n];
  return writeLeavePrefs(email, { used, hidden });
}

export function restoreLeaveCode(email, code) {
  const n = parseLeaveCode(code);
  if (!n) return readLeavePrefs(email);
  const prefs = readLeavePrefs(email);
  return writeLeavePrefs(email, {
    used: prefs.used,
    hidden: prefs.hidden.filter((x) => x !== n),
  });
}

/** よく使う / 未使用 / 非表示 に分類 */
export function sortLeaveCodes(prefs) {
  const used = [];
  const unused = [];
  const hidden = [];
  const hiddenSet = new Set(Array.isArray(prefs?.hidden) ? prefs.hidden : []);
  const usage = prefs?.used || (prefs && !prefs.hidden ? prefs : {});
  LEAVE_CODES.forEach((c) => {
    if (hiddenSet.has(c.code)) hidden.push(c);
    else if (usage && usage[c.code]) used.push(c);
    else unused.push(c);
  });
  used.sort((a, b) => (usage[b.code] || 0) - (usage[a.code] || 0));
  return { used, unused, hidden };
}
