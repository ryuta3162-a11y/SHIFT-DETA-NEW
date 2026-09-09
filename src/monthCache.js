/** 月間シフトの端末キャッシュ（表示を先に出し、裏で同期する用） */

// v3: 従業員IDの表記統一（先頭ゼロ）に合わせて旧キャッシュを捨てる
const MONTH_CACHE_KEY = 'shiftapp_month_cache_v3';
const MAX_ENTRIES = 12;

function readAll_() {
  try {
    const raw = localStorage.getItem(MONTH_CACHE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function writeAll_(all) {
  try {
    localStorage.setItem(MONTH_CACHE_KEY, JSON.stringify(all));
  } catch {
    // quota 等は無視（次回はサーバから）
  }
}

function entryKey(storeId, yearMonth) {
  return `${String(storeId || '').trim()}__${String(yearMonth || '').trim()}`;
}

/** @returns {{ employees, shifts, memos, canEdit, savedAt } | null} */
export function readMonthCache(storeId, yearMonth) {
  const key = entryKey(storeId, yearMonth);
  if (!key.includes('__') || key.startsWith('__') || key.endsWith('__')) return null;
  const hit = readAll_()[key];
  if (!hit || !Array.isArray(hit.employees)) return null;
  return {
    employees: hit.employees,
    shifts: Array.isArray(hit.shifts) ? hit.shifts : [],
    memos: Array.isArray(hit.memos) ? hit.memos : [],
    canEdit: !!hit.canEdit,
    savedAt: Number(hit.savedAt) || 0,
  };
}

export function writeMonthCache(storeId, yearMonth, payload) {
  const key = entryKey(storeId, yearMonth);
  if (!key.includes('__') || key.startsWith('__') || key.endsWith('__')) return;
  const all = readAll_();
  all[key] = {
    employees: payload.employees || [],
    shifts: payload.shifts || [],
    memos: payload.memos || [],
    canEdit: !!payload.canEdit,
    savedAt: Date.now(),
  };
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    keys
      .map((k) => ({ k, t: Number(all[k]?.savedAt) || 0 }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach(({ k }) => { delete all[k]; });
  }
  writeAll_(all);
}

/** 同じ店舗の全キャッシュ月について、従業員1名の情報を部分更新する */
export function patchCachedEmployee(storeId, employeeId, patch) {
  const sid = String(storeId || '').trim();
  const eid = String(employeeId || '').trim();
  if (!sid || !eid || !patch) return;
  const all = readAll_();
  let touched = false;
  for (const key of Object.keys(all)) {
    if (!key.startsWith(`${sid}__`)) continue;
    const emps = all[key]?.employees;
    if (!Array.isArray(emps)) continue;
    let hit = false;
    const next = emps.map((e) => {
      if (String(e?.employee_id || '').trim() !== eid) return e;
      hit = true;
      return { ...e, ...patch };
    });
    if (hit) {
      all[key] = { ...all[key], employees: next };
      touched = true;
    }
  }
  if (touched) writeAll_(all);
}

export function hasMonthCache(storeId, yearMonth) {
  return !!readMonthCache(storeId, yearMonth);
}
