import { Fragment, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { applyAccentTheme, readStoredAccentId } from './accentThemes.js';
import { APP_TAGLINE } from './appBrand.js';
import { IconLoginArrow, LoginBgDecor, LoginHeroCopy, LoginLoadingPanel } from './LoginHero.jsx';
import { STAFF_TOKEN_KEY } from './staffAuth.js';
import { api } from './api.js';
import { readMonthCache, writeMonthCache, patchCachedEmployee } from './monthCache.js';
import { StoreChatFab, StoreChatPanel, buildCellSharePayload, useStoreChat } from './StoreChat.jsx';
import {
  LEAVE_BY_CODE,
  applyAutoHouteiToShifts,
  computeAutoHouteiMap,
  leaveCodeLabel,
  leaveCodePrintLabel,
  leaveCodeNeedsDummyShift,
  leaveCodeNeedsShiftTime,
  hideLeaveCode,
  markLeaveUsed,
  moveLeaveToUnused,
  moveLeaveToUsed,
  parseLeaveCode,
  readLeavePrefs,
  restoreLeaveCode,
  sortLeaveCodes,
  statusFromLeaveCode,
  summarizeEmpMonth,
} from './leaveCodes.js';

const EMAIL_KEY = 'shiftapp_user_email';
const STATUS_LABEL = { work: '出勤', off: '公休', pto: '有休', absent: '欠勤', undef: '未定' };
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** 週間テンプレの並び順（月曜始まり）。weekday は 0=日〜6=土 */
const WEEKDAY_TEMPLATE_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** 曜日ごとの文字色クラスを返す */
function weekdayTextClass(wd) {
  if (wd === 0) return 'text-[#b71c1c]';
  if (wd === 6) return 'text-[#1565c0]';
  return 'text-slate-700';
}

/** 例: 「7-2 店名　スタッフ」のような掲示用の見出しを作る */
function formatStoreStaffHeader(store) {
  return formatStoreStaffHeaderParts(store).label;
}

function formatStoreStaffHeaderParts(store) {
  const name = String(store?.store_name || '').trim();
  const areaNum = (String(store?.area || '').match(/(\d+)/) || [])[1] || '';
  const terrNum = (String(store?.territory || '').match(/(\d+)/) || [])[1] || '';
  let code = '';
  if (areaNum && terrNum) code = `${areaNum}-${terrNum}`;
  else if (areaNum) code = areaNum;
  const label = code && name
    ? `${code}${name}　スタッフ`
    : name
      ? `${name}　スタッフ`
      : '従業員';
  return { code, name, suffix: name || code ? 'スタッフ' : '', label };
}

function formatDateJa(ymd) {
  const s = String(ymd || '');
  const wd = new Date(`${s}T00:00:00`).getDay();
  if (!s || Number.isNaN(wd)) return s;
  const parts = s.split('-');
  return `${Number(parts[1])}月${Number(parts[2])}日（${WEEKDAY_LABELS[wd]}）`;
}

function IconArrowDown({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v7M8 10l-3 3M8 10l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowUp({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13V6M8 6L5 3M8 6l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 4.5h9M6 4.5V3.5h4v1M5.5 4.5l.5 8h4l.5-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRestore({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5M3 5v3h3M13 11v-3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.2L10.2 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ACCOUNT_MENU = [
  { id: 'jurisdiction', label: '管轄店舗変更' },
  { id: 'employees', label: 'スタッフ情報 追加・変更' },
  { id: 'weekly', label: '週間テンプレート作成' },
];

const SETTINGS_TITLES = {
  jurisdiction: { kicker: '設定', title: '管轄店舗変更', sub: '表示名・社員番号・担当店舗を選ぶ' },
  employees: { kicker: '設定', title: 'スタッフ情報 追加・変更', sub: '氏名・社員番号・勤務時間' },
  weekly: { kicker: '設定', title: '週間テンプレート作成', sub: '1週間の固定パターン' },
};

function IconMenuStore({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 6.5 8 3l5.5 3.5V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconMenuUsers({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 13c.2-1.6 1.2-2.8 2.8-2.8 1.2 0 2.2.7 2.7 1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconMenuCalendar({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 2.5v2M11 2.5v2M2.5 6.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const MENU_ICONS = {
  jurisdiction: IconMenuStore,
  employees: IconMenuUsers,
  weekly: IconMenuCalendar,
};

function ConfirmDialog({ box, onCancel }) {
  if (!box) return null;
  return (
    <div className="app-confirm-overlay" onClick={onCancel}>
      <div className="app-confirm-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="text-[1.05rem] font-extrabold text-slate-900">{box.title}</p>
        <p className="mt-3 text-[15px] font-semibold text-slate-800 leading-relaxed">{box.message}</p>
        {box.detail && <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{box.detail}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-5 py-3 rounded-2xl bg-white border border-black/5 font-bold text-slate-700">{(box.cancelLabel || 'いいえ')}</button>
          <button type="button" onClick={box.onConfirm} className="px-5 py-3 rounded-2xl bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/25 hover:bg-rose-700">
            {box.confirmLabel || 'はい'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveCodePicker({
  groups,
  query,
  onQuery,
  selected,
  onPick,
  onMoveToUsed,
  onMoveToUnused,
  onHide,
  onRestore,
  onOpenPtoHours,
  ptoHoursLabel,
  disabled,
}) {
  const [trashOpen, setTrashOpen] = useState(false);
  const q = String(query || '').trim();
  const match = (c) => !q || String(c.code).includes(q) || c.name.includes(q);
  const used = (groups.used || []).filter(match);
  const unused = (groups.unused || []).filter(match);
  const hidden = groups.hidden || [];
  const hiddenFiltered = hidden.filter(match);

  const row = (c, section) => {
    const on = Number(selected) === c.code;
    const isUnused = section === 'unused';
    return (
      <div key={`${section}-${c.code}`} className={`km-code-row-wrap ${on ? 'is-on' : ''}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(c.code)}
          className={`km-code-row-main ${isUnused ? 'leave-unused' : ''}`}
        >
          <span className="tabular-nums font-bold">{c.code}</span>
          <span>{c.name}</span>
        </button>
        <div className="km-code-actions">
          {isUnused ? (
            <button
              type="button"
              disabled={disabled}
              title="上へ（よく使う）"
              aria-label="上へ（よく使う）"
              onClick={() => onMoveToUsed(c.code)}
              className="km-code-act"
            >
              <IconArrowUp />
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              title="下へ（未使用）"
              aria-label="下へ（未使用）"
              onClick={() => onMoveToUnused(c.code)}
              className="km-code-act"
            >
              <IconArrowDown />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            title="非表示へ"
            aria-label="非表示へ"
            onClick={() => onHide(c.code)}
            className="km-code-act km-code-act-trash"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[16px] font-bold text-slate-800">休日休暇コード</p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="コード・名称で検索"
        className="w-full h-11 mb-2 border border-[#9db4c8] bg-[#eef3f8] px-3 text-[15px] outline-none"
        style={{ borderRadius: 2 }}
      />
      <div className="km-code-table max-h-[16.5rem] overflow-y-auto">
        <div className="km-code-head sticky top-0 z-10">
          <span>コード</span>
          <span>名称</span>
          <span aria-hidden="true" />
        </div>
        {used.length > 0 && (
          <>
            <div className="km-code-sep bg-[#e8f1fa] text-[#2f7ec4]">よく使う</div>
            {used.map((c) => row(c, 'used'))}
          </>
        )}
        {unused.length > 0 && (
          <>
            {used.length > 0 && <div className="km-code-sep">未使用</div>}
            {unused.map((c) => row(c, 'unused'))}
          </>
        )}
        {!used.length && !unused.length && (
          <p className="px-3 py-4 text-[14px] text-slate-500">該当するコードがありません</p>
        )}
      </div>
      <div className="mt-1.5 flex justify-end gap-2">
        <button
          type="button"
          disabled={disabled || !onOpenPtoHours}
          onClick={onOpenPtoHours}
          className="km-code-trash-toggle"
          title="有休取得時のIN・OUT時間"
          aria-label="有休取得時のIN・OUT時間"
        >
          <IconClock className="w-3.5 h-3.5" />
          <span>{ptoHoursLabel || 'IN・OUT'}</span>
        </button>
        <button
          type="button"
          disabled={disabled || !hidden.length}
          onClick={() => setTrashOpen((v) => !v)}
          className={`km-code-trash-toggle ${trashOpen ? 'is-open' : ''} ${hidden.length ? '' : 'is-empty'}`}
          title="非表示にしたコード"
        >
          <IconTrash className="w-3.5 h-3.5" />
          <span>非表示{hidden.length ? ` (${hidden.length})` : ''}</span>
        </button>
      </div>
      {trashOpen && hidden.length > 0 && (
        <div className="km-code-trash-panel">
          {(q ? hiddenFiltered : hidden).map((c) => (
            <div key={`h-${c.code}`} className="km-code-trash-row">
              <span className="tabular-nums font-bold text-slate-600">{c.code}</span>
              <span className="truncate text-slate-600">{c.name}</span>
              <button
                type="button"
                disabled={disabled}
                title="元に戻す"
                aria-label="元に戻す"
                onClick={() => onRestore(c.code)}
                className="km-code-restore"
              >
                <IconRestore />
                <span>戻す</span>
              </button>
            </div>
          ))}
          {q && !hiddenFiltered.length && (
            <p className="px-3 py-3 text-[13px] text-slate-500">該当する非表示コードがありません</p>
          )}
        </div>
      )}
    </div>
  );
}

function initialOf(name) {
  const s = String(name || '?').trim();
  return s ? s.charAt(0) : '?';
}

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

function hm5(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : '';
}

/** 掲示用の氏名: 姓と名の間に全角スペースを入れる */
function formatByeByePersonName(name) {
  let s = String(name || '').trim().replace(/[ 　]+/g, '　');
  if (!s) return '';
  if (s.includes('　')) return s;
  // よくある3文字姓を先に判定し、それ以外は2文字目のうしろで区切る
  const three = ['長谷川', '五十嵐', '諏訪部', '小野寺', '大久保', '佐々木', '仲村渠'];
  for (let i = 0; i < three.length; i += 1) {
    const sur = three[i];
    if (s.length > sur.length && s.startsWith(sur)) {
      return `${sur}　${s.slice(sur.length)}`;
    }
  }
  if (s.length >= 3) return `${s.slice(0, 2)}　${s.slice(2)}`;
  return s;
}

function formatByeShift(start, end, breakMinutes) {
  const s = hm5(start);
  const e = hm5(end);
  if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return '';
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let duration = (eh * 60 + em) - (sh * 60 + sm);
  if (duration < 0) duration += 1440;
  let breakStr = '';
  if (breakMinutes !== '' && breakMinutes != null && !Number.isNaN(Number(breakMinutes))) {
    const bm = Number(breakMinutes);
    // 休憩はGASの書式に合わせる: R1:00 / R0:00 の形で出す
    breakStr = `R${Math.floor(bm / 60)}:${pad2(bm % 60)}`;
  } else {
    breakStr = duration > 360 ? 'R1:00' : 'R0:00';
  }
  return `${s}-${e}${breakStr}`;
}

/** バイバイ勤務表に貼り付けるTSVを作る */
function buildByeByeTsv(employees, shifts, yearMonth) {
  const ym = String(yearMonth || '').trim();
  const parts = ym.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return { tsv: '', staffCount: 0, rowCount: 0, warnings: ['年月が不正です'] };
  const daysInMonth = new Date(year, month, 0).getDate();
  const warnings = [];
  const withCode = (employees || []).filter((e) => {
    const code = String(e.bye_code || e.employee_id || '').trim();
    if (!code) {
      warnings.push(`${e.name}：社員コード未登録（スキップ）`);
      return false;
    }
    return true;
  });
  if (!withCode.length) return { tsv: '', staffCount: 0, rowCount: 0, warnings: warnings.length ? warnings : ['社員コード付きの従業員がいません'] };

  const byEmpDate = {};
  (shifts || []).forEach((s) => {
    const date = String(s.date || '').slice(0, 10);
    const eid = String(s.employee_id || '').trim();
    if (eid && date) byEmpDate[`${eid}__${date}`] = s;
  });

  const dateHeaders = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const t = new Date(year, month - 1, d);
    dateHeaders.push(`${t.getMonth() + 1}/${t.getDate()}(${WEEKDAY_LABELS[t.getDay()]})`);
  }
  // ヘッダー行はGAS仕様: 開始日 / 「～」 / 終了日 / 空白 のあとに日付が並ぶ
  const headerRow = [`${year}/${month}/1`, '～', `${year}/${month}/${daysInMonth}`, ' '].concat(dateHeaders);
  const rowTypes = [
    { code: 215001, name: '休日・休暇' },
    { code: 215201, name: 'シフト' },
    { code: 215013, name: '休日・休暇(自動展開)' },
    { code: 215231, name: 'シフト(自動展開)' },
  ];
  const outputData = [];

  withCode.forEach((emp) => {
    const code = String(emp.bye_code || emp.employee_id).trim();
    const outputName = formatByeByePersonName(emp.name);
    const rowsForStaff = rowTypes.map((rt) => {
      const row = [code, outputName, rt.code, rt.name];
      for (let dd = 0; dd < daysInMonth; dd += 1) row.push('');
      return row;
    });
    const houtei = computeAutoHouteiMap(shifts, emp.employee_id, ym);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${ym}-${pad2(day)}`;
      const idx = day - 1;
      const s = byEmpDate[`${emp.employee_id}__${date}`]
        || byEmpDate[`${emp.bye_code}__${date}`]
        || byEmpDate[`${code}__${date}`];
      const status = s ? String(s.status || '') : '';
      const leaveCode = parseLeaveCode(s?.leave_code);
      let valForShift = '';

      if (leaveCode && leaveCode !== 10 && leaveCode !== 20 && leaveCode !== 999) {
        rowsForStaff[0][4 + idx] = leaveCode;
        if (leaveCodeNeedsShiftTime(leaveCode)) {
          valForShift = formatByeShift(s.start_time, s.end_time, s.break_minutes);
          if (!valForShift) warnings.push(`${emp.name} ${date}：${leaveCodeLabel(leaveCode)}なのに時刻不正`);
        } else if (leaveCodeNeedsDummyShift(leaveCode)) {
          valForShift = formatByeShift(s.start_time, s.end_time, s.break_minutes) || '8:30-17:30R1:00';
        }
      } else if (houtei[date]) {
        rowsForStaff[0][4 + idx] = houtei[date];
      } else if (status === 'absent') {
        rowsForStaff[0][4 + idx] = 80;
      } else if (status === 'pto') {
        rowsForStaff[0][4 + idx] = 61;
        valForShift = formatByeShift(s?.start_time, s?.end_time, s?.break_minutes) || '8:30-17:30R1:00';
      } else if (status === 'work') {
        valForShift = formatByeShift(s.start_time, s.end_time, s.break_minutes);
        if (!valForShift) warnings.push(`${emp.name} ${date}：勤務なのに時刻不正`);
      }

      if (valForShift) rowsForStaff[1][4 + idx] = valForShift;
    }

    // 1人あたり4行（GASの行種別）をまとめて出力する
    rowsForStaff.forEach((rr) => outputData.push(rr));
  });

  const colCount = 4 + daysInMonth;
  const tsv = [headerRow].concat(outputData).map((row) => {
    const cells = row.slice(0, colCount).map((cell) => String(cell == null ? '' : cell).replace(/[\t\r\n]+/g, ' '));
    return cells.join('\t');
  }).join('\n');
  return { tsv, staffCount: withCode.length, rowCount: outputData.length + 1, warnings };
}

async function copyTextSafe(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
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

/** 印刷用の時刻表示: 分が00なら "8"、それ以外は "8:30" */
function formatPrintTimePart(hm) {
  const m = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = String(Number(m[1]));
  return m[2] === '00' ? h : `${h}:${m[2]}`;
}

/** 例: 8-17 / 8:30-17 / 8-17:30 / 8:30-17:30 */
function formatPrintTimeRange(startHm, endHm) {
  const a = formatPrintTimePart(startHm);
  const b = formatPrintTimePart(endHm);
  if (a && b) return `${a}-${b}`;
  return a || b || '';
}

/** 0:00〜24:00 を step 分刻みで作る */
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

const NAME_COL_W = 280;
const DAY_COL_W = 118;
const SHIFT_ROW_H = 80;
/** MEMO行の高さ（px） */
const MEMO_ROW_H = 80;
const MEMO_MAX_LINES = 5;
const CELL_FOCUS_RING = 'inset 0 0 0 2px #18181b';
/** 罫線を separate + 1px で描くためのセル用クラス */
const SHEET_DAY = 'sheet-day-cell';
const SHEET_NAME = 'sheet-name-cell';

function clampMemoBody(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length <= MEMO_MAX_LINES) return lines.join('\n');
  return lines.slice(0, MEMO_MAX_LINES).join('\n');
}

function monthDays(daysInMonth) {
  if (!daysInMonth) return [];
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

const SHIFT_STATUS_OPTIONS = [
  { id: 'blank', label: '空欄', title: '空欄にする' },
  { id: 'work', label: '○', title: '出勤' },
  { id: 'off', label: '×', title: '休み' },
];

function shiftCategoryId(shift, autoLeaveCode = 0) {
  const status = shift?.status || 'undef';
  const lc = parseLeaveCode(shift?.leave_code) || parseLeaveCode(autoLeaveCode);
  const hasTime = !!(shift?.start_time || shift?.end_time);
  if ((status === 'undef' || status === '') && !lc && !hasTime) return 'blank';
  if (status === 'work') return 'work';
  if (status === 'off' || lc === 10 || lc === 20) return 'off';
  return '';
}

/** アルバイトの勤務時間の選択肢 */
const PART_HOUR_OPTIONS = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
/** 社員の勤務時間の選択肢 */
const FULL_HOUR_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const TIME_STEP_MIN = 30;
/** 社員の基本: 実働8h + 休憩1h = 拘束9h */
const FULLTIME_SPAN_HOURS = 9;

function normalizeEmpType(type) {
  const t = String(type || '社員').trim();
  if (t === 'パート' || t === 'アルバイト') return 'アルバイト';
  return '社員';
}

function isFullTimeEmp(emp) {
  return normalizeEmpType(emp?.employment_type) === '社員';
}

/** 従業員の work_hours から1日の拘束時間（休憩込み）を求める */
function spanHoursForEmp(emp) {
  const wh = Number(emp?.work_hours);
  if (wh > 0) return wh;
  return isFullTimeEmp(emp) ? FULLTIME_SPAN_HOURS : 4;
}

function hourOptionsForEmp(emp) {
  return isFullTimeEmp(emp) ? FULL_HOUR_OPTIONS : PART_HOUR_OPTIONS;
}

/** 雇用区分を切り替えたときに勤務時間を引き継ぐ */
function carryOverHours(emp, nextType) {
  const wh = Number(emp?.work_hours);
  const allowed = nextType === '社員' ? FULL_HOUR_OPTIONS : PART_HOUR_OPTIONS;
  return allowed.includes(wh) ? wh : '';
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
  return { status: 'work', start_time: start, end_time: end, leave_code: '' };
}

function hmToMinutes(hm) {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 開始と終了から拘束時間を求める（0.5h単位） */
function spanHoursBetweenHm(start, end) {
  const a = hmToMinutes(start);
  const b = hmToMinutes(end);
  if (a == null || b == null) return null;
  let diff = b - a;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

/** 週間テンプレートで選べる拘束時間の候補 */
const WEEKLY_SPAN_OPTIONS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const PTO_TEMPLATE_KEY = 'shiftapp_pto_time_template_v1';

function defaultPtoTemplate(emp) {
  if (isFullTimeEmp(emp)) {
    return { start_time: '10:00', end_time: '19:00', break_minutes: 60 };
  }
  const start = '10:00';
  const hours = spanHoursForEmp(emp);
  return {
    start_time: start,
    end_time: addHoursToHm(start, hours),
    break_minutes: hours >= 6 ? 60 : 0,
  };
}

function readAllPtoTemplates_() {
  try {
    const raw = localStorage.getItem(PTO_TEMPLATE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function resolvePtoTemplate(employeeId, emp) {
  const hit = readAllPtoTemplates_()[String(employeeId || '')];
  if (hit && hit.start_time && hit.end_time) {
    const start = snapToStep(hit.start_time, TIME_STEP_MIN);
    const end = snapToStep(hit.end_time, TIME_STEP_MIN);
    let br = hit.break_minutes;
    if (br === '' || br == null || Number.isNaN(Number(br))) {
      const a = start.match(/^(\d{1,2}):(\d{2})$/);
      const b = end.match(/^(\d{1,2}):(\d{2})$/);
      let dur = 0;
      if (a && b) {
        dur = (Number(b[1]) * 60 + Number(b[2])) - (Number(a[1]) * 60 + Number(a[2]));
        if (dur < 0) dur += 1440;
      }
      br = dur > 360 ? 60 : 0;
    }
    return { start_time: start, end_time: end, break_minutes: Number(br) || 0 };
  }
  return defaultPtoTemplate(emp);
}

function savePtoTemplate(employeeId, tpl) {
  const id = String(employeeId || '').trim();
  if (!id) return;
  const all = readAllPtoTemplates_();
  all[id] = {
    start_time: snapToStep(tpl.start_time || '10:00', TIME_STEP_MIN),
    end_time: snapToStep(tpl.end_time || '19:00', TIME_STEP_MIN),
    break_minutes: tpl.break_minutes === '' || tpl.break_minutes == null ? 60 : Number(tpl.break_minutes),
  };
  try {
    localStorage.setItem(PTO_TEMPLATE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** 勤務時間の入力を読み取る正規表現（例: 10-16 / 12:30-21:30） */
const SHIFT_TIME_RANGE_RE = /(\d{1,2})(?::(\d{2}))?\s*[-~〜ー－—/／]\s*(\d{1,2})(?::(\d{2}))?/;
const SHIFT_TIME_ONLY_RE = /^(\d{1,2})(?::(\d{2}))?$/;

function normalizeShiftRaw(raw) {
  return String(raw ?? '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[：]/g, ':')
    .replace(/[－—–〜～]/g, '-');
}

function shiftFromTimeMatch(range) {
  const start = snapToStep(`${pad2(Number(range[1]))}:${range[2] || '00'}`, TIME_STEP_MIN);
  const end = snapToStep(`${pad2(Number(range[3]))}:${range[4] || '00'}`, TIME_STEP_MIN);
  return { status: 'work', start_time: start, end_time: end, leave_code: '' };
}

/** 「13:00 と 22:00」のような2行入力から IN/OUT を取り出す */
function parseStackedTimes(original) {
  const lines = String(original || '')
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\s+/g, ''))
    .filter(Boolean);
  if (lines.length < 2) return null;
  const t1 = lines[0].match(SHIFT_TIME_ONLY_RE);
  const t2 = lines[1].match(SHIFT_TIME_ONLY_RE);
  if (!t1 || !t2) return null;
  return shiftFromTimeMatch([null, t1[1], t1[2], t2[1], t2[2]]);
}

function looksLikeStackedTimesCell(text) {
  if (String(text || '').includes('\t')) return false;
  return !!parseStackedTimes(normalizeShiftRaw(text));
}

/** 入力文字列をシフトに変換する（例: 10-16 / 12:00-21:00） */
function parseShiftDraft(raw, emp) {
  const original = normalizeShiftRaw(raw).trim();
  if (!original) return { status: 'undef', start_time: '', end_time: '', leave_code: '' };

  // まず2行入力の IN / OUT を試す
  const stacked = parseStackedTimes(original);
  if (stacked) return stacked;

  // 1行目だけを見て判定する
  const firstLine = original.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  const text = firstLine.replace(/\s+/g, '');

  if (text === '○' || text === '◯' || text === '〇') return workTimesFromIn(emp, '12:00');
  if (text === '×' || text === '✕' || text === '✖' || text.toLowerCase() === 'x') {
    return { status: 'off', start_time: '', end_time: '', leave_code: '' };
  }

  const byCode = LEAVE_BY_CODE[Number(text)];
  const byName = Object.values(LEAVE_BY_CODE).find((c) => c.name === text);
  const hitLeave = byCode || byName;
  if (hitLeave) {
    const status = statusFromLeaveCode(hitLeave.code);
    if (status === 'work') return { status, leave_code: hitLeave.code };
    return { status, leave_code: hitLeave.code, start_time: '', end_time: '' };
  }

  const leaveMap = [
    { keys: ['公休', '休み', '休', '不在', 'off'], status: 'off' },
    { keys: ['有休', '有給', 'pto'], status: 'pto', leave_code: 61 },
    { keys: ['欠勤', 'absent'], status: 'absent', leave_code: 80 },
  ];
  for (const row of leaveMap) {
    if (row.keys.some((k) => text === k || text.toLowerCase() === k)) {
      return { status: row.status, leave_code: row.leave_code || '', start_time: '', end_time: '' };
    }
  }
  if (text === '勤務' || text.toLowerCase() === 'work') {
    return workTimesFromIn(emp, '12:00');
  }

  const range = text.match(/^(\d{1,2})(?::(\d{2}))?[-~〜ー－—/／](\d{1,2})(?::(\d{2}))?$/);
  if (range) return shiftFromTimeMatch(range);

  const single = text.match(SHIFT_TIME_ONLY_RE);
  if (single) {
    return workTimesFromIn(emp, `${pad2(Number(single[1]))}:${single[2] || '00'}`);
  }

  // 文章の中に「10-16」のような時刻があれば拾う
  const embedded = original.match(SHIFT_TIME_RANGE_RE);
  if (embedded) {
    const idx = original.search(SHIFT_TIME_RANGE_RE);
    const prefix = original.slice(0, idx).replace(/\s+/g, '');
    if (!prefix) return shiftFromTimeMatch(embedded);
    return null;
  }

  return null;
}

/**
 * Sheets/Excel の TSV は "..." で囲まれることがあるため、単純な split では分割できない */
function parseTsvGrid(text) {
  const src = String(text ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === '\t') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => String(c).length) || rows.length === 0) rows.push(row);
  return rows;
}

/** クリップボード（Sheets/Excel）の表を○×グリッドとして読む */
function parseClipboardGrid(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];
  // 1セルに IN/OUT が縦2行で入っている場合
  if (looksLikeStackedTimesCell(normalized)) {
    return [[normalized.trim()]];
  }
  // 末尾の空行は Sheets 由来なので落とす
  return parseTsvGrid(normalized.replace(/\n+$/, ''));
}

function clipboardGridIsMulti(grid) {
  if (!grid.length) return false;
  if (grid.length > 1) return true;
  return (grid[0]?.length || 0) > 1;
}

/** 貼り付けたグリッドのラベル列を推定する */
function detectPasteLabelColumn(grid, emp) {
  if (!grid[0] || grid[0].length < 2) return 0;
  const head = String(grid[0][0] ?? '').trim();
  if (!head) return 0;
  if (parseShiftDraft(head, emp) !== null) return 0;
  return 1;
}

function draftFromShift(s) {
  const leaveName = leaveCodeLabel(s?.leave_code);
  if (leaveName) return leaveName;
  const status = s?.status || 'undef';
  if (status === 'work') {
    const a = String(s.start_time || '').slice(0, 5);
    const b = String(s.end_time || '').slice(0, 5);
    return a && b ? `${a}-${b}` : a || '';
  }
  if (status === 'off') return '×';
  if (status === 'pto') return '有休';
  if (status === 'absent') return '欠勤';
  return '';
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
const inputCls = 'bg-[#eef3f8] border-0 rounded-xl px-3 py-3 text-[15px] font-medium text-slate-900 w-full';
const labelCls = 'flex flex-col gap-1.5 text-[15px] font-semibold text-slate-700';
const panelTitleCls = 'text-[17px] font-bold text-slate-900';
const panelSubCls = 'text-[14px] text-slate-500';
const weeklySelCls = 'rounded-lg border border-slate-200 bg-white px-2 py-2 text-[15px] font-bold tabular-nums text-slate-900 disabled:opacity-45';
const weeklyBulkBtnCls = 'px-3 py-1.5 rounded-lg text-[13px] font-bold border border-slate-300 bg-white text-slate-700 disabled:opacity-40';

export default function App() {
  const [authStep, setAuthStep] = useState('loading'); // loading | login | ready
  const [settingsPanel, setSettingsPanel] = useState(null); // null | jurisdiction | employees | weekly
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [managerAuthMode, setManagerAuthMode] = useState('login'); // register | login
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regByeCode, setRegByeCode] = useState('');
  const [regArea, setRegArea] = useState('');
  const [regTerritory, setRegTerritory] = useState('');
  const [regStores, setRegStores] = useState([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmBox, setConfirmBox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('処理中…');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState('');
  const [progress, setProgress] = useState(null); // null | 0-100
  const progressTimer = useRef(null);
  const progressHideTimer = useRef(null);
  const msgTimer = useRef(null);

  const [storeId, setStoreId] = useState('');
  const [yearMonth, setYearMonth] = useState('');

  // jurisdiction form
  const [displayName, setDisplayName] = useState('');
  const [byeCode, setByeCode] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);

  // employees
  const [employees, setEmployees] = useState([]);
  const [empForm, setEmpForm] = useState({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 });
  const [empFormOpen, setEmpFormOpen] = useState(false);

  // weekly
  const [weekly, setWeekly] = useState([]); // map-like array
  const [weeklyEmpId, setWeeklyEmpId] = useState('');
  const weeklyEmpIdRef = useRef('');
  const [weeklySpanH, setWeeklySpanH] = useState(null); // 拘束時間の上書き（null=従業員設定のまま）
  const [weeklyStatus, setWeeklyStatus] = useState('idle'); // idle | saving | saved
  const [weeklyBulkStart, setWeeklyBulkStart] = useState('10:00');

  // monthly grid
  const [shifts, setShifts] = useState([]);
  const [memos, setMemos] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [dirtyMemoKeys, setDirtyMemoKeys] = useState(() => new Set());
  const [focusCell, setFocusCell] = useState(null); // { employee_id, date, layer?: 'shift'|'memo', editing?: boolean }
  const [shiftEditor, setShiftEditor] = useState(null); // { employee_id, date }
  const [empEditorId, setEmpEditorId] = useState(null); // 従業員編集ダイアログの対象
  const [memoOpenIds, setMemoOpenIds] = useState(() => new Set()); // employee_id ごとのMEMO展開状態
  const [editDraft, setEditDraft] = useState('');
  const sheetAreaRef = useRef(null);
  const cellEditRef = useRef(null);
  const historyRef = useRef({ past: [], future: [], applying: false });
  const [historyTick, setHistoryTick] = useState(0);
  const [kintaiToast, setKintaiToast] = useState(null); // { kind: 'ok'|'err', text: string } | null
  const kintaiToastTimer = useRef(null);
  const [calendarProgress, setCalendarProgress] = useState(null); // { percent, label } | null
  const calendarJobRef = useRef(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [leavePrefs, setLeavePrefs] = useState({ used: {}, hidden: [] });
  const [leaveQuery, setLeaveQuery] = useState('');
  const [ptoTemplateOpen, setPtoTemplateOpen] = useState(false);
  const [ptoTemplateDraft, setPtoTemplateDraft] = useState({ start_time: '10:00', end_time: '19:00', break_minutes: 60 });
  const [ptoTemplateTick, setPtoTemplateTick] = useState(0);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyRefreshing, setMonthlyRefreshing] = useState(false);
  const [empDragId, setEmpDragId] = useState(null);
  const [empDragOverId, setEmpDragOverId] = useState(null);
  const empDragRef = useRef(null);
  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const dirtyKeysRef = useRef(dirtyKeys);
  dirtyKeysRef.current = dirtyKeys;
  const dirtyMemoKeysRef = useRef(dirtyMemoKeys);
  dirtyMemoKeysRef.current = dirtyMemoKeys;
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;
  const memosRef = useRef(memos);
  memosRef.current = memos;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;
  const yearMonthRef = useRef(yearMonth);
  yearMonthRef.current = yearMonth;
  const userEmailRef = useRef(user?.email || '');
  userEmailRef.current = user?.email || '';
  const flushChainRef = useRef(Promise.resolve());
  const loadMonthGenRef = useRef(0);
  const autoSaveTimer = useRef(null);
  const weeklySaveTimer = useRef(null);
  const weeklyRef = useRef([]);
  const weeklyEditSeq = useRef(0);
  const weeklySavePromise = useRef(null);
  const weeklyTouchedEmps = useRef(new Set());
  const weeklyLoadedRef = useRef(false);

  const accountInitial = useMemo(() => initialOf(user?.name || user?.email), [user]);
  const domain = meta?.companyDomain || 'okamoto-group.co.jp';
  const storeName = user?.stores?.find((s) => s.store_id === storeId)?.store_name || '';
  const chat = useStoreChat({ storeId, user, enabled: authStep === 'ready' && !!storeId });

  useEffect(() => {
    applyAccentTheme(readStoredAccentId());
  }, []);

  // 選択セルが画面外なら scrollIntoView で寄せる
  useEffect(() => {
    if (!focusCell || focusCell.editing || focusCell.layer === 'memo') return undefined;
    const key = `${focusCell.employee_id}__${focusCell.date}`;
    const id = window.setTimeout(() => {
      const el = sheetAreaRef.current?.querySelector(`[data-shift-cell="${key}"]`);
      if (!el || document.activeElement === el) return;
      el.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusCell?.employee_id, focusCell?.date, focusCell?.editing, focusCell?.layer]);

  useEffect(() => {
    if (authStep !== 'ready' || !canEdit) return undefined;
    const total = dirtyKeys.size + dirtyMemoKeys.size;
    if (!total) return undefined;
    setSaveState('pending');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    // 人数が多いときは自動保存の間隔を長めにする
    const delay = total > 40 ? 1800 : 600;
    autoSaveTimer.current = setTimeout(() => {
      flushDirtyShifts({ quiet: true });
    }, delay);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirtyKeys, dirtyMemoKeys, canEdit, authStep]);

  // タブを閉じる／裏に回したときも未送信を送る（操作は止めない）
  useEffect(() => {
    if (authStep !== 'ready') return undefined;
    const kickFlush = () => {
      if (!(dirtyKeysRef.current.size || dirtyMemoKeysRef.current.size)) return;
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      void flushDirtyShifts({ quiet: true });
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') kickFlush();
    };
    const onPageHide = () => kickFlush();
    const onBeforeUnload = (ev) => {
      if (!(dirtyKeysRef.current.size || dirtyMemoKeysRef.current.size)) return;
      kickFlush();
      ev.preventDefault();
      ev.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [authStep]);

  useEffect(() => {
    if (user?.email) setLeavePrefs(readLeavePrefs(user.email));
  }, [user?.email]);

  useEffect(() => {
    if (authStep !== 'ready' || !user?.stores?.length || monthlyLoading) return;
    const allowed = user.stores.map((s) => s.store_id);
    if (storeId && allowed.includes(storeId)) return;
    const sid = allowed[0] || '';
    if (!sid) return;
    resetWorkspaceState();
    setStoreId(sid);
    if (yearMonth) {
      loadMonthly(sid, yearMonth, { quiet: true });
    }
  }, [authStep, user?.stores, storeId, yearMonth]);

  function scheduleWeeklySave() {
    if (!canEdit) return;
    if (weeklySaveTimer.current) clearTimeout(weeklySaveTimer.current);
    weeklySaveTimer.current = setTimeout(() => saveWeekly({ quiet: true }), 400);
  }

  useEffect(() => {
    if (settingsPanel === 'weekly') return;
    if (!weeklySaveTimer.current) return;
    clearTimeout(weeklySaveTimer.current);
    weeklySaveTimer.current = null;
    saveWeekly({ quiet: true });
  }, [settingsPanel]);

  useEffect(() => {
    if (!shiftEditor && !empEditorId && !settingsPanel) return undefined;
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (focusCell?.editing) return;
      if (settingsPanel) { setSettingsPanel(null); return; }
      setShiftEditor(null);
      setEmpEditorId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shiftEditor, empEditorId, focusCell?.editing, settingsPanel]);

  useEffect(() => {
    if (authStep !== 'ready') return undefined;
    const onKey = (ev) => {
      const mod = ev.ctrlKey || ev.metaKey;
      if (!mod) return;
      const tag = String(ev.target?.tagName || '').toUpperCase();
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      const key = String(ev.key || '').toLowerCase();
      if (key === 'z') {
        if (inField) return;
        ev.preventDefault();
        if (ev.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      if (key === 'y') {
        if (inField) return;
        ev.preventDefault();
        redoEdit();
        return;
      }
      if (key === 'p') {
        ev.preventDefault();
        printShiftSheet();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [authStep, busy, historyTick, shifts, memos, dirtyKeys, dirtyMemoKeys]);

  // タブのタイトルを店舗名と年月に合わせる
  useEffect(() => {
    if (authStep !== 'app' || !yearMonth) return;
    const [yStr, mStr] = String(yearMonth).split('-');
    const y = Number(yStr) || '';
    const m = Number(mStr) || '';
    const storeLabel = String(storeName || 'シフト').trim();
    if (!y || !m) return;
    document.title = `${storeLabel}${y}／${m}月シフト`;
  }, [authStep, yearMonth, storeName]);

  // Ctrl+P と印刷イベントに合わせて印刷用の設定を切り替える
  useEffect(() => {
    if (authStep !== 'app') return undefined;
    const onBeforePrint = () => {
      if (!employees.length || !yearMonth) return;
      const n = Math.max(employees.length, 1);
      let scale = 'md';
      if (n <= 6) scale = 'lg';
      else if (n <= 10) scale = 'md';
      else if (n <= 14) scale = 'sm';
      else scale = 'xs';
      const rowHmm = Math.max(5.5, Math.min(9.5, (78 / n)));
      document.documentElement.setAttribute('data-print-scale', scale);
      document.documentElement.style.setProperty('--print-emps', String(n));
      document.documentElement.style.setProperty('--print-row-h', `${rowHmm.toFixed(2)}mm`);
      document.documentElement.classList.add('is-printing');
      const [yStr, mStr] = String(yearMonth).split('-');
      const y = Number(yStr) || '';
      const m = Number(mStr) || '';
      const storeLabel = String(storeName || 'シフト').trim();
      if (y && m) document.title = `${storeLabel}${y}／${m}月シフト`;
    };
    const onAfterPrint = () => {
      document.documentElement.classList.remove('is-printing');
      document.documentElement.removeAttribute('data-print-scale');
      document.documentElement.style.removeProperty('--print-emps');
      document.documentElement.style.removeProperty('--print-row-h');
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [authStep, employees.length, yearMonth, storeName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boot = await api.getBootstrap();
        if (cancelled) return;
        setMeta(boot);
        setYearMonth(boot.serverYearMonth || '');
        if (boot.sessionEmail) setLoginEmail(boot.sessionEmail);
        // GAS 側で無効になったトークンは捨てる
        localStorage.removeItem(STAFF_TOKEN_KEY);
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

  /** 画面上部に短いメッセージを出す */
  function notify(text, kind = '') {
    if (kind === 'ok') {
      setMsg('');
      setMsgKind('');
      return;
    }
    setMsg(text);
    setMsgKind(kind);
    if (kind === 'err') {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMsg(''), 6000);
    }
  }

  function startProgress() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(6);
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        const cur = p == null ? 6 : p;
        if (cur >= 92) return 92;
        return Math.min(92, cur + Math.max(1, Math.round((94 - cur) / 14)));
      });
    }, 200);
  }

  function finishProgress() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(100);
    if (progressHideTimer.current) clearTimeout(progressHideTimer.current);
    progressHideTimer.current = setTimeout(() => setProgress(null), 420);
  }

  /** 店舗や年月を切り替えるときに編集状態を捨てる */
  function resetWorkspaceState() {
    setShifts([]);
    setMemos([]);
    setEmployees([]);
    if (weeklySaveTimer.current) {
      clearTimeout(weeklySaveTimer.current);
      weeklySaveTimer.current = null;
    }
    weeklyRef.current = [];
    weeklyLoadedRef.current = false;
    weeklyTouchedEmps.current = new Set();
    setWeekly([]);
    setWeeklyEmpId('');
    setWeeklySpanH(null);
    setDirtyKeys(new Set());
    setDirtyMemoKeys(new Set());
    setFocusCell(null);
    setShiftEditor(null);
    setEmpEditorId(null);
    setEditDraft('');
    setSaveState('idle');
    setKintaiToast(null);
    setMsg('');
    setMsgKind('');
    setEmpForm({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 });
    setEmpFormOpen(false);
  }

  async function switchStore(sid, ym = yearMonth) {
    if (!sid || !user?.email) return;
    const allowed = (user?.stores || []).some((s) => s.store_id === sid);
    if (!allowed) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    const prevSid = storeId;
    const prevYm = yearMonth;
    if (dirtyKeysRef.current.size || dirtyMemoKeysRef.current.size) {
      // 切替前の店舗データを捨てない（裏保存。キャッシュがあれば待たない）
      const flushP = flushDirtyShifts({ quiet: true, storeId: prevSid, yearMonth: prevYm });
      const cached = readMonthCache(sid, ym);
      if (!cached?.employees?.length) await flushP;
      else void flushP;
    }
    resetWorkspaceState();
    setStoreId(sid);
    setAccountOpen(false);
    if (ym) await loadMonthly(sid, ym, { quiet: true });
  }

  async function withBusy(label, fn) {
    setBusyText(label || '処理中…');
    setBusy(true);
    startProgress();
    try {
      return await fn();
    } finally {
      setBusy(false);
      finishProgress();
    }
  }

  async function login(email, bootMeta = meta) {
    setLoginError('');
    setBusyText('ログイン中…');
    setBusy(true);
    startProgress();
    try {
      localStorage.removeItem(STAFF_TOKEN_KEY);
      const res = await api.loginWithEmail(email);
      if (res.needsJurisdiction) {
        throw new Error('まだ登録が完了していません。「登録」タブから入力してください。');
      }
      localStorage.setItem(EMAIL_KEY, res.email);
      setUser(res);
      const firstStore = res.stores?.[0]?.store_id || '';
      const ym = (bootMeta || meta)?.serverYearMonth || yearMonth;
      setStoreId(firstStore);
      setYearMonth(ym);
      setAuthStep('ready');
      setDisplayName(res.name || '');
      setByeCode(res.bye_code || '');
      setSettingsPanel(null);
      if (firstStore && ym) {
        setBusy(false);
        await loadMonthly(firstStore, ym, { quiet: true, userEmail: res.email });
      }
    } catch (e) {
      setLoginError(e.message || String(e));
      setAuthStep('login');
      localStorage.removeItem(EMAIL_KEY);
    } finally {
      setBusy(false);
      finishProgress();
    }
  }

  async function registerManager() {
    setLoginError('');
    const email = String(loginEmail || '').trim();
    const name = String(regDisplayName || '').trim() || email.split('@')[0];
    const code = String(regByeCode || '').trim();
    if (!email) {
      setLoginError('メールアドレスを入力してください');
      return;
    }
    if (!code) {
      setLoginError('社員番号を入力してください');
      return;
    }
    if (!regStores.length) {
      setLoginError('管轄店舗を1つ以上選んでください');
      return;
    }
    setBusyText('登録中…');
    setBusy(true);
    try {
      localStorage.removeItem(STAFF_TOKEN_KEY);
      await api.loginWithEmail(email);
      const res = await api.saveJurisdiction({
        user_email: email,
        display_name: name,
        bye_code: code,
        store_ids: regStores,
        role: 'editor',
      });
      localStorage.setItem(EMAIL_KEY, res.email);
      setUser(res);
      setDisplayName(res.name || name);
      setByeCode(res.bye_code || code);
      const firstStore = res.stores?.[0]?.store_id || '';
      const ym = meta?.serverYearMonth || yearMonth;
      setStoreId(firstStore);
      setYearMonth(ym);
      setAuthStep('ready');
      setSettingsPanel(null);
      if (firstStore && ym) {
        setBusy(false);
        await loadMonthly(firstStore, ym, { quiet: true, userEmail: res.email });
      }
      notify('登録が完了しました', 'ok');
    } catch (e) {
      setLoginError(e.message || String(e));
      setAuthStep('login');
      localStorage.removeItem(EMAIL_KEY);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (weeklySaveTimer.current) clearTimeout(weeklySaveTimer.current);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(STAFF_TOKEN_KEY);
    resetWorkspaceState();
    setUser(null);
    setStoreId('');
    setAccountOpen(false);
    setAuthStep('login');
    setSettingsPanel(null);
    setLoginError('');
    setConfirmBox(null);
    setBusy(false);
  }

  const catalogStores = useMemo(() => {
    const catalog = Array.isArray(user?.allStores) ? user.allStores : [];
    if (catalog.length) return catalog;
    const owned = Array.isArray(user?.stores) ? user.stores : [];
    if (owned.length) {
      return owned.map((s) => ({
        store_id: s.store_id,
        store_name: s.store_name,
        area: s.area || '',
        territory: s.territory || '',
      }));
    }
    // 店舗一覧が取れないときの最低限のフォールバック
    return [
      { store_id: 'S001', store_name: '経堂', area: '第7エリア', territory: '' },
      { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア', territory: '' },
    ];
  }, [user]);

  const currentStore = useMemo(() => {
    const fromUser = (user?.stores || []).find((s) => s.store_id === storeId) || {};
    const fromCatalog = catalogStores.find((s) => s.store_id === storeId) || {};
    return {
      ...fromCatalog,
      ...fromUser,
      area: fromUser.area || fromCatalog.area || '',
      territory: fromUser.territory || fromCatalog.territory || '',
      store_name: fromUser.store_name || fromCatalog.store_name || storeName || '',
    };
  }, [user?.stores, catalogStores, storeId, storeName]);
  const staffColLabel = useMemo(() => formatStoreStaffHeader(currentStore), [currentStore]);
  const staffColParts = useMemo(() => formatStoreStaffHeaderParts(currentStore), [currentStore]);

  const catalogAreas = useMemo(() => {
    if (user?.areas?.length) return user.areas;
    const seen = {};
    const out = [];
    catalogStores.forEach((s) => {
      const a = String(s.area || '').trim();
      if (!a || seen[a]) return;
      seen[a] = true;
      out.push(a);
    });
    return out.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [user, catalogStores]);

  const needsAreaFilter = catalogAreas.length > 0;

  const usesTerritory = useMemo(
    () => catalogStores.some((s) => String(s.territory || '').trim()),
    [catalogStores],
  );

  const territoryOptions = useMemo(() => {
    const filtered = selectedArea ? catalogStores.filter((s) => s.area === selectedArea) : catalogStores;
    const seen = {};
    const out = [];
    filtered.forEach((s) => {
      const t = String(s.territory || '').trim();
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [catalogStores, selectedArea]);

  const areaStores = useMemo(() => {
    const area = selectedArea && selectedArea !== 'すべて' ? selectedArea : '';
    const territory = selectedTerritory && selectedTerritory !== 'すべて' ? selectedTerritory : '';
    return catalogStores.filter((s) => {
      if (area && s.area !== area) return false;
      if (usesTerritory && territory && s.territory !== territory) return false;
      return true;
    });
  }, [catalogStores, selectedArea, selectedTerritory, usesTerritory]);

  useEffect(() => {
    if (settingsPanel !== 'jurisdiction') return;
    if (selectedArea === 'すべて') setSelectedArea('');
  }, [settingsPanel, selectedArea]);

  function onAreaChange(area) {
    setSelectedArea(area === 'すべて' ? '' : area);
    setSelectedTerritory('');
  }

  function onTerritoryChange(territory) {
    setSelectedTerritory(territory);
    setSelectedStores((prev) => {
      const allowed = catalogStores.filter((s) => {
        if (selectedArea && s.area !== selectedArea) return false;
        if (territory && s.territory !== territory) return false;
        return true;
      }).map((s) => s.store_id);
      return prev.filter((id) => allowed.includes(id));
    });
  }

  function toggleStore(id) {
    setSelectedStores((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveJurisdiction() {
    const name = String(displayName || '').trim() || String(user?.email || '').split('@')[0] || '';
    const code = String(byeCode || '').trim();
    if (!code) {
      notify('社員番号を入力してください。', 'err');
      return;
    }
    if (!selectedStores.length) {
      notify('管轄店舗を1つ以上選んでください。', 'err');
      return;
    }
    try {
      await withBusy('保存中…', async () => {
        if (dirtyKeys.size || dirtyMemoKeys.size) {
          await flushDirtyShifts({ quiet: true });
        }
        const res = await api.saveJurisdiction({
          user_email: user.email,
          display_name: name,
          bye_code: code,
          store_ids: selectedStores,
          role: 'editor',
        });
        resetWorkspaceState();
        setUser(res);
        setDisplayName(res.name || name);
        setByeCode(res.bye_code || code);
        const allowed = (res.stores || []).map((s) => s.store_id);
        setSelectedStores(allowed);
        const ym = meta?.serverYearMonth || yearMonth;
        setYearMonth(ym);
        const sid = allowed[0] || '';
        setStoreId(sid);
        notify(user?.needsJurisdiction ? '初回登録が完了しました' : '管轄店舗を更新しました', 'ok');
        if (sid && ym) {
          setBusyText('月間シフトを読み込み中…');
          await loadMonthly(sid, ym, { quiet: true });
        }
        setSettingsPanel(null);
        setAccountOpen(false);
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
    const name = String(empForm.name || '').trim();
    const byeCode = String(empForm.bye_code || '').trim();
    if (!name || !byeCode) {
      notify('氏名と社員コードは必須です', 'err');
      return;
    }
    const isUpdate = !!empForm.employee_id;
    try {
      await withBusy('従業員を保存中…', async () => {
        await api.upsertEmployee({
          user_email: user.email,
          store_id: storeId,
          ...empForm,
          name,
          bye_code: byeCode,
        });
        resetEmpForm();
        await loadEmployees(storeId, { quiet: true });
        notify(isUpdate ? '従業員を更新しました' : 'スタッフを追加しました', 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function resetEmpForm() {
    setEmpForm({ employee_id: '', name: '', bye_code: '', employment_type: '社員', work_hours: 4 });
    setEmpFormOpen(false);
  }

  function openEmpFormForNew() {
    resetEmpForm();
    setEmpFormOpen(true);
  }

  function openEmpFormForEdit(e) {
    if (!canEdit) return;
    setEmpForm({
      employee_id: e.employee_id,
      name: e.name,
      bye_code: e.bye_code,
      employment_type: normalizeEmpType(e.employment_type),
      work_hours: e.work_hours || spanHoursForEmp(e),
    });
    setEmpFormOpen(true);
  }

  function closeEmpForm() {
    resetEmpForm();
    setEmpFormOpen(false);
  }

  async function unregisterEmployee() {
    if (!empForm.employee_id) return;
    try {
      await withBusy('登録を解除中…', async () => {
        await api.deactivateEmployee(empForm.employee_id, storeId, user.email);
        resetEmpForm();
        await loadEmployees(storeId, { quiet: true });
        if (yearMonth) await loadMonthly(storeId, yearMonth, { quiet: true });
        notify('登録を解除しました', 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function requestUnregisterEmployee() {
    if (!empForm.employee_id) return;
    const label = String(empForm.name || empForm.bye_code).trim();
    setConfirmBox({
      title: '登録を解除',
      message: `${label} さんを、今後の登録から外しても大丈夫ですか？`,
      detail: '退職・異動などのときに使います。マスタから削除され、以降の月間表には表示されなくなります。',
      confirmLabel: 'はい、解除する',
      cancelLabel: 'いいえ',
      onConfirm: () => {
        setConfirmBox(null);
        unregisterEmployee();
      },
    });
  }

  /** 週間テンプレートで編集するスタッフを選ぶ */
  function selectWeeklyEmp(employeeId) {
    const id = employeeId || '';
    weeklyEmpIdRef.current = id;
    setWeeklyEmpId(id);
  }

  async function loadWeekly(sid = storeId, opts = {}) {
    if (!user?.email || !sid) return;
    // 予約済みの自動保存があれば取り消す
    if (weeklySaveTimer.current) {
      clearTimeout(weeklySaveTimer.current);
      weeklySaveTimer.current = null;
      try { await saveWeekly({ quiet: true }); } catch { /* ignore */ }
    } else if (weeklySavePromise.current) {
      try { await weeklySavePromise.current; } catch { /* ignore */ }
    }
    const run = async () => {
      const seqBefore = weeklyEditSeq.current;
      const res = await api.getWeeklySchedule(sid, user.email);
      setEmployees(res.employees || []);
      setCanEdit(!!res.canEdit);
      // 保存中に編集がなければ結果を反映する
      if (weeklyEditSeq.current === seqBefore) {
        weeklyRef.current = res.weekly || [];
        setWeekly(res.weekly || []);
      }
      weeklyLoadedRef.current = true;
      if (!weeklyEmpIdRef.current && res.employees?.[0]) selectWeeklyEmp(res.employees[0].employee_id);
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
      employee_id: empId, weekday, status: 'undef', start_time: '12:00', end_time: '21:00', leave_code: '',
    };
  }

  const weeklyEmp = employees.find((x) => x.employee_id === weeklyEmpId) || null;
  const weeklySpan = weeklySpanH != null ? Number(weeklySpanH) : spanHoursForEmp(weeklyEmp);

  /** 出勤時刻と拘束時間から週間テンプレの1日分を作る */
  function weeklyWorkPatch(startHm, spanH) {
    const start = snapToStep(startHm || weeklyBulkStart, TIME_STEP_MIN);
    const span = Number(spanH) > 0 ? Number(spanH) : weeklySpan;
    return { status: 'work', start_time: start, end_time: addHoursToHm(start, span), leave_code: '' };
  }

  /** 平日一括・全休など、まとめて設定する */
  function applyWeeklyBulk(kind) {
    if (!weeklyEmpId || !canEdit) return;
    const offPatch = { status: 'off', start_time: '', end_time: '', leave_code: '' };
    if (kind === 'all-off') {
      WEEKDAY_TEMPLATE_ORDER.forEach((wd) => setWeeklyCell(weeklyEmpId, wd, offPatch));
      return;
    }
    if (kind === 'weekend-off') {
      [6, 0].forEach((wd) => setWeeklyCell(weeklyEmpId, wd, offPatch));
      return;
    }
    const days = kind === 'weekday' ? [1, 2, 3, 4, 5] : WEEKDAY_TEMPLATE_ORDER;
    days.forEach((wd) => setWeeklyCell(weeklyEmpId, wd, weeklyWorkPatch(weeklyBulkStart, weeklySpan)));
  }

  function setWeeklyLeave(empId, weekday, codeRaw) {
    const code = parseLeaveCode(codeRaw);
    const emp = employees.find((x) => x.employee_id === empId);
    if (!code) {
      setWeeklyCell(empId, weekday, { status: 'off', start_time: '', end_time: '', leave_code: '' });
      return;
    }
    const status = statusFromLeaveCode(code);
    if (status === 'work') {
      setWeeklyCell(empId, weekday, { ...workTimesFromIn(emp, '12:00'), leave_code: code });
    } else {
      setWeeklyCell(empId, weekday, { status, start_time: '', end_time: '', leave_code: code });
    }
  }

  function setWeeklyCell(empId, weekday, patch) {
    const prev = weeklyRef.current || [];
    const idx = prev.findIndex((w) => w.employee_id === empId && Number(w.weekday) === weekday);
    let next;
    if (idx >= 0) {
      next = [...prev];
      next[idx] = { ...next[idx], ...patch };
    } else {
      next = [...prev, { employee_id: empId, weekday, status: 'undef', start_time: '12:00', end_time: '21:00', leave_code: '', ...patch }];
    }
    weeklyEditSeq.current += 1;
    weeklyRef.current = next;
    if (!weeklyTouchedEmps.current) weeklyTouchedEmps.current = new Set();
    weeklyTouchedEmps.current.add(String(empId));
    setWeekly(next);
    setWeeklyStatus('dirty');
    scheduleWeeklySave();
  }

  async function saveWeekly(opts = {}) {
    // 保存中のリクエストがあれば先に待つ
    const pending = weeklySavePromise.current;
    if (pending) {
      try { await pending; } catch { /* ignore */ }
    }
    // 読み込み前は保存しない（空データで上書きしないため）
    if (!weeklyLoadedRef.current) return;
    const seqAtStart = weeklyEditSeq.current;
    const source = weeklyRef.current || [];
    const touched = Array.from(weeklyTouchedEmps.current || []);
    // 保存対象の employee_id を重複なく集める
    const empIds = [];
    const seen = {};
    const pushId = (raw) => {
      const id = String(raw || '');
      if (!id || seen[id]) return;
      seen[id] = true;
      empIds.push(id);
    };
    touched.forEach(pushId);
    source.forEach((w) => pushId(w?.employee_id));
    weeklyTouchedEmps.current = new Set();
    if (!empIds.length) {
      setWeeklyStatus('saved');
      return;
    }
    const items = [];
    empIds.forEach((empId) => {
      for (let wd = 0; wd <= 6; wd++) {
        const cell = source.find((w) => String(w.employee_id) === empId && Number(w.weekday) === wd) || {};
        items.push({
          employee_id: empId,
          weekday: wd,
          status: cell.status || 'undef',
          start_time: cell.start_time || '',
          end_time: cell.end_time || '',
          break_minutes: cell.break_minutes ?? '',
          leave_code: cell.leave_code ?? '',
        });
      }
    });
    const run = async () => {
      setWeeklyStatus('saving');
      await api.saveWeeklySchedule({
        user_email: user.email,
        store_id: storeId,
        items,
        employee_ids: empIds,
      });
      // 保存後に編集がなければ「保存済み」にする
      if (weeklyEditSeq.current === seqAtStart) setWeeklyStatus('saved');
      else setWeeklyStatus('dirty');
    };
    const exec = opts.quiet ? run() : withBusy('保存中…', run);
    weeklySavePromise.current = exec;
    try {
      await exec;
    } catch (e) {
      setWeeklyStatus('idle');
      notify(e.message || String(e), 'err');
    } finally {
      if (weeklySavePromise.current === exec) weeklySavePromise.current = null;
    }
  }

  /** ツールバーの「テンプレ反映」: 表示中の月に週間テンプレートを反映する */
  async function applyWeeklyTemplateToMonth() {
    if (!canEdit || !storeId || !yearMonth) return;
    const monthNum = Number(yearMonth.slice(5, 7));
    if (!confirm(`${monthNum}月に週間テンプレートを反映します。\nテンプレ未登録のスタッフは空欄のままです。\n個別に直した日は上書きされます。よろしいですか？`)) return;
    try {
      if (dirtyKeys.size || dirtyMemoKeys.size) await flushDirtyShifts({ quiet: true });
      await withBusy(`${monthNum}月にテンプレートを反映しています…`, async () => {
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
        writeMonthCache(storeId, yearMonth, {
          employees: res.employees || [],
          shifts: res.shifts || [],
          memos: res.memos || [],
          canEdit: !!res.canEdit,
        });
        const g = res.generated || {};
        const filled = g.filled || 0;
        const cleared = g.cleared || 0;
        if (filled) notify(`${monthNum}月に反映しました（${filled}件${cleared ? ` / 空欄化 ${cleared}件` : ''}）`, 'ok');
        else notify('反映する内容がありませんでした（週間テンプレートが未登録です）', 'err');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  /** ツールバーの「白紙」: 表示中の月のシフトをすべて消す（メモは残す） */
  async function clearMonthShifts() {
    if (!canEdit || !storeId || !yearMonth) return;
    const monthNum = Number(yearMonth.slice(5, 7));
    const label = storeName ? `${storeName} / ${monthNum}月` : `${monthNum}月`;
    if (!confirm(`${label} のシフトをすべて白紙に戻します。\n個別に直した内容も消えます（メモは残ります）。\nよろしいですか？`)) return;
    if (!confirm(`最終確認：${label} を本当にすべて消しますか？\nこの操作は元に戻せません。`)) return;
    try {
      if (dirtyKeys.size || dirtyMemoKeys.size) await flushDirtyShifts({ quiet: true });
      await withBusy(`${monthNum}月を白紙にしています…`, async () => {
        const res = await api.clearMonthlyShifts({
          user_email: user.email,
          store_id: storeId,
          year_month: yearMonth,
        });
        setEmployees(res.employees || []);
        setShifts(res.shifts || []);
        setMemos(res.memos || memos);
        setCanEdit(!!res.canEdit);
        setDirtyKeys(new Set());
        setDirtyMemoKeys(new Set());
        writeMonthCache(storeId, yearMonth, {
          employees: res.employees || [],
          shifts: res.shifts || [],
          memos: res.memos || memos,
          canEdit: !!res.canEdit,
        });
        const rows = res.cleared?.rows || 0;
        notify(rows ? `${monthNum}月を白紙にしました（${rows}件）` : `${monthNum}月はすでに空欄でした`, 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }
  /** 週間テンプレートを保存してから、その月に反映する */
  async function saveWeeklyAndApply(scope = 'employee') {
    if (scope === 'all' && !confirm('全員分を週間テンプレートで作り直します（個別に直した日は消えます）。よろしいですか？')) return;
    if (scope === 'employee') {
      const hasTemplate = (weeklyRef.current || []).some(
        (w) => String(w.employee_id) === String(weeklyEmpId) && w.status && w.status !== 'undef'
      );
      if (!hasTemplate) {
        const nm = weeklyEmp?.name || 'このスタッフ';
        if (!confirm(`${nm}の週間テンプレートが未登録です。\n先に「出」「休」を入力してください。\n\nこのまま進めると該当月は空欄に戻ります。続けますか？`)) return;
      }
    }
    if (weeklySaveTimer.current) {
      clearTimeout(weeklySaveTimer.current);
      weeklySaveTimer.current = null;
    }
    try {
      await saveWeekly({ quiet: true });
      if (!yearMonth) {
        notify('週間テンプレートを保存しました', 'ok');
        setSettingsPanel(null);
        return;
      }
      const targetName = scope === 'all' ? '全員' : (weeklyEmp?.name || '選択中のスタッフ');
      const monthNum = Number(yearMonth.slice(5, 7));
      await withBusy(`${targetName}の${monthNum}月に反映しています…`, async () => {
        const res = await api.generateMonthlyShifts({
          user_email: user.email,
          store_id: storeId,
          year_month: yearMonth,
          overwrite: true,
          employee_id: scope === 'all' ? '' : weeklyEmpId,
        });
        setEmployees(res.employees || []);
        setShifts(res.shifts || []);
        setMemos(res.memos || []);
        setCanEdit(!!res.canEdit);
        setDirtyKeys(new Set());
        setDirtyMemoKeys(new Set());
        writeMonthCache(storeId, yearMonth, {
          employees: res.employees || [],
          shifts: res.shifts || [],
          memos: res.memos || [],
          canEdit: !!res.canEdit,
        });
        const g = res.generated || {};
        const filled = g.filled || 0;
        const cleared = g.cleared || 0;
        if (filled) notify(`${targetName}の${monthNum}月に反映しました（${filled}日）`, 'ok');
        else if (cleared) notify(`テンプレート未登録のため${monthNum}月を空欄に戻しました（${cleared}日）`, 'err');
        else notify('反映する日がありませんでした', 'ok');
      });
      setSettingsPanel(null);
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function loadMonthly(sid = storeId, ym = yearMonth, opts = {}) {
    const email = opts.userEmail || user?.email;
    if (!email || !sid || !ym) return;
    const gen = ++loadMonthGenRef.current;
    const cached = readMonthCache(sid, ym);
    const fromCache = !!(cached && cached.employees && cached.employees.length);

    if (fromCache) {
      setEmployees(cached.employees);
      setShifts(cached.shifts || []);
      setMemos(cached.memos || []);
      setCanEdit(!!cached.canEdit);
      setDirtyKeys(new Set());
      setDirtyMemoKeys(new Set());
      setFocusCell(null);
      historyRef.current = { past: [], future: [], applying: false };
      setHistoryTick((t) => t + 1);
      setMonthlyLoading(false);
      setMonthlyRefreshing(true);
    }

    const applyPayload = (res, { notifyOk }) => {
      if (gen !== loadMonthGenRef.current) return false;
      // 未保存の編集があるときはキャッシュだけ更新する
      if (dirtyKeysRef.current.size || dirtyMemoKeysRef.current.size) {
        writeMonthCache(sid, ym, {
          employees: res.employees || [],
          shifts: res.shifts || [],
          memos: res.memos || [],
          canEdit: !!res.canEdit,
        });
        return false;
      }
      setEmployees(res.employees || []);
      setShifts(res.shifts || []);
      setMemos(res.memos || []);
      setCanEdit(!!res.canEdit);
      setDirtyKeys(new Set());
      setDirtyMemoKeys(new Set());
      setFocusCell(null);
      historyRef.current = { past: [], future: [], applying: false };
      setHistoryTick((t) => t + 1);
      writeMonthCache(sid, ym, {
        employees: res.employees || [],
        shifts: res.shifts || [],
        memos: res.memos || [],
        canEdit: !!res.canEdit,
      });
      const applied = res.appliedFromWeekly;
      if (notifyOk && !opts.quiet) {
        if (applied?.reason === 'already_filled') {
          notify(`${ym} / ${(res.shifts || []).length}件`, 'ok');
        } else if (applied?.applied && applied.created) {
          notify(`${ym}：シフトテンプレートを反映（${applied.created}件）`, 'ok');
        } else if (applied && applied.applied === false && applied.reason === 'no_weekly') {
          notify('シフトテンプレートが未保存です。先にテンプレート作成で ○／× を保存してください。', 'err');
        } else if (applied && applied.applied === false && applied.reason === 'no_pattern') {
          notify('テンプレート作成で出勤○／休み×を設定して保存してください。', 'err');
        } else {
          notify(`${ym} / ${(res.shifts || []).length}件`, 'ok');
        }
      }
      return true;
    };

    const run = async () => {
      // 週間テンプレートの自動反映はしない（明示操作のときだけ）
      const res = await api.getShifts(sid, ym, email, false);
      applyPayload(res, { notifyOk: !fromCache });
      scheduleMonthPrefetch(sid, ym, email);
    };

    try {
      if (!fromCache) {
        setMonthlyLoading(true);
        setMonthlyRefreshing(false);
      }
      // フルスクリーンの busy は使わない（入力・スクロールを止めない）
      await run();
    } catch (e) {
      if (gen === loadMonthGenRef.current && !opts.quiet && !fromCache) {
        notify(e.message || String(e), 'err');
      } else if (gen === loadMonthGenRef.current && fromCache && !opts.quiet) {
        notify(e.message || String(e), 'err');
      }
    } finally {
      if (gen === loadMonthGenRef.current) {
        setMonthlyLoading(false);
        setMonthlyRefreshing(false);
      }
    }
  }

  function scheduleMonthPrefetch(sid, ym, email) {
    if (!sid || !ym || !email) return;
    const neighbors = [shiftYearMonth(ym, -1), shiftYearMonth(ym, 1)];
    const kick = () => {
      neighbors.forEach((nym) => {
        if (!nym || nym === ym) return;
        if (readMonthCache(sid, nym)) return;
        api.getShifts(sid, nym, email, false)
          .then((res) => {
            if (!res || !Array.isArray(res.employees)) return;
            writeMonthCache(sid, nym, {
              employees: res.employees || [],
              shifts: res.shifts || [],
              memos: res.memos || [],
              canEdit: !!res.canEdit,
            });
          })
          .catch(() => {});
      });
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(kick, { timeout: 2500 });
    } else {
      window.setTimeout(kick, 800);
    }
  }

  async function resetMonthFromWeekly() {
    if (!confirm('全員分を週間テンプレートで作り直します（個別に直した日は消えます）。よろしいですか？')) return;
    try {
      await withBusy('週間テンプレートから作り直しています…', async () => {
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
        writeMonthCache(storeId, yearMonth, {
          employees: res.employees || [],
          shifts: res.shifts || [],
          memos: res.memos || [],
          canEdit: !!res.canEdit,
        });
        const g = res.generated || {};
        notify(`週間テンプレートから作成しました（${g.created || 0}件）`, 'ok');
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function showKintaiToast(kind, text) {
    if (kintaiToastTimer.current) clearTimeout(kintaiToastTimer.current);
    setKintaiToast({ kind, text });
    kintaiToastTimer.current = setTimeout(() => setKintaiToast(null), 4500);
  }

  async function copyByeBye() {
    if (!storeId || !yearMonth) {
      showKintaiToast('err', '店舗と年月を選んでください。');
      return;
    }
    const local = buildByeByeTsv(employees, shifts, yearMonth);
    if (!local.tsv) {
      showKintaiToast('err', local.warnings.join(' / ') || 'コピーするデータが空です。');
      return;
    }
    const copied = await copyTextSafe(local.tsv);
    if (copied) {
      showKintaiToast('ok', 'コピーができました。\nCtrl＋Shift＋Vで貼り付けて下さい。');
    } else {
      showKintaiToast('err', 'コピーできませんでした。もう一度お試しください。');
    }
    if (user?.email) {
      api.buildByeByePaste(storeId, yearMonth, user.email).catch(() => {});
    }
  }

  async function syncCalendar() {
    if (!storeId || !yearMonth || !user?.email) {
      notify('店舗と年月を選んでください。', 'err');
      return;
    }
    if (calendarJobRef.current) {
      notify('カレンダー処理中です…', 'err');
      return;
    }
    calendarJobRef.current = true;
    const CHUNK = 4;
    const base = {
      user_email: user.email,
      store_id: storeId,
      year_month: yearMonth,
    };
    try {
      setCalendarProgress({ percent: 2, label: '準備中…' });
      const prep = await api.syncCalendarMonth({ ...base, phase: 'prepare' });
      if (!prep?.ok) {
        throw new Error(prep?.message || 'カレンダー準備に失敗しました');
      }
      const daysInMonth = Number(prep.daysInMonth) || (() => {
        const [y, m] = yearMonth.split('-').map(Number);
        return new Date(y, m, 0).getDate();
      })();
      setCalendarProgress({ percent: 8, label: '登録中…' });

      let day = 1;
      let totalCreated = 0;
      while (day <= daysInMonth) {
        const dayTo = Math.min(daysInMonth, day + CHUNK - 1);
        const chunk = await api.syncCalendarMonth({
          ...base,
          phase: 'chunk',
          day_from: day,
          day_to: dayTo,
        });
        if (!chunk?.ok) {
          throw new Error(chunk?.message || `${day}〜${dayTo}日の登録に失敗しました`);
        }
        totalCreated += Number(chunk.created) || 0;
        const pct = Math.min(99, Math.round(8 + (dayTo / daysInMonth) * 91));
        setCalendarProgress({ percent: pct, label: `${dayTo}/${daysInMonth}日` });
        day = dayTo + 1;
      }

      setCalendarProgress({ percent: 100, label: '完了' });
      notify(`${formatYmJa(yearMonth)} をカレンダー登録しました（${totalCreated}件）`, 'ok');
      window.setTimeout(() => setCalendarProgress(null), 1600);
    } catch (e) {
      const m = e.message || String(e);
      setCalendarProgress(null);
      if (/permission|権限|auth\/calendar|Authorization/i.test(m)) {
        notify('カレンダー権限が未許可です。GAS編集画面で「authorizeCalendarOnce」を1回実行して許可してください。', 'err');
      } else {
        notify(m, 'err');
      }
    } finally {
      calendarJobRef.current = false;
    }
  }

  async function clearCalendar() {
    if (!storeId || !yearMonth || !user?.email) {
      notify('店舗と年月を選んでください。', 'err');
      return;
    }
    if (calendarJobRef.current) {
      notify('カレンダー処理中です…', 'err');
      return;
    }
    calendarJobRef.current = true;
    try {
      setCalendarProgress({ percent: 15, label: 'クリア中…' });
      const res = await api.clearCalendarMonth({
        user_email: user.email,
        store_id: storeId,
        year_month: yearMonth,
      });
      setCalendarProgress({ percent: 100, label: '完了' });
      const fails = (res.results || []).filter((r) => !r.ok);
      if (!res.ok || fails.length) {
        notify(
          `${res.message || '失敗'} / ${fails.slice(0, 2).map((f) => f.message || '').join(' / ')}`,
          'err'
        );
      } else {
        notify(res.message || `${formatYmJa(yearMonth)} をクリアしました`, 'ok');
      }
      window.setTimeout(() => setCalendarProgress(null), 1200);
    } catch (e) {
      const m = e.message || String(e);
      setCalendarProgress(null);
      if (/permission|権限|auth\/calendar|Authorization/i.test(m)) {
        notify('カレンダー権限が未許可です。GAS編集画面で「authorizeCalendarOnce」を1回実行して許可してください。', 'err');
      } else {
        notify(m, 'err');
      }
    } finally {
      calendarJobRef.current = false;
    }
  }

  function buildPrintFileName() {
    const [yStr, mStr] = String(yearMonth || '').split('-');
    const y = Number(yStr) || '';
    const m = Number(mStr) || '';
    const storeLabel = String(storeName || staffColLabel || 'シフト').trim();
    if (!y || !m) return storeLabel || 'シフト';
    return `${storeLabel}${y}／${m}月シフト`;
  }

  function applyDocumentTitle(name) {
    document.title = name;
    try {
      if (window.parent && window.parent !== window) window.parent.document.title = name;
    } catch {
      /* 親フレームが別オリジンのときは触れないので無視する */
    }
  }

  function preparePrintLayout() {
    const n = Math.max(employees.length, 1);
    let scale = 'md';
    if (n <= 6) scale = 'lg';
    else if (n <= 10) scale = 'md';
    else if (n <= 14) scale = 'sm';
    else scale = 'xs';
    // 人数に応じて行の高さを決める（A4横1枚に収める）
    const rowHmm = Math.max(5.5, Math.min(9.5, (78 / n)));
    document.documentElement.setAttribute('data-print-scale', scale);
    document.documentElement.style.setProperty('--print-emps', String(n));
    document.documentElement.style.setProperty('--print-row-h', `${rowHmm.toFixed(2)}mm`);
    document.documentElement.classList.add('is-printing');
    applyDocumentTitle(buildPrintFileName());
  }

  function clearPrintLayout(prevTitle) {
    document.documentElement.classList.remove('is-printing');
    document.documentElement.removeAttribute('data-print-scale');
    document.documentElement.style.removeProperty('--print-emps');
    document.documentElement.style.removeProperty('--print-row-h');
    if (prevTitle != null) applyDocumentTitle(prevTitle);
    else applyDocumentTitle(buildPrintFileName());
  }

  function printShiftSheet() {
    if (!employees.length || !yearMonth) {
      notify('印刷するシフトがありません。', 'err');
      return;
    }
    const prevTitle = document.title;
    preparePrintLayout();
    notify('印刷ダイアログでレイアウトを「横」にしてください', 'ok');

    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      clearPrintLayout(prevTitle);
      window.setTimeout(() => applyDocumentTitle(buildPrintFileName()), 0);
    };

    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        if (document.documentElement.classList.contains('is-printing')) cleanup();
      }, 120000);
    }, 80);
  }

  /** 印刷セルの表示: 8-17 / 8:30-17 のように詰めて出す */
  function printCellContent(employeeId, date) {
    const s = getCellShift(employeeId, date);
    const status = s.status || 'undef';
    const leaveCode = parseLeaveCode(s.leave_code) || houteiMaps[employeeId]?.[date] || 0;
    const leaveName = leaveCodeLabel(leaveCode);
    const printLeave = leaveCodePrintLabel(leaveCode);
    const timeLine = formatPrintTimeRange(s.start_time, s.end_time);

    if (leaveName) {
      if (status === 'work' && timeLine) {
        return { lines: [printLeave, timeLine], leave: true };
      }
      return { lines: [printLeave || '公休'], leave: true };
    }
    if (status === 'work' && timeLine) {
      return { lines: [timeLine], leave: false };
    }
    if (status === 'pto') return { lines: ['有休'], leave: true };
    if (status === 'absent') return { lines: ['欠勤'], leave: true };
    if (status === 'off') return { lines: ['公休'], leave: true };
    return { lines: [], leave: false };
  }

  function shiftKey(employeeId, date) {
    return `${employeeId}__${date}`;
  }

  function cloneSheetSnapshot() {
    return {
      shifts: JSON.parse(JSON.stringify(shifts || [])),
      memos: JSON.parse(JSON.stringify(memos || [])),
      dirtyKeys: [...dirtyKeys],
      dirtyMemoKeys: [...dirtyMemoKeys],
    };
  }

  function pushUndoSnapshot() {
    const h = historyRef.current;
    if (h.applying) return;
    h.past.push(cloneSheetSnapshot());
    if (h.past.length > 40) h.past.shift();
    h.future = [];
    setHistoryTick((t) => t + 1);
  }

  function applySheetSnapshot(snap) {
    const h = historyRef.current;
    h.applying = true;
    setShifts(snap.shifts || []);
    setMemos(snap.memos || []);
    setDirtyKeys(new Set(snap.dirtyKeys || []));
    setDirtyMemoKeys(new Set(snap.dirtyMemoKeys || []));
    setHistoryTick((t) => t + 1);
    window.setTimeout(() => { h.applying = false; }, 0);
  }

  function undoEdit() {
    const h = historyRef.current;
    if (!h.past.length || busy) return;
    h.future.push(cloneSheetSnapshot());
    applySheetSnapshot(h.past.pop());
  }

  function redoEdit() {
    const h = historyRef.current;
    if (!h.future.length || busy) return;
    h.past.push(cloneSheetSnapshot());
    applySheetSnapshot(h.future.pop());
  }

  function getCellShift(employeeId, date) {
    return shiftMap.get(shiftKey(employeeId, date)) || {
      shift_id: '',
      employee_id: employeeId,
      date,
      status: 'undef',
      start_time: '',
      end_time: '',
      leave_code: '',
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

  function patchCellLocal(employeeId, date, patch, houteiOpts = {}) {
    pushUndoSnapshot();
    const key = shiftKey(employeeId, date);
    let changedDates = [date];
    setShifts((prev) => {
      const idx = prev.findIndex((s) => s.employee_id === employeeId && s.date === date);
      const base = idx >= 0
        ? prev[idx]
        : { shift_id: '', employee_id: employeeId, date, store_id: storeId, status: 'undef', start_time: '', end_time: '', leave_code: '' };
      let nextRow = { ...base, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'leave_code') && patch.leave_code === '') {
        nextRow = { ...nextRow, leave_code: '' };
      }
      if (nextRow.status === 'work') {
        if (!nextRow.start_time) nextRow = { ...nextRow, start_time: '12:00' };
        if (!nextRow.end_time) nextRow = { ...nextRow, end_time: '21:00' };
      } else if (leaveCodeNeedsDummyShift(parseLeaveCode(nextRow.leave_code))) {
        // 出勤以外にしたら時刻を消す
      } else if (patch.status && patch.status !== 'work') {
        nextRow = { ...nextRow, start_time: '', end_time: '' };
      }
      const next = idx >= 0 ? prev.map((row, i) => (i === idx ? nextRow : row)) : [...prev, nextRow];
      const applied = applyAutoHouteiToShifts(next, employeeId, yearMonth, storeId, houteiOpts);
      changedDates = [date, ...applied.changedDates];
      return applied.shifts;
    });
    setDirtyKeys((prev) => {
      const n = new Set(prev);
      changedDates.forEach((d) => n.add(shiftKey(employeeId, d)));
      n.add(key);
      return n;
    });
  }

  function patchMemoLocal(employeeId, date, body) {
    pushUndoSnapshot();
    const key = shiftKey(employeeId, date);
    const nextBody = clampMemoBody(body);
    setMemos((prev) => {
      const idx = prev.findIndex((m) => m.employee_id === employeeId && m.date === date);
      const base = idx >= 0
        ? prev[idx]
        : { memo_id: '', employee_id: employeeId, date, store_id: storeId, kind: 'note', title: '', body: '' };
      const nextRow = { ...base, body: nextBody, kind: base.kind || 'note' };
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

  function toggleMemoRow(employeeId) {
    setMemoOpenIds((prev) => {
      const n = new Set(prev);
      if (n.has(employeeId)) n.delete(employeeId);
      else n.add(employeeId);
      return n;
    });
  }

  async function shareCellToChat(employeeId, date) {
    if (!user?.email || !storeId) return;
    const emp = employees.find((x) => x.employee_id === employeeId);
    const shift = getCellShift(employeeId, date);
    const payload = buildCellSharePayload(emp, date, shift, leaveCodeLabel, formatDateJa);
    try {
      await chat.send(payload);
      notify('チャットに共有しました', 'ok');
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  async function openChatCellLink(msg) {
    const eid = String(msg?.link_employee_id || '').trim();
    const date = String(msg?.link_date || '').trim();
    if (!eid || !date) return;
    const ym = date.slice(0, 7);
    chat.setOpen(false);
    if (ym && ym !== yearMonth) {
      try {
        await changeMonth(ym);
      } catch (e) {
        notify(e.message || String(e), 'err');
        return;
      }
    }
    selectShiftCell(eid, date);
    window.setTimeout(() => {
      if (canEdit) openShiftEditor(eid, date);
    }, 80);
  }

  function openShiftEditor(employeeId, date) {
    if (!canEdit || busy) return;
    setEmpEditorId(null);
    setLeaveQuery('');
    setFocusCell({ employee_id: employeeId, date, layer: 'shift', editing: false });
    setShiftEditor({ employee_id: employeeId, date });
  }

  /** セルを選択する（ダブルクリックで編集に入る） */
  function selectShiftCell(employeeId, date) {
    if (!canEdit) return;
    startTransition(() => {
      setEmpEditorId(null);
      setShiftEditor(null);
      setFocusCell({ employee_id: employeeId, date, layer: 'shift', editing: false });
    });
  }

  function closeShiftEditor() {
    setShiftEditor(null);
    setPtoTemplateOpen(false);
    setFocusCell((prev) => (prev?.editing ? prev : (prev ? { ...prev, editing: false } : null)));
  }

  function beginShiftEdit(employeeId, date, seed) {
    if (!canEdit || busy) return;
    setEmpEditorId(null);
    setShiftEditor(null);
    const s = getCellShift(employeeId, date);
    const initial = seed !== undefined ? seed : draftFromShift(s);
    setEditDraft(initial);
    setFocusCell({ employee_id: employeeId, date, layer: 'shift', editing: true });
    setTimeout(() => {
      const el = cellEditRef.current;
      if (!el) return;
      el.focus();
      if (seed !== undefined) {
        el.setSelectionRange(el.value.length, el.value.length);
      } else {
        el.select();
      }
    }, 20);
  }

  function cancelCellEdit() {
    if (!focusCell) return;
    setFocusCell({ ...focusCell, editing: false });
    setEditDraft('');
  }

  function moveShiftFocus(deltaEmp, deltaDay, fromCell = null) {
    const from = fromCell || focusCell;
    if (!from || (!fromCell && from.editing) || !employees.length || !visibleDays.length) return;
    const empIdx = employees.findIndex((e) => e.employee_id === from.employee_id);
    const dayNum = Number(String(from.date || '').slice(-2));
    const dayIdx = visibleDays.indexOf(dayNum);
    if (empIdx < 0 || dayIdx < 0) return;
    const nextEmp = employees[Math.max(0, Math.min(employees.length - 1, empIdx + deltaEmp))];
    const nextDay = visibleDays[Math.max(0, Math.min(visibleDays.length - 1, dayIdx + deltaDay))];
    if (!nextEmp || !nextDay) return;
    const date = toYmDay(yearMonth, nextDay);
    setEmpEditorId(null);
    setShiftEditor(null);
    setFocusCell({ employee_id: nextEmp.employee_id, date, layer: 'shift', editing: false });
  }

  function jumpShiftFocus(kind, fromCell = null) {
    const from = fromCell || focusCell;
    if (!from || from.editing || !employees.length || !visibleDays.length) return;
    const empIdx = employees.findIndex((e) => e.employee_id === from.employee_id);
    const dayNum = Number(String(from.date || '').slice(-2));
    const dayIdx = visibleDays.indexOf(dayNum);
    if (empIdx < 0 || dayIdx < 0) return;

    const page = Math.max(3, Math.min(8, Math.floor(employees.length / 2) || 3));
    let nextEmpIdx = empIdx;
    let nextDayIdx = dayIdx;

    if (kind === 'home') nextDayIdx = 0;
    else if (kind === 'end') nextDayIdx = visibleDays.length - 1;
    else if (kind === 'pageUp') nextEmpIdx = Math.max(0, empIdx - page);
    else if (kind === 'pageDown') nextEmpIdx = Math.min(employees.length - 1, empIdx + page);
    else if (kind === 'ctrlHome') { nextEmpIdx = 0; nextDayIdx = 0; }
    else if (kind === 'ctrlEnd') {
      nextEmpIdx = employees.length - 1;
      nextDayIdx = visibleDays.length - 1;
    }

    const nextEmp = employees[nextEmpIdx];
    const nextDay = visibleDays[nextDayIdx];
    if (!nextEmp || !nextDay) return;
    setEmpEditorId(null);
    setShiftEditor(null);
    setFocusCell({
      employee_id: nextEmp.employee_id,
      date: toYmDay(yearMonth, nextDay),
      layer: 'shift',
      editing: false,
    });
  }

  function handleShiftCellKeyDown(ev, employeeId, date) {
    if (!canEdit || busy) return;
    if (ev.key === 'Enter' || ev.key === 'F2') {
      ev.preventDefault();
      openShiftEditor(employeeId, date);
      return;
    }
    if (ev.key === 'Home') {
      ev.preventDefault();
      jumpShiftFocus(ev.ctrlKey || ev.metaKey ? 'ctrlHome' : 'home');
      return;
    }
    if (ev.key === 'End') {
      ev.preventDefault();
      jumpShiftFocus(ev.ctrlKey || ev.metaKey ? 'ctrlEnd' : 'end');
      return;
    }
    if (ev.key === 'PageUp') {
      ev.preventDefault();
      jumpShiftFocus('pageUp');
      return;
    }
    if (ev.key === 'PageDown') {
      ev.preventDefault();
      jumpShiftFocus('pageDown');
      return;
    }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); moveShiftFocus(0, -1); return; }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); moveShiftFocus(0, 1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); moveShiftFocus(-1, 0); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); moveShiftFocus(1, 0); return; }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      patchCellLocal(employeeId, date, { status: 'undef', start_time: '', end_time: '', leave_code: '' });
      return;
    }
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      beginShiftEdit(employeeId, date, ev.key);
    }
  }

  function commitShiftEdit(opts = {}) {
    if (!focusCell || focusCell.layer === 'memo' || !focusCell.editing) return null;
    const { employee_id: eid, date } = focusCell;
    const emp = employees.find((x) => x.employee_id === eid);
    const parsed = parseShiftDraft(editDraft, emp);
    if (!parsed) {
      notify('入力例: 13-22 / 13:00↵22:00 / 公休 / 有休', 'err');
      setTimeout(() => cellEditRef.current?.focus(), 10);
      return null;
    }
    patchCellLocal(eid, date, parsed);
    const nextFocus = { employee_id: eid, date, layer: 'shift', editing: false };
    setFocusCell(nextFocus);
    setShiftEditor(null);
    setEditDraft('');
    if (opts.moveEmp || opts.moveDay) {
      setTimeout(() => moveShiftFocus(opts.moveEmp || 0, opts.moveDay || 0, nextFocus), 0);
    }
    return nextFocus;
  }

  /**
   * 貼り付けたデータをシフトに反映する
   * 1行目から順に、対象スタッフの日付へ割り当てる
   */
  function applySpreadsheetPaste(text, origin = focusCell) {
    if (!canEdit || busy || !origin || !employees.length || !visibleDays.length) return false;
    const grid = parseClipboardGrid(text);
    if (!grid.length) return false;
    pushUndoSnapshot();
    const h = historyRef.current;
    h.applying = true;

    const finish = (ok) => {
      h.applying = false;
      return ok;
    };

    const startEmp = employees.find((x) => x.employee_id === origin.employee_id);
    if (!startEmp) return finish(false);
    let empIdx = employees.findIndex((x) => x.employee_id === origin.employee_id);
    const dayNum = Number(String(origin.date || '').slice(-2));
    const startDayIdx = visibleDays.indexOf(dayNum);
    if (empIdx < 0 || startDayIdx < 0) return finish(false);

    const colOffset = detectPasteLabelColumn(grid, startEmp);
    let layer = origin.layer === 'memo' ? 'memo' : 'shift';
    let shiftCount = 0;
    let memoCount = 0;
    let skipCount = 0;
    const shiftPatchMap = new Map(); // key -> { employeeId, date, patch }
    const memoPatchMap = new Map(); // key -> { employeeId, date, body }
    const touchedEmpIds = new Set();

    for (let r = 0; r < grid.length; r += 1) {
      const emp = employees[empIdx];
      if (!emp) break;
      const cells = grid[r].slice(colOffset);
      for (let c = 0; c < cells.length; c += 1) {
        const dayIdx = startDayIdx + c;
        if (dayIdx >= visibleDays.length) break;
        const date = toYmDay(yearMonth, visibleDays[dayIdx]);
        const raw = cells[c];
        const key = shiftKey(emp.employee_id, date);
        if (layer === 'shift') {
          const parsed = parseShiftDraft(raw, emp);
          if (!parsed) {
            skipCount += 1;
            continue;
          }
          shiftPatchMap.set(key, { employeeId: emp.employee_id, date, patch: parsed });
          touchedEmpIds.add(emp.employee_id);
          shiftCount += 1;
        } else {
          memoPatchMap.set(key, { employeeId: emp.employee_id, date, body: String(raw ?? '').trim() });
          memoCount += 1;
        }
      }
      if (layer === 'shift') {
        layer = 'memo';
      } else {
        layer = 'shift';
        empIdx += 1;
      }
    }

    if (!shiftCount && !memoCount) {
      notify('貼り付けできる勤務データがありません', 'err');
      return finish(false);
    }

    if (shiftPatchMap.size) {
      setShifts((prev) => {
        const byKey = new Map();
        (prev || []).forEach((s) => byKey.set(shiftKey(s.employee_id, s.date), { ...s }));
        shiftPatchMap.forEach((item) => {
          const base = byKey.get(shiftKey(item.employeeId, item.date)) || {
            shift_id: '',
            employee_id: item.employeeId,
            date: item.date,
            store_id: storeId,
            status: 'undef',
            start_time: '',
            end_time: '',
            leave_code: '',
          };
          let nextRow = { ...base, ...item.patch };
          if (Object.prototype.hasOwnProperty.call(item.patch, 'leave_code') && item.patch.leave_code === '') {
            nextRow = { ...nextRow, leave_code: '' };
          }
          if (nextRow.status === 'work') {
            if (!nextRow.start_time) nextRow = { ...nextRow, start_time: '12:00' };
            if (!nextRow.end_time) nextRow = { ...nextRow, end_time: '21:00' };
          } else if (leaveCodeNeedsDummyShift(parseLeaveCode(nextRow.leave_code))) {
            // 出勤以外は時刻を消す
          } else if (item.patch.status && item.patch.status !== 'work') {
            nextRow = { ...nextRow, start_time: '', end_time: '' };
          }
          byKey.set(shiftKey(item.employeeId, item.date), nextRow);
        });
        let next = [...byKey.values()];
        touchedEmpIds.forEach((eid) => {
          next = applyAutoHouteiToShifts(next, eid, yearMonth, storeId, {}).shifts;
        });
        return next;
      });
      setDirtyKeys((prev) => {
        const n = new Set(prev);
        shiftPatchMap.forEach((_, key) => n.add(key));
        return n;
      });
    }

    if (memoPatchMap.size) {
      setMemos((prev) => {
        const byKey = new Map();
        (prev || []).forEach((m) => byKey.set(shiftKey(m.employee_id, m.date), { ...m }));
        memoPatchMap.forEach((item) => {
          const base = byKey.get(shiftKey(item.employeeId, item.date)) || {
            memo_id: '',
            employee_id: item.employeeId,
            date: item.date,
            store_id: storeId,
            kind: 'note',
            title: '',
            body: '',
          };
          byKey.set(shiftKey(item.employeeId, item.date), {
            ...base,
            body: clampMemoBody(item.body),
            kind: base.kind || 'note',
          });
        });
        return [...byKey.values()];
      });
      setDirtyMemoKeys((prev) => {
        const n = new Set(prev);
        memoPatchMap.forEach((_, key) => n.add(key));
        return n;
      });
      setMemoOpenIds((prev) => {
        const n = new Set(prev);
        memoPatchMap.forEach((item) => n.add(item.employeeId));
        return n;
      });
    }

    setFocusCell({
      employee_id: origin.employee_id,
      date: origin.date,
      layer: origin.layer === 'memo' ? 'memo' : 'shift',
      editing: false,
    });
    setEditDraft('');

    const parts = [];
    if (shiftCount) parts.push(`勤務 ${shiftCount}`);
    if (memoCount) parts.push(`メモ ${memoCount}`);
    const skipNote = skipCount ? `（読取不可 ${skipCount}）` : '';
    const colNote = grid[0]
      ? ` · ${Math.max(0, (grid[0].length || 0) - colOffset)}列`
      : '';
    notify(`${parts.join('・')} を貼り付けました${skipNote}${colNote}`, 'ok');
    return finish(true);
  }

  function handleSheetPaste(ev) {
    if (!canEdit || busy || !focusCell) return;
    const text = ev.clipboardData?.getData('text/plain');
    if (text == null || text === '') return;
    const grid = parseClipboardGrid(text);
    const multi = clipboardGridIsMulti(grid);
    const tag = String(ev.target?.tagName || '').toUpperCase();
    const inField = tag === 'INPUT' || tag === 'TEXTAREA';

    // 単一セルの貼り付けは入力欄にそのまま任せる
    if (!multi && inField) return;

    if (!multi && focusCell.layer === 'memo' && inField) return;

    ev.preventDefault();
    applySpreadsheetPaste(text, focusCell);
  }

  function openEmpEditor(employeeId) {
    if (!canEdit || busy) return;
    setShiftEditor(null);
    setFocusCell(null);
    setEmpEditorId(employeeId);
  }

  function closeEmpEditor() {
    setEmpEditorId(null);
  }

  /** このスタッフの週間テンプレートを開く */
  function openWeeklyForEmp(employeeId) {
    selectWeeklyEmp(employeeId);
    setWeeklySpanH(null);
    closeEmpEditor();
    openSettings('weekly');
  }

  /** このスタッフの詳細（氏名・社員番号など）を開く */
  async function openEmpDetailFor(emp) {
    closeEmpEditor();
    await openSettings('employees');
    openEmpFormForEdit(emp);
  }

  function endEmpDrag_(persist) {
    const d = empDragRef.current;
    if (d?.timer) window.clearTimeout(d.timer);
    if (d?.onMove) window.removeEventListener('pointermove', d.onMove);
    if (d?.onUp) {
      window.removeEventListener('pointerup', d.onUp);
      window.removeEventListener('pointercancel', d.onUp);
    }
    if (d?.earlyMove) window.removeEventListener('pointermove', d.earlyMove);
    if (d?.earlyUp) {
      window.removeEventListener('pointerup', d.earlyUp);
      window.removeEventListener('pointercancel', d.earlyUp);
    }
    const fromId = d?.id || empDragId;
    const ordered = employeesRef.current || [];
    empDragRef.current = null;
    setEmpDragId(null);
    setEmpDragOverId(null);
    if (persist && fromId && canEdit && user?.email) {
      api.saveEmployeeOrder({
        user_email: user.email,
        store_id: storeId,
        employee_ids: ordered.map((e) => e.employee_id),
      }).catch((err) => {
        notify(err?.message || '並び順の保存に失敗しました', 'err');
      });
    }
  }

  function moveEmployeeBefore_(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setEmployees((prev) => {
      const from = prev.findIndex((e) => e.employee_id === fromId);
      const to = prev.findIndex((e) => e.employee_id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onEmpNamePointerDown(ev, employeeId, opts = {}) {
    if (!canEdit) return;
    if (ev.button != null && ev.button !== 0) return;
    const instant = !!opts.instant; // 押した直後に並べ替えを開始するか
    const pointerId = ev.pointerId;
    const isTouch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
    endEmpDrag_(false);

    const onMove = (e) => {
      const cur = empDragRef.current;
      if (!cur || cur.pointerId !== e.pointerId || !cur.armed) return;
      e.preventDefault();
      cur.moved = true;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest?.('[data-emp-id]');
      const overId = row?.getAttribute('data-emp-id');
      if (overId && overId !== cur.id) {
        setEmpDragOverId(overId);
        moveEmployeeBefore_(cur.id, overId);
      }
    };

    const onUp = (e) => {
      const cur = empDragRef.current;
      if (!cur || cur.pointerId !== e.pointerId) return;
      endEmpDrag_(!!cur.moved);
    };

    const earlyMove = (e) => {
      const cur = empDragRef.current;
      if (!cur || cur.pointerId !== e.pointerId || cur.armed) return;
      if (Math.abs(e.clientX - cur.x) + Math.abs(e.clientY - cur.y) > 12) {
        endEmpDrag_(false);
      }
    };

    const earlyUp = (e) => {
      const cur = empDragRef.current;
      if (!cur || cur.pointerId !== e.pointerId) return;
      if (cur.armed) return;
      endEmpDrag_(false);
      // マウスはダブルクリックで開く。タッチ／ペンは単タップでも開く
      if (isTouch) openEmpEditor(employeeId);
    };

    if (instant) {
      ev.preventDefault();
      empDragRef.current = {
        id: employeeId,
        pointerId,
        x: ev.clientX,
        y: ev.clientY,
        armed: true,
        moved: false,
        onMove,
        onUp,
        earlyMove: null,
        earlyUp: null,
        timer: null,
      };
      setEmpDragId(employeeId);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      return;
    }

    empDragRef.current = {
      id: employeeId,
      pointerId,
      x: ev.clientX,
      y: ev.clientY,
      armed: false,
      moved: false,
      onMove,
      onUp,
      earlyMove,
      earlyUp,
      timer: window.setTimeout(() => {
        const cur = empDragRef.current;
        if (!cur || cur.id !== employeeId) return;
        window.removeEventListener('pointermove', earlyMove);
        window.removeEventListener('pointerup', earlyUp);
        window.removeEventListener('pointercancel', earlyUp);
        cur.armed = true;
        cur.earlyMove = null;
        cur.earlyUp = null;
        setEmpDragId(employeeId);
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      }, 320),
    };

    window.addEventListener('pointermove', earlyMove);
    window.addEventListener('pointerup', earlyUp);
    window.addEventListener('pointercancel', earlyUp);
  }

  /**
   * 従業員の区分・勤務時間を更新する
   * 保存後はマスタを読み直し、月間表にも反映する
   */
  async function updateEmployeeProfile(employeeId, patch) {
    if (!user?.email || !canEdit) return;
    const emp = employees.find((x) => x.employee_id === employeeId);
    if (!emp) return;

    const merged = { ...emp, ...patch };
    const typ = normalizeEmpType(merged.employment_type);
    const wh = Number(merged.work_hours);
    const next = {
      ...merged,
      employment_type: typ,
      work_hours: wh > 0 ? wh : (typ === 'アルバイト' ? 4 : ''),
    };

    setEmployees((prev) => prev.map((e) => (e.employee_id === employeeId ? next : e)));
    // 他の月のキャッシュも合わせて更新し、月を移動しても元に戻らないようにする
    patchCachedEmployee(storeId, employeeId, {
      employment_type: next.employment_type,
      work_hours: next.work_hours,
    });

    try {
      await api.upsertEmployee({
        user_email: user.email,
        store_id: storeId,
        employee_id: next.employee_id,
        name: next.name,
        bye_code: next.bye_code,
        employment_type: next.employment_type,
        work_hours: next.work_hours,
      });
    } catch (e) {
      notify(e.message || String(e), 'err');
    }
  }

  function applyEditorStatus(status) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    if (status === 'blank') {
      patchCellLocal(eid, date, { status: 'undef', start_time: '', end_time: '', leave_code: '' });
    } else if (status === 'work') {
      const cur = getCellShift(eid, date);
      if (cur.start_time && cur.end_time && cur.status === 'work') {
        patchCellLocal(eid, date, { status: 'work', start_time: cur.start_time, end_time: cur.end_time, leave_code: '' });
      } else {
        patchCellLocal(eid, date, { ...workTimesFromIn(emp, cur.start_time || '12:00'), leave_code: '' });
      }
    } else if (status === 'off') {
      patchCellLocal(eid, date, { status: 'off', start_time: '', end_time: '', leave_code: '' });
    }
  }

  function applyLeaveCode(code) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    const n = parseLeaveCode(code);
    const status = statusFromLeaveCode(n);
    const cur = getCellShift(eid, date);
    const houteiOpts = n === 10 ? { prefer10Date: date } : n === 20 ? { prefer20Date: date } : {};
    if (status === 'work') {
      const times = (cur.start_time && cur.end_time)
        ? { start_time: cur.start_time, end_time: cur.end_time }
        : workTimesFromIn(emp, cur.start_time || '12:00');
      patchCellLocal(eid, date, { ...times, status: 'work', leave_code: n }, houteiOpts);
    } else if (leaveCodeNeedsDummyShift(n)) {
      const tpl = resolvePtoTemplate(eid, emp);
      patchCellLocal(eid, date, {
        status: 'pto',
        leave_code: n,
        start_time: tpl.start_time,
        end_time: tpl.end_time,
        break_minutes: tpl.break_minutes,
      }, houteiOpts);
    } else {
      patchCellLocal(eid, date, { status, leave_code: n || '', start_time: '', end_time: '' }, houteiOpts);
    }
    if (user?.email && n) setLeavePrefs(markLeaveUsed(user.email, n));
  }

  function moveLeavePrefToUsed(code) {
    if (!user?.email) return;
    setLeavePrefs(moveLeaveToUsed(user.email, code));
  }

  function moveLeavePrefToUnused(code) {
    if (!user?.email) return;
    setLeavePrefs(moveLeaveToUnused(user.email, code));
  }

  function hideLeavePref(code) {
    if (!user?.email) return;
    setLeavePrefs(hideLeaveCode(user.email, code));
  }

  function restoreLeavePref(code) {
    if (!user?.email) return;
    setLeavePrefs(restoreLeaveCode(user.email, code));
  }

  function applyEditorTime(which, value) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const snapped = snapToStep(value, TIME_STEP_MIN);
    const cur = getCellShift(eid, date);
    const lc = parseLeaveCode(cur.leave_code);
    if (leaveCodeNeedsDummyShift(lc)) {
      const patch = {
        status: 'pto',
        leave_code: lc,
        start_time: cur.start_time || resolvePtoTemplate(eid, employees.find((x) => x.employee_id === eid)).start_time,
        end_time: cur.end_time || resolvePtoTemplate(eid, employees.find((x) => x.employee_id === eid)).end_time,
      };
      if (which === 'in') patch.start_time = snapped;
      else patch.end_time = snapped;
      patchCellLocal(eid, date, patch);
      return;
    }
    if (which === 'in') {
      patchCellLocal(eid, date, { status: 'work', start_time: snapped });
    } else {
      patchCellLocal(eid, date, { status: 'work', end_time: snapped });
    }
  }

  function applyEditorAutoOut() {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    const cur = getCellShift(eid, date);
    patchCellLocal(eid, date, {
      ...workTimesFromIn(emp, cur.start_time || '12:00'),
      leave_code: cur.leave_code || '',
    });
  }

  /** 有休などのときの IN・OUT を時間指定で入れる */
  async function applyEditorPartHours(hours) {
    if (!shiftEditor) return;
    const { employee_id: eid, date } = shiftEditor;
    const emp = employees.find((x) => x.employee_id === eid);
    await updateEmployeeProfile(eid, {
      employment_type: normalizeEmpType(emp?.employment_type),
      work_hours: hours,
    });
    const cur = getCellShift(eid, date);
    if ((cur.status || '') === 'work') {
      const start = cur.start_time || '12:00';
      patchCellLocal(eid, date, { status: 'work', start_time: start, end_time: addHoursToHm(start, hours) });
    }
  }

  async function flushDirtyShifts(opts = {}) {
    const quiet = opts.quiet !== false; // 既定は裏保存（操作を止めない）
    const runFlush = async () => {
      const sid = opts.store_id || opts.storeId || storeIdRef.current;
      const ym = opts.year_month || opts.yearMonth || yearMonthRef.current;
      const email = opts.user_email || opts.userEmail || userEmailRef.current || user?.email;
      const keysSnap = new Set(dirtyKeysRef.current);
      const memoKeysSnap = new Set(dirtyMemoKeysRef.current);
      const shiftCount = keysSnap.size;
      const memoCount = memoKeysSnap.size;
      if (!shiftCount && !memoCount) {
        if (!quiet) notify('変更はありません');
        return true;
      }
      if (!email || !sid || !ym) return false;

      const shiftRows = shiftsRef.current || [];
      const memoRows = memosRef.current || [];
      const shiftItems = shiftCount
        ? [...keysSnap].map((key) => {
            const [employeeId, date] = key.split('__');
            const s = shiftRows.find((row) => row.employee_id === employeeId && row.date === date) || {
              shift_id: '', status: 'undef', start_time: '', end_time: '', leave_code: '',
            };
            const status = s.status || 'undef';
            return {
              shift_id: s.shift_id || '',
              employee_id: employeeId,
              date,
              status,
              leave_code: parseLeaveCode(s.leave_code) || houteiMaps[employeeId]?.[date] || '',
              start_time: status === 'work' ? String(s.start_time || '').slice(0, 5) : '',
              end_time: status === 'work' ? String(s.end_time || '').slice(0, 5) : '',
            };
          })
        : [];
      const memoItems = memoCount
        ? [...memoKeysSnap].map((key) => {
            const [employeeId, date] = key.split('__');
            const m = memoRows.find((row) => row.employee_id === employeeId && row.date === date) || {
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

      setSaveState('saving');
      let latestMemos = memoRows;
      let latestShifts = shiftRows;
      let latestEmployees = employeesRef.current;
      let latestCanEdit = canEditRef.current;

      if (shiftItems.length) {
        const res = await api.upsertShiftsBatch({
          user_email: email,
          store_id: sid,
          items: shiftItems,
        });
        if (res.employees) latestEmployees = res.employees;
        if (res.canEdit != null) latestCanEdit = !!res.canEdit;
        if (Array.isArray(res.shifts)) {
          // 保存中に追加編集されたセルはローカルを優先して残す
          const stillDirty = dirtyKeysRef.current;
          if (stillDirty.size <= keysSnap.size) {
            const overlay = new Map();
            (shiftsRef.current || []).forEach((row) => {
              const k = `${row.employee_id}__${row.date}`;
              if (stillDirty.has(k) && !keysSnap.has(k)) overlay.set(k, row);
            });
            if (overlay.size) {
              latestShifts = (res.shifts || []).map((row) => {
                const k = `${row.employee_id}__${row.date}`;
                return overlay.get(k) || row;
              });
              overlay.forEach((row, k) => {
                if (!latestShifts.some((r) => `${r.employee_id}__${r.date}` === k)) {
                  latestShifts = latestShifts.concat([row]);
                }
              });
            } else {
              latestShifts = res.shifts;
            }
          } else {
            const overlay = new Map();
            (shiftsRef.current || []).forEach((row) => {
              const k = `${row.employee_id}__${row.date}`;
              if (stillDirty.has(k)) overlay.set(k, row);
            });
            latestShifts = (res.shifts || []).map((row) => {
              const k = `${row.employee_id}__${row.date}`;
              return overlay.get(k) || row;
            });
          }
          setEmployees(latestEmployees);
          setShifts(latestShifts);
          if (res.canEdit != null) setCanEdit(latestCanEdit);
          if (res.memos) latestMemos = res.memos;
        }
        setDirtyKeys((prev) => {
          const next = new Set(prev);
          keysSnap.forEach((k) => next.delete(k));
          return next;
        });
      }

      if (memoItems.length) {
        const res = await api.upsertMemosBatch({
          user_email: email,
          store_id: sid,
          items: memoItems,
        });
        if (res.memos) {
          const stillDirty = dirtyMemoKeysRef.current;
          if (stillDirty.size) {
            const overlay = new Map();
            (memosRef.current || []).forEach((row) => {
              const k = `${row.employee_id}__${row.date}`;
              if (stillDirty.has(k) && !memoKeysSnap.has(k)) overlay.set(k, row);
            });
            latestMemos = (res.memos || []).map((row) => {
              const k = `${row.employee_id}__${row.date}`;
              return overlay.get(k) || row;
            });
          } else {
            latestMemos = res.memos;
          }
        }
        setDirtyMemoKeys((prev) => {
          const next = new Set(prev);
          memoKeysSnap.forEach((k) => next.delete(k));
          return next;
        });
      }

      setMemos(latestMemos);
      const remain =
        [...dirtyKeysRef.current].filter((k) => !keysSnap.has(k)).length
        + [...dirtyMemoKeysRef.current].filter((k) => !memoKeysSnap.has(k)).length;
      setSaveState(remain ? 'pending' : 'saved');
      writeMonthCache(sid, ym, {
        employees: latestEmployees,
        shifts: latestShifts,
        memos: latestMemos,
        canEdit: latestCanEdit,
      });
      if (!quiet) notify('保存しました', 'ok');
      return true;
    };

    const queued = flushChainRef.current.then(runFlush, runFlush);
    flushChainRef.current = queued.then(() => undefined, () => undefined);
    try {
      return await queued;
    } catch (e) {
      setSaveState('error');
      notify(e.message || String(e), 'err');
      return false;
    }
  }

  function cellLabel(status, leaveCode) {
    const name = leaveCodeLabel(leaveCode);
    if (name) return name;
    switch (status) {
      case 'work': return '○';
      case 'off': return '×';
      case 'pto': return '有休';
      case 'absent': return '欠勤';
      default: return '';
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
  const empMonthSummaries = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((e) => {
      map.set(e.employee_id, summarizeEmpMonth(e, shifts, yearMonth));
    });
    return map;
  }, [employees, shifts, yearMonth]);
  const dirtyTotal = dirtyKeys.size + dirtyMemoKeys.size;
  const visibleDays = useMemo(() => monthDays(daysInMonth), [daysInMonth]);
  const printDayBlocks = useMemo(() => {
    if (!daysInMonth) return [];
    const mid = Math.ceil(daysInMonth / 2);
    return [
      { key: 'a', label: `1〜${mid}日`, days: monthDays(mid) },
      { key: 'b', label: `${mid + 1}〜${daysInMonth}日`, days: Array.from({ length: daysInMonth - mid }, (_, i) => mid + 1 + i) },
    ];
  }, [daysInMonth]);
  const sheetTableW = NAME_COL_W + DAY_COL_W * Math.max(visibleDays.length, 1);
  const timeOptions = useMemo(() => buildTimeOptions(TIME_STEP_MIN), []);
  const leaveCodeGroups = useMemo(() => sortLeaveCodes(leavePrefs), [leavePrefs]);
  const houteiMaps = useMemo(() => {
    const maps = {};
    (employees || []).forEach((e) => {
      maps[e.employee_id] = computeAutoHouteiMap(shifts, e.employee_id, yearMonth);
    });
    return maps;
  }, [employees, shifts, yearMonth]);

  const editorShift = shiftEditor
    ? getCellShift(shiftEditor.employee_id, shiftEditor.date)
    : null;
  const editorEmp = shiftEditor
    ? (employees.find((x) => x.employee_id === shiftEditor.employee_id) || null)
    : null;
  const editorMemo = shiftEditor
    ? getCellMemo(shiftEditor.employee_id, shiftEditor.date)
    : null;
  const editorPtoTemplate = useMemo(() => {
    if (!shiftEditor) return defaultPtoTemplate(null);
    return resolvePtoTemplate(shiftEditor.employee_id, editorEmp);
  }, [shiftEditor?.employee_id, editorEmp, ptoTemplateTick]);
  const editorLeaveCode = editorShift
    ? (parseLeaveCode(editorShift.leave_code) || houteiMaps[shiftEditor?.employee_id]?.[shiftEditor?.date] || 0)
    : 0;
  const editorShowsPaidLeaveHours = leaveCodeNeedsDummyShift(editorLeaveCode);
  const editorEmpName = editorEmp?.name || '';
  const editorOutAuto = editorEmp && editorShift
    ? addHoursToHm(editorShift.start_time || '12:00', spanHoursForEmp(editorEmp))
    : '';
  const empEditor = empEditorId
    ? (employees.find((x) => x.employee_id === empEditorId) || null)
    : null;

  async function changeMonth(targetYm) {
    if (!targetYm || targetYm === yearMonth) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    const prevSid = storeId;
    const prevYm = yearMonth;
    const hasDirty = !!(dirtyKeysRef.current.size || dirtyMemoKeysRef.current.size);
    const flushP = hasDirty
      ? flushDirtyShifts({ quiet: true, storeId: prevSid, yearMonth: prevYm })
      : Promise.resolve(true);
    setFocusCell(null);
    setShiftEditor(null);
    setEmpEditorId(null);
    setYearMonth(targetYm);
    const cached = readMonthCache(storeId, targetYm);
    if (cached?.employees?.length) {
      // キャッシュがあれば即表示。前月の保存は裏で続ける
      void flushP;
      await loadMonthly(storeId, targetYm, { quiet: true });
    } else {
      await flushP;
      await loadMonthly(storeId, targetYm, { quiet: true });
    }
  }

  async function openSettings(panel) {
    if (busy) return;
    if ((dirtyKeys.size || dirtyMemoKeys.size) && panel !== 'jurisdiction') {
      await flushDirtyShifts({ quiet: true });
    }
    setAccountOpen(false);
    if (panel === 'jurisdiction') {
      try {
        await withBusy('読み込み中…', async () => {
          const res = await api.loginWithEmail(user.email);
          setUser((prev) => ({
            ...prev,
            ...res,
            stores: res.stores?.length ? res.stores : prev?.stores,
          }));
          setDisplayName(res.name || displayName);
          setByeCode(res.bye_code || byeCode);
          const stores = res.stores?.length ? res.stores : (user?.stores || []);
          setSelectedStores(stores.map((s) => s.store_id));
          setSelectedArea('');
          setSelectedTerritory('');
          setSettingsPanel('jurisdiction');
        });
      } catch (e) {
        notify(e.message || String(e), 'err');
      }
      return;
    }
    // パネルを開くタイミングで必要なデータを読み込む
    setSettingsPanel(panel);
    if (panel === 'employees' || panel === 'weekly') {
      startProgress();
      const task = panel === 'employees'
        ? loadEmployees(storeId, { quiet: true })
        : loadWeekly(storeId, { quiet: true });
      Promise.resolve(task).finally(() => finishProgress());
    }
  }

  function closeSettings() {
    setSettingsPanel(null);
    setAccountOpen(false);
  }

  if (authStep === 'loading') {
    return (
      <div className="login-hero">
        <div className="login-hero-bg" aria-hidden="true">
          <LoginBgDecor />
        </div>
        <div className="login-hero-inner login-hero-inner--splash">
          <LoginLoadingPanel />
        </div>
      </div>
    );
  }

  if (authStep === 'login') {
    return (
      <div className="login-hero relative">
        <div className="login-hero-bg" aria-hidden="true">
          <LoginBgDecor />
        </div>
        {busy && (
          <div className="fixed inset-0 z-[100] bg-[#000b2b]/75 backdrop-blur-sm flex items-center justify-center p-6">
            <LoginLoadingPanel message={busyText || '処理中…'} />
          </div>
        )}

        <div className="login-hero-inner">
          <LoginHeroCopy tagline={APP_TAGLINE} />

          <div className="w-full max-w-[24rem]">
            <div className="login-card-float login-card-float--scroll">
              <div className="login-mode-tabs mb-3">
                <button
                  type="button"
                  className={`login-mode-tab ${managerAuthMode === 'login' ? 'login-mode-tab--on' : ''}`}
                  onClick={() => { setManagerAuthMode('login'); setLoginError(''); }}
                >
                  ログイン
                </button>
                <button
                  type="button"
                  className={`login-mode-tab ${managerAuthMode === 'register' ? 'login-mode-tab--on' : ''}`}
                  onClick={() => { setManagerAuthMode('register'); setLoginError(''); }}
                >
                  登録
                </button>
              </div>
              <h2 className="login-card-title">{managerAuthMode === 'register' ? '登録' : 'ログイン'}</h2>
              {managerAuthMode === 'register' ? (
                <form className="space-y-3.5 mt-5" onSubmit={(e) => { e.preventDefault(); registerManager(); }}>
                  <div>
                    <label className="login-form-label" htmlFor="login-email">メールアドレス</label>
                    <input id="login-email" type="email" required autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={`name@${domain}`} className="login-form-input" />
                  </div>
                  <div>
                    <label className="login-form-label" htmlFor="login-name">表示名</label>
                    <input id="login-name" type="text" autoComplete="name" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} placeholder="日下 竜汰" className="login-form-input" />
                  </div>
                  <div>
                    <label className="login-form-label" htmlFor="login-code">社員番号</label>
                    <input id="login-code" type="text" inputMode="numeric" required autoComplete="off" spellCheck={false} value={regByeCode} onChange={(e) => setRegByeCode(e.target.value)} placeholder="304642" className="login-form-input" />
                  </div>
                  {(meta?.areas || []).length > 0 && (
                    <div>
                      <label className="login-form-label" htmlFor="login-area">エリア</label>
                      <select id="login-area" className="login-form-input" value={regArea} onChange={(e) => { setRegArea(e.target.value); setRegTerritory(''); }}>
                        <option value="">すべて</option>
                        {(meta.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  {(() => {
                    const catalog = meta?.allStores || [];
                    const territories = [...new Set(catalog.filter((s) => !regArea || s.area === regArea).map((s) => String(s.territory || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
                    if (!territories.length) return null;
                    return (
                      <div>
                        <label className="login-form-label" htmlFor="login-territory">テリトリー</label>
                        <select id="login-territory" className="login-form-input" value={regTerritory} onChange={(e) => setRegTerritory(e.target.value)}>
                          <option value="">すべて</option>
                          {territories.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    );
                  })()}
                  <div>
                    <p className="login-form-label">管轄店舗</p>
                    <div className="flex flex-wrap gap-2 mt-1.5 max-h-40 overflow-y-auto">
                      {(meta?.allStores || [{ store_id: 'S001', store_name: '経堂', area: '第7エリア' }, { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア' }])
                        .filter((s) => (!regArea || s.area === regArea) && (!regTerritory || s.territory === regTerritory))
                        .map((s) => {
                          const on = regStores.includes(s.store_id);
                          return (
                            <button key={s.store_id} type="button" onClick={() => setRegStores((prev) => (prev.includes(s.store_id) ? prev.filter((x) => x !== s.store_id) : [...prev, s.store_id]))} className={`px-3.5 py-2 rounded-xl text-[14px] font-bold border ${on ? 'bg-[#039be5] text-white border-[#039be5]' : 'bg-white text-slate-700 border-slate-200'}`}>
                              {s.store_name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  {loginError && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{loginError}</p>}
                  <button type="submit" disabled={busy} className="login-submit"><span>登録する</span><IconLoginArrow /></button>
                </form>
              ) : (
                <form className="space-y-4 mt-5" onSubmit={(e) => { e.preventDefault(); login(loginEmail); }}>
                  <div>
                    <label className="login-form-label" htmlFor="login-email-only">メールアドレス</label>
                    <input id="login-email-only" type="email" required autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={`name@${domain}`} className="login-form-input" />
                  </div>
                  {loginError && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{loginError}</p>}
                  <button type="submit" disabled={busy} className="login-submit"><span>ログイン</span><IconLoginArrow /></button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-white relative flex flex-col overflow-hidden">
      {/* ===== ヘッダー（ツールバー） ===== */}
      <div className="absolute inset-0 z-10 flex flex-col bg-white text-zinc-900">
          {/* 左: 年月と店舗 */}
          <div className="shrink-0 app-toolbar">
            <div className="app-toolbar-accent" aria-hidden="true" />
            <div className="app-toolbar-pad">
              <div className="app-toolbar-inner">
              <div className="app-toolbar-left">
              {(() => {
                const curYm = meta?.serverYearMonth || yearMonth;
                const [yStr, mStr] = String(yearMonth || curYm || '').split('-');
                const yNow = Number(String(curYm).split('-')[0]) || new Date().getFullYear();
                const ySel = Number(yStr) || yNow;
                const mSel = Number(mStr) || 1;
                const baseYm = yearMonth || curYm;
                const years = [];
                for (let y = yNow - 5; y <= yNow + 2; y += 1) years.push(y);
                if (!years.includes(ySel)) years.push(ySel);
                years.sort((a, b) => a - b);
                return (
                  <div className="app-ym-nav" role="group" aria-label="年月">
                    <button
                      type="button"
                      className="app-ym-nav__arrow"
                      disabled={busy || !baseYm}
                      onClick={() => changeMonth(shiftYearMonth(baseYm, -1))}
                      title="前月"
                      aria-label="前月"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                        <path d="M14.5 6L9 12l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <select
                      className="app-ym-nav__select app-ym-nav__year"
                      value={ySel}
                      disabled={busy}
                      onChange={(e) => changeMonth(`${e.target.value}-${pad2(mSel)}`)}
                      aria-label="年"
                    >
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="app-ym-nav__unit">年</span>
                    <select
                      className="app-ym-nav__select app-ym-nav__month"
                      value={mSel}
                      disabled={busy}
                      onChange={(e) => changeMonth(`${ySel}-${pad2(Number(e.target.value))}`)}
                      aria-label="月"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <span className="app-ym-nav__unit">月</span>
                    <button
                      type="button"
                      className="app-ym-nav__arrow"
                      disabled={busy || !baseYm}
                      onClick={() => changeMonth(shiftYearMonth(baseYm, 1))}
                      title="翌月"
                      aria-label="翌月"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                        <path d="M9.5 6L15 12l-5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                );
              })()}
              <select
                className="app-store-select"
                value={storeId}
                disabled={busy || !(user?.stores || []).length}
                onChange={(e) => switchStore(e.target.value, yearMonth)}
                aria-label="店舗"
              >
                {(user?.stores || []).map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>
              {progress != null && (
                <div className="app-progress" role="status" aria-live="polite">
                  <span className="app-progress-track" aria-hidden="true">
                    <span className="app-progress-fill" style={{ width: `${progress}%` }} />
                  </span>
                  <span className="app-progress-pct">{progress}%</span>
                </div>
              )}
              </div>

              <div className="app-toolbar-right">
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={copyByeBye}
                  className="app-kintai-btn"
                  title="キンタイコピー（押したら自動コピー）"
                  aria-label="キンタイコピー"
                >
                  <svg viewBox="0 0 24 24" className="app-kintai-btn__icon" fill="none" aria-hidden="true">
                    <rect x="8" y="4" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M6 8H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 21h9a1.5 1.5 0 0 0 1.5-1.5V18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M11 9h5M11 12h5M11 15h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>キンタイ</span>
                </button>
              )}
              {canEdit && (
                <div className="app-tpl-dock" role="group" aria-label="テンプレート">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={applyWeeklyTemplateToMonth}
                    className="app-tpl-dock__btn"
                    title="週間テンプレートを表示中の月に反映"
                  >
                    反映
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearMonthShifts}
                    className="app-tpl-dock__btn app-tpl-dock__btn--danger"
                    title="表示中の月のシフトをすべて白紙にする"
                  >
                    白紙
                  </button>
                </div>
              )}
              {canEdit && exportPanelOpen && (
                <div className="app-cal-dock" role="group" aria-label="カレンダー">
                  <button
                    type="button"
                    disabled={busy || !!calendarProgress}
                    onClick={syncCalendar}
                    className="app-cal-dock__btn"
                    title="カレンダー登録（自分のみ）"
                  >
                    登録
                  </button>
                  <button
                    type="button"
                    disabled={busy || !!calendarProgress}
                    onClick={clearCalendar}
                    className="app-cal-dock__btn app-cal-dock__btn--ghost"
                    title="カレンダークリア（表示中の月・自分のみ）"
                  >
                    クリア
                  </button>
                </div>
              )}
              {canEdit && (
                <div className="app-tool-group" role="toolbar" aria-label="編集">
                  <button
                    type="button"
                    className="app-tool-btn"
                    disabled={busy || historyRef.current.past.length === 0}
                    onClick={undoEdit}
                    title="元に戻す (Ctrl+Z)"
                    aria-label="元に戻す"
                  >
                    <svg viewBox="0 0 24 24" className="app-tool-icon" fill="none" aria-hidden="true">
                      <path d="M9 8H5V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 8a7 7 0 1 1 2 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="app-tool-btn"
                    disabled={busy || historyRef.current.future.length === 0}
                    onClick={redoEdit}
                    title="やり直す (Ctrl+Y)"
                    aria-label="やり直す"
                  >
                    <svg viewBox="0 0 24 24" className="app-tool-icon" fill="none" aria-hidden="true">
                      <path d="M15 8h4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 8a7 7 0 1 0-2 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="app-tool-btn"
                    disabled={busy}
                    onClick={printShiftSheet}
                    title="A4横で掲示用に印刷"
                    aria-label="印刷"
                  >
                    <svg viewBox="0 0 24 24" className="app-tool-icon" fill="none" aria-hidden="true">
                      <path d="M7 8V4h10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 16H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M7 12h10v8H7v-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`app-tool-btn ${exportPanelOpen ? 'app-tool-btn--on' : ''}`}
                    disabled={busy}
                    onClick={() => setExportPanelOpen((v) => !v)}
                    title={exportPanelOpen ? 'カレンダー操作を閉じる' : 'カレンダー登録・クリア'}
                    aria-label="カレンダー"
                    aria-expanded={exportPanelOpen}
                  >
                    <svg viewBox="0 0 24 24" className="app-tool-icon" fill="none" aria-hidden="true">
                      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
              {canEdit && (saveState !== 'idle' || dirtyTotal > 0) && (
                <span className={`app-save-badge ${
                  saveState === 'saving' || saveState === 'pending' ? 'text-[#1565c0] border-[#b8d4ea]'
                    : saveState === 'error' ? 'text-rose-600 border-rose-200 bg-rose-50'
                      : saveState === 'saved' ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                        : dirtyTotal > 0 ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-zinc-400'
                }`}>
                  {saveState === 'saving' || saveState === 'pending' ? '保存中…'
                    : saveState === 'error' ? '保存エラー'
                      : saveState === 'saved' && dirtyTotal === 0 ? '保存済み'
                        : dirtyTotal > 0 ? `未保存 ${dirtyTotal}` : ''}
                </span>
              )}
              {calendarProgress ? (
                <span
                  className="app-save-badge text-[#1565c0] border-[#b8d4ea] bg-[#eef6fc] tabular-nums"
                  title="カレンダー処理中（他の操作は可能）"
                >
                  カレンダー {calendarProgress.percent}% {calendarProgress.label || ''}
                </span>
              ) : null}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="app-account-btn"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className="app-account-avatar">{accountInitial}</span>
                  <svg className="app-account-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-[120]" onClick={() => setAccountOpen(false)} />
                    <div className="app-account-menu" role="menu">
                      <div className="app-account-menu-head">
                        <p className="font-extrabold text-[15px] truncate">{user?.name}</p>
                        <p className="text-[13px] text-white/80 truncate mt-0.5">{storeName}</p>
                      </div>
                      {ACCOUNT_MENU.map((item) => {
                        const Icon = MENU_ICONS[item.id];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => openSettings(item.id)}
                            className="app-menu-item"
                          >
                            <span className="app-menu-icon"><Icon /></span>
                            <span className="app-menu-label">{item.label}</span>
                          </button>
                        );
                      })}
                      <button type="button" role="menuitem" onClick={logout} className="app-menu-logout">ログアウト</button>
                    </div>
                  </>
                )}
              </div>
              </div>
              </div>
            </div>
          </div>

          {msg && (
            <p
              className={`app-flash-msg shrink-0 px-4 py-1.5 text-xs font-medium border-b border-zinc-100 ${
                msgKind === 'err' ? 'text-white bg-zinc-900' : 'text-zinc-500 bg-white'
              }`}
            >{msg}</p>
          )}

          {monthlyRefreshing && employees.length > 0 ? (
            <p className="app-flash-msg shrink-0 px-4 py-1 text-[11px] text-slate-500 bg-slate-50 border-b border-zinc-100">
              最新データを同期中…
            </p>
          ) : null}

          {monthlyLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="h-9 w-9 rounded-full border-[3px] border-slate-200 border-t-[var(--acc-500)] animate-spin" />
              <p className="font-semibold text-sm">月間シフトを準備中…</p>
            </div>
          ) : !daysInMonth || !employees.length ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="font-semibold text-sm text-zinc-500">この店舗に登録されている従業員がいません</p>
              <p className="text-xs text-zinc-400">右上メニュー →「スタッフ情報 追加・変更」からスタッフを追加できます</p>
            </div>
          ) : (
            <Fragment>
            <div ref={sheetAreaRef} className="flex-1 min-h-0 overflow-scroll sheet-scroll bg-white" onPaste={handleSheetPaste}>
              <table className="sheet-table" style={{ tableLayout: 'fixed', width: sheetTableW }}>
                <colgroup>
                  <col style={{ width: NAME_COL_W }} />
                  {visibleDays.map((day) => <col key={day} style={{ width: DAY_COL_W }} />)}
                </colgroup>
                <thead className="sticky top-0 z-30">
                  <tr className="sheet-head">
                    <th
                      className={`sticky left-0 z-40 ${SHEET_NAME} sheet-name-head px-2 py-2.5 text-center sheet-head`}
                      title={staffColLabel}
                    >
                      <div className="staff-col-title">
                        {staffColParts.code ? (
                          <span className="staff-col-title__code">{staffColParts.code}</span>
                        ) : null}
                        {staffColParts.name ? (
                          <span className="staff-col-title__store">{staffColParts.name}</span>
                        ) : null}
                        {staffColParts.suffix ? (
                          <span className="staff-col-title__suffix">{staffColParts.suffix}</span>
                        ) : (
                          <span className="staff-col-title__store">{staffColLabel}</span>
                        )}
                      </div>
                    </th>
                    {visibleDays.map((day) => {
                      const date = toYmDay(yearMonth, day);
                      const wd = new Date(`${date}T00:00:00`).getDay();
                      return (
                        <th
                          key={date}
                          className={`${SHEET_DAY} px-0 py-2.5 text-center sheet-head`}
                          style={wd === 0 ? { boxShadow: 'inset 0 -3px 0 #b71c1c' } : wd === 6 ? { boxShadow: 'inset 0 -3px 0 #1565c0' } : null}
                        >
                          <div className="text-lg font-bold leading-none tabular-nums text-white">{day}</div>
                          <div className="text-xs font-semibold mt-1 text-white/90">{WEEKDAY_LABELS[wd]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, empIdx) => {
                    const memoOpen = memoOpenIds.has(e.employee_id);
                    const dragging = empDragId === e.employee_id;
                    const dragOver = empDragOverId === e.employee_id && empDragId !== e.employee_id;
                    const nameBg = empIdx % 2 ? 'bg-[#f3f7fb]' : 'bg-white';
                    return (
                    <Fragment key={e.employee_id}>
                      {/* 氏名列 */}
                      <tr
                        className={`group ${dragging ? 'opacity-70' : ''}`}
                        data-emp-id={e.employee_id}
                      >
                        <td
                          className={`sticky left-0 z-20 ${SHEET_NAME} p-0 ${nameBg} ${empEditorId === e.employee_id ? 'ring-2 ring-inset ring-[var(--acc-500)]/30' : ''} ${dragging ? 'ring-2 ring-inset ring-[var(--acc-500)]' : ''} ${dragOver ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                        >
                          <div className="flex items-stretch" style={{ height: SHIFT_ROW_H }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                toggleMemoRow(e.employee_id);
                              }}
                              className={`sheet-memo-toggle shrink-0 w-8 flex flex-col items-center justify-end gap-0.5 pb-2.5 border-r border-[#1a1a1a]/70 transition-colors disabled:opacity-50 ${
                                memoOpen ? 'bg-[#eef3f8] text-zinc-800' : 'bg-transparent text-zinc-400 hover:text-zinc-700 hover:bg-[#f7fafc]'
                              }`}
                              title={memoOpen ? 'メモを閉じる' : 'メモを開く'}
                              aria-label={memoOpen ? 'メモを閉じる' : 'メモを開く'}
                              aria-expanded={memoOpen}
                            >
                              <svg
                                viewBox="0 0 12 12"
                                className={`w-3 h-3 transition-transform ${memoOpen ? 'rotate-0' : '-rotate-90'}`}
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M2.2 4.1L6 9l3.8-4.9H2.2z" />
                              </svg>
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onPointerDown={(ev) => {
                                  ev.stopPropagation();
                                  onEmpNamePointerDown(ev, e.employee_id, { instant: true });
                                }}
                                className={`sheet-emp-grip shrink-0 w-4 flex items-center justify-center text-zinc-300 hover:text-zinc-600 hover:bg-[#f1f5f9] outline-none select-none ${dragging ? 'text-zinc-700 bg-[#e8eef5]' : ''}`}
                                style={{ height: SHIFT_ROW_H, touchAction: 'none', cursor: 'grab' }}
                                title="ドラッグして並べ替え"
                                aria-label="並べ替え"
                              >
                                <svg viewBox="0 0 6 16" className="w-[6px] h-4" fill="currentColor" aria-hidden="true">
                                  <circle cx="1.5" cy="3" r="1" />
                                  <circle cx="4.5" cy="3" r="1" />
                                  <circle cx="1.5" cy="6.5" r="1" />
                                  <circle cx="4.5" cy="6.5" r="1" />
                                  <circle cx="1.5" cy="10" r="1" />
                                  <circle cx="4.5" cy="10" r="1" />
                                  <circle cx="1.5" cy="13.5" r="1" />
                                  <circle cx="4.5" cy="13.5" r="1" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onPointerDown={(ev) => onEmpNamePointerDown(ev, e.employee_id)}
                              onDoubleClick={(ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                endEmpDrag_(false);
                                openEmpEditor(e.employee_id);
                              }}
                              className={`min-w-0 flex-1 px-3 text-left hover:bg-[#f7fafc] disabled:opacity-60 outline-none select-none ${empDragId ? 'cursor-grabbing' : canEdit ? 'cursor-grab' : ''}`}
                              style={{ height: SHIFT_ROW_H, touchAction: empDragId ? 'none' : 'manipulation' }}
                              title={canEdit ? 'ダブルクリックで編集 / 長押しして上下に並べ替え' : ''}
                            >
                              <div className="font-bold text-[15px] leading-snug whitespace-nowrap truncate text-zinc-900">{e.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <span className={`sheet-emp-tag ${isFullTimeEmp(e) ? 'sheet-emp-tag-full' : 'sheet-emp-tag-part'}`} title={isFullTimeEmp(e) ? '社員' : 'アルバイト'}>
                                  {isFullTimeEmp(e) ? '社' : 'ア'}
                                </span>
                                <span className="text-[12px] font-medium text-zinc-400 truncate">{e.bye_code || ''}</span>
                              </div>
                              {(() => {
                                const sum = empMonthSummaries.get(e.employee_id) || summarizeEmpMonth(e, shifts, yearMonth);
                                return (
                                  <div className="mt-1 px-1 py-0.5 text-[11px] leading-tight tabular-nums text-zinc-800 bg-[#fde8d4]">
                                    {isFullTimeEmp(e) ? (
                                      <>
                                        <div>{sum.shiftDays}日 ⇔ {sum.prescribedDays}日</div>
                                        <div>{sum.shiftHm} ⇔ {sum.prescribedHm}</div>
                                      </>
                                    ) : (
                                      <div>{sum.shiftDays}日　{sum.shiftHm}</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </button>
                          </div>
                        </td>
                        {visibleDays.map((day) => {
                          const date = toYmDay(yearMonth, day);
                          const s = getCellShift(e.employee_id, date);
                          const status = s.status || 'undef';
                          const leaveCode = parseLeaveCode(s.leave_code) || houteiMaps[e.employee_id]?.[date] || 0;
                          const dirty = dirtyKeys.has(shiftKey(e.employee_id, date));
                          const focused = focusCell?.employee_id === e.employee_id && focusCell?.date === date && focusCell?.layer !== 'memo';
                          const editing = focused && focusCell?.editing;
                          const leaveName = leaveCodeLabel(leaveCode);
                          let top = cellLabel(status, leaveCode);
                          let bottom = '';
                          if (leaveName) {
                            top = leaveName;
                            if (status === 'work') {
                              const a = String(s.start_time || '').slice(0, 5);
                              const b = String(s.end_time || '').slice(0, 5);
                              bottom = a && b ? `${a}-${b}` : a;
                            } else {
                              bottom = String(leaveCode);
                            }
                          } else if (status === 'work') {
                            top = String(s.start_time || '').slice(0, 5);
                            bottom = String(s.end_time || '').slice(0, 5);
                          }
                          const isLeave = status === 'off' || status === 'pto' || status === 'absent' || leaveCode === 10 || leaveCode === 20;
                          const fg = isLeave ? '#b71c1c' : '#1a2430';
                          const holidayBg = (leaveCode === 10 || leaveCode === 20) ? 'bg-[#f2f2f2]' : (empIdx % 2 ? 'bg-[#f3f7fb]' : 'bg-white');
                          return (
                            <td
                              key={`${e.employee_id}-${date}`}
                              className={`${SHEET_DAY} p-0 ${dirty ? 'bg-[#fff59d]' : holidayBg}`}
                              style={{
                                height: SHIFT_ROW_H,
                                color: fg,
                                ...(focused ? { boxShadow: CELL_FOCUS_RING } : null),
                              }}
                            >
                              {editing ? (
                                <input
                                  ref={cellEditRef}
                                  value={editDraft}
                                  disabled={busy}
                                  onChange={(ev) => setEditDraft(ev.target.value)}
                                  onPaste={(ev) => {
                                    const text = ev.clipboardData?.getData('text/plain') || '';
                                    if (looksLikeStackedTimesCell(text) || clipboardGridIsMulti(parseClipboardGrid(text))) {
                                      ev.preventDefault();
                                      applySpreadsheetPaste(text, {
                                        employee_id: e.employee_id,
                                        date,
                                        layer: 'shift',
                                      });
                                    }
                                  }}
                                  onBlur={() => commitShiftEdit()}
                                  onKeyDown={(ev) => {
                                    if (ev.key === 'Enter') { ev.preventDefault(); commitShiftEdit({ moveEmp: 1 }); }
                                    else if (ev.key === 'Escape') { ev.preventDefault(); cancelCellEdit(); }
                                    else if (ev.key === 'Tab') { ev.preventDefault(); commitShiftEdit({ moveDay: ev.shiftKey ? -1 : 1 }); }
                                  }}
                                  className="w-full px-1 text-center text-base font-semibold bg-white text-zinc-900 outline-none tabular-nums"
                                  style={{ height: SHIFT_ROW_H }}
                                  placeholder="13-22"
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy || !canEdit}
                                  tabIndex={0}
                                  data-shift-cell={`${e.employee_id}__${date}`}
                                  onClick={() => selectShiftCell(e.employee_id, date)}
                                  onDoubleClick={(ev) => {
                                    ev.preventDefault();
                                    openShiftEditor(e.employee_id, date);
                                  }}
                                  onPaste={(ev) => {
                                    const text = ev.clipboardData?.getData('text/plain') || '';
                                    if (!text) return;
                                    ev.preventDefault();
                                    applySpreadsheetPaste(text, {
                                      employee_id: e.employee_id,
                                      date,
                                      layer: 'shift',
                                    });
                                  }}
                                  onKeyDown={(ev) => handleShiftCellKeyDown(ev, e.employee_id, date)}
                                  className="sheet-cell-btn w-full px-1 flex flex-col items-center justify-center leading-none hover:bg-[#f7fafc] disabled:opacity-60 outline-none focus:outline-none focus-visible:outline-none"
                                  style={{ height: SHIFT_ROW_H }}
                                  title={leaveName ? `${leaveCode} ${leaveName}` : 'クリックで選択 / ダブルクリックで編集'}
                                >
                                  <span className={`font-bold leading-tight px-0.5 ${leaveName ? 'text-[13px]' : 'text-base tabular-nums'}`}>{top}</span>
                                  {bottom ? <span className="text-[13px] font-semibold tabular-nums text-zinc-500 mt-0.5">{bottom}</span> : null}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {/* MEMO行（展開しているスタッフのみ表示） */}
                      {memoOpen && (
                      <tr
                        className={`sheet-memo-row ${dragging ? 'opacity-70' : ''}`}
                        data-emp-id={e.employee_id}
                      >
                        <td
                          className={`sticky left-0 z-20 ${SHEET_NAME} p-0 bg-[#f7f7f7] ${dragging ? 'ring-2 ring-inset ring-[var(--acc-500)]' : ''} ${dragOver ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                        >
                          <button
                            type="button"
                            disabled={!canEdit}
                            onPointerDown={(ev) => onEmpNamePointerDown(ev, e.employee_id)}
                            className={`w-full h-full px-3 text-left text-[11px] font-bold tracking-wide text-zinc-500 hover:bg-[#eeeeee] disabled:opacity-60 outline-none select-none ${empDragId ? 'cursor-grabbing' : canEdit ? 'cursor-grab' : ''}`}
                            style={{ height: MEMO_ROW_H, touchAction: empDragId ? 'none' : 'manipulation' }}
                            title={canEdit ? '長押しして上下に並べ替え' : ''}
                          >
                            メモ
                          </button>
                        </td>
                        {visibleDays.map((day) => {
                          const date = toYmDay(yearMonth, day);
                          const m = getCellMemo(e.employee_id, date);
                          const body = String(m.body || '');
                          const dirty = dirtyMemoKeys.has(shiftKey(e.employee_id, date));
                          const focused = focusCell?.employee_id === e.employee_id && focusCell?.date === date && focusCell?.layer === 'memo';
                          const editing = focused && focusCell?.editing;
                          return (
                            <td
                              key={`memo-${e.employee_id}-${date}`}
                              className={`${SHEET_DAY} p-0 ${dirty ? 'bg-[#fff59d]' : 'bg-white'}`}
                              style={{
                                height: MEMO_ROW_H,
                                ...(focused ? { boxShadow: CELL_FOCUS_RING } : null),
                              }}
                            >
                              {editing ? (
                                <textarea
                                  disabled={busy || !canEdit}
                                  value={body}
                                  rows={MEMO_MAX_LINES}
                                  autoFocus
                                  onFocus={() => {
                                    setShiftEditor(null);
                                    setFocusCell({ employee_id: e.employee_id, date, layer: 'memo', editing: true });
                                  }}
                                  onBlur={() => {
                                    setFocusCell((prev) => (
                                      prev?.employee_id === e.employee_id && prev?.date === date && prev?.layer === 'memo'
                                        ? { ...prev, editing: false }
                                        : prev
                                    ));
                                  }}
                                  onPaste={(ev) => {
                                    const text = ev.clipboardData?.getData('text/plain') || '';
                                    if (!clipboardGridIsMulti(parseClipboardGrid(text))) return;
                                    ev.preventDefault();
                                    applySpreadsheetPaste(text, {
                                      employee_id: e.employee_id,
                                      date,
                                      layer: 'memo',
                                    });
                                  }}
                                  onChange={(ev) => patchMemoLocal(e.employee_id, date, ev.target.value)}
                                  className="w-full h-full px-1 py-0.5 text-[11px] font-medium text-zinc-800 bg-transparent border-0 outline-none resize-none leading-tight disabled:opacity-60"
                                  style={{ height: MEMO_ROW_H }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy || !canEdit}
                                  onClick={() => {
                                    startTransition(() => {
                                      setShiftEditor(null);
                                      setFocusCell({ employee_id: e.employee_id, date, layer: 'memo', editing: false });
                                    });
                                  }}
                                  onDoubleClick={() => {
                                    setShiftEditor(null);
                                    setFocusCell({ employee_id: e.employee_id, date, layer: 'memo', editing: true });
                                  }}
                                  onPaste={(ev) => {
                                    const text = ev.clipboardData?.getData('text/plain') || '';
                                    if (!text) return;
                                    ev.preventDefault();
                                    applySpreadsheetPaste(text, {
                                      employee_id: e.employee_id,
                                      date,
                                      layer: 'memo',
                                    });
                                  }}
                                  className="sheet-cell-btn w-full px-1 py-0.5 flex items-start justify-start text-left hover:bg-[#f7fafc] disabled:opacity-60 outline-none focus:outline-none"
                                  style={{ height: MEMO_ROW_H }}
                                  title="クリックで選択 / ダブルクリックで編集"
                                >
                                  <span className="text-[11px] font-medium text-zinc-800 leading-tight whitespace-pre-wrap break-words line-clamp-4 w-full">
                                    {body}
                                  </span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="print-board" aria-hidden="true">
              <div className="print-sheet-banner">
                <p className="print-sheet-banner__title">{formatYmJa(yearMonth)}　{storeName || staffColLabel}</p>
              </div>
              {printDayBlocks.map((block) => (
                <div key={block.key} className="print-board__block">
                  <table className="print-board__table">
                    <thead>
                      <tr>
                        <th className="print-board__name print-board__name--head" aria-hidden="true" />
                        {block.days.map((day) => {
                          const date = toYmDay(yearMonth, day);
                          const wd = new Date(`${date}T00:00:00`).getDay();
                          const weekend = wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : '';
                          return (
                            <th key={day} className={`print-board__day ${weekend}`}>
                              <span className="print-board__day-num">{day}</span>
                              <span className="print-board__day-wd">{WEEKDAY_LABELS[wd]}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((e, empIdx) => (
                        <tr key={`${block.key}-${e.employee_id}`} className={empIdx % 2 ? 'is-alt' : ''}>
                          <th className="print-board__name">{e.name}</th>
                          {block.days.map((day) => {
                            const date = toYmDay(yearMonth, day);
                            const cell = printCellContent(e.employee_id, date);
                            return (
                              <td
                                key={`${e.employee_id}-${date}`}
                                className={`print-board__cell ${cell.leave ? 'is-leave' : ''} ${!cell.leave && cell.lines.length ? 'is-work' : ''}`}
                              >
                                {cell.lines.map((line, i) => (
                                  <span key={i} className="print-board__line">{line}</span>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            </Fragment>
          )}

          {empEditor && (
            <div className="km-overlay" onClick={closeEmpEditor}>
              <div className="km-dialog" onClick={(ev) => ev.stopPropagation()}>
                <div className="km-dialog-head flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold tracking-wide opacity-90">スタッフ情報</p>
                    <p className="text-[20px] font-bold leading-tight mt-0.5">{empEditor.name}</p>
                  </div>
                  <button type="button" onClick={closeEmpEditor} className="h-9 px-3 text-[13px] font-semibold bg-white/15 border border-white/40 text-white">
                    閉じる
                  </button>
                </div>
                <div className="km-dialog-body space-y-4">
                  <div>
                    <p className="text-[13px] font-bold text-slate-700 mb-2">区分</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateEmployeeProfile(empEditor.employee_id, {
                          employment_type: '社員',
                          work_hours: carryOverHours(empEditor, '社員'),
                        })}
                        className={`sheet-chip h-10 px-4 text-[15px] ${isFullTimeEmp(empEditor) ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                      >
                        社員
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateEmployeeProfile(empEditor.employee_id, {
                          employment_type: 'アルバイト',
                          work_hours: carryOverHours(empEditor, 'アルバイト'),
                        })}
                        className={`sheet-chip h-10 px-4 text-[15px] ${!isFullTimeEmp(empEditor) ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                      >
                        アルバイト
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openWeeklyForEmp(empEditor.employee_id)}
                      className="emp-menu-item"
                    >
                      <span className="emp-menu-main">週間テンプレートを開く</span>
                      <span className="emp-menu-sub">曜日ごとの固定シフトを設定する</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEmpDetailFor(empEditor)}
                      className="emp-menu-item"
                    >
                      <span className="emp-menu-main">スタッフ情報を編集</span>
                      <span className="emp-menu-sub">氏名・社員番号・既定の勤務時間</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {shiftEditor && editorShift && !focusCell?.editing && (
            <div className="km-overlay" onClick={closeShiftEditor}>
              <div className="km-dialog" onClick={(ev) => ev.stopPropagation()}>
                <div className="km-dialog-head flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold tracking-wide opacity-90">シフトを変更</p>
                    <p className="text-[20px] font-bold leading-tight mt-0.5">{editorEmpName}</p>
                    <p className="text-[15px] font-medium mt-0.5 tabular-nums opacity-95">{formatDateJa(shiftEditor.date)}</p>
                  </div>
                  <button type="button" onClick={closeShiftEditor} className="h-9 px-3 text-[13px] font-semibold bg-white/15 border border-white/40 text-white">
                    閉じる
                  </button>
                </div>
                <div className="km-dialog-body space-y-4">
                  <div>
                    <p className="text-[16px] font-bold text-slate-800 mb-2">区分</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {SHIFT_STATUS_OPTIONS.map((st) => {
                        const autoLc = houteiMaps[shiftEditor.employee_id]?.[shiftEditor.date] || 0;
                        const active = shiftCategoryId(editorShift, autoLc) === st.id;
                        const isMark = st.id === 'work' || st.id === 'off';
                        return (
                          <button
                            key={st.id}
                            type="button"
                            disabled={busy}
                            title={st.title || st.label}
                            onClick={() => applyEditorStatus(st.id)}
                            className={
                              isMark
                                ? `w-12 h-12 text-[22px] font-black border transition ${
                                  active
                                    ? (st.id === 'work'
                                      ? 'bg-emerald-500 text-white border-emerald-500'
                                      : 'bg-orange-500 text-white border-orange-500')
                                    : 'bg-white text-slate-400 border-[#9db4c8] hover:border-[#2f7ec4]'
                                }`
                                : `sheet-chip h-10 px-4 text-[15px] ${active ? 'sheet-chip-on' : 'sheet-chip-off'}`
                            }
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <LeaveCodePicker
                    groups={leaveCodeGroups}
                    query={leaveQuery}
                    onQuery={setLeaveQuery}
                    selected={parseLeaveCode(editorShift.leave_code) || houteiMaps[shiftEditor.employee_id]?.[shiftEditor.date]}
                    onPick={applyLeaveCode}
                    onMoveToUsed={moveLeavePrefToUsed}
                    onMoveToUnused={moveLeavePrefToUnused}
                    onHide={hideLeavePref}
                    onRestore={restoreLeavePref}
                    onOpenPtoHours={() => {
                      const tpl = resolvePtoTemplate(shiftEditor.employee_id, editorEmp);
                      setPtoTemplateDraft(tpl);
                      setPtoTemplateOpen(true);
                    }}
                    ptoHoursLabel={`${editorPtoTemplate.start_time}-${editorPtoTemplate.end_time}`}
                    disabled={busy}
                  />
                  {ptoTemplateOpen && (
                    <div className="rounded border border-[#9db4c8] bg-[#f7fafc] p-3 space-y-3">
                      <p className="text-[14px] font-bold text-slate-800">有休取得時のIN・OUT時間</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed">
                        この人用に保存されます。有休などを選ぶと、ここに設定した時間が入ります。
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 min-w-[8rem]">
                          <span className="text-[13px] font-bold text-slate-700">IN</span>
                          <select
                            className="sheet-select h-11 text-[16px] tabular-nums"
                            value={snapToStep(ptoTemplateDraft.start_time || '10:00', TIME_STEP_MIN)}
                            onChange={(ev) => setPtoTemplateDraft((d) => ({ ...d, start_time: ev.target.value }))}
                            disabled={busy}
                          >
                            {Array.from({ length: 48 }, (_, i) => {
                              const hm = `${pad2(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
                              return <option key={hm} value={hm}>{hm}</option>;
                            })}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 min-w-[8rem]">
                          <span className="text-[13px] font-bold text-slate-700">OUT</span>
                          <select
                            className="sheet-select h-11 text-[16px] tabular-nums"
                            value={snapToStep(ptoTemplateDraft.end_time || '19:00', TIME_STEP_MIN)}
                            onChange={(ev) => setPtoTemplateDraft((d) => ({ ...d, end_time: ev.target.value }))}
                            disabled={busy}
                          >
                            {Array.from({ length: 48 }, (_, i) => {
                              const hm = `${pad2(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
                              return <option key={hm} value={hm}>{hm}</option>;
                            })}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="sheet-chip h-11 px-4 sheet-chip-on"
                          disabled={busy || !shiftEditor}
                          onClick={() => {
                            savePtoTemplate(shiftEditor.employee_id, ptoTemplateDraft);
                            setPtoTemplateTick((t) => t + 1);
                            setPtoTemplateOpen(false);
                            notify('この人の有休IN・OUTを保存しました', 'ok');
                          }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="sheet-chip h-11 px-4 sheet-chip-off"
                          onClick={() => setPtoTemplateOpen(false)}
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                  {((editorShift.status || 'undef') === 'work' || editorShowsPaidLeaveHours) && (
                    <div className="space-y-3 pt-1 border-t border-[#c5d4e0]">
                      {editorShowsPaidLeaveHours && (
                        <p className="text-[13px] text-slate-600">
                          {leaveCodeLabel(editorLeaveCode) || '有休'}取得時のIN・OUT時間を設定可能です
                        </p>
                      )}
                      {(editorShift.status || '') === 'work' && (
                        <div>
                          <p className="text-[14px] font-bold text-slate-800 mb-2">既定時間</p>
                          <div className="flex flex-wrap gap-1.5">
                            {hourOptionsForEmp(editorEmp).map((h) => {
                              const active = Number(spanHoursForEmp(editorEmp)) === h;
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => applyEditorPartHours(h)}
                                  className={`sheet-chip min-w-[3.25rem] h-10 text-[15px] ${active ? 'sheet-chip-on' : 'sheet-chip-off'}`}
                                >
                                  {h}h
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 min-w-[8rem]">
                          <span className="text-[13px] font-bold text-slate-700">IN</span>
                          <select
                            className="sheet-select h-11 text-[16px] tabular-nums"
                            value={snapToStep(editorShift.start_time || (editorShowsPaidLeaveHours ? editorPtoTemplate.start_time : '12:00'), TIME_STEP_MIN)}
                            onChange={(ev) => applyEditorTime('in', ev.target.value)}
                            disabled={busy}
                          >
                            {Array.from({ length: 48 }, (_, i) => {
                              const hm = `${pad2(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
                              return <option key={hm} value={hm}>{hm}</option>;
                            })}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 min-w-[8rem]">
                          <span className="text-[13px] font-bold text-slate-700">OUT</span>
                          <select
                            className="sheet-select h-11 text-[16px] tabular-nums"
                            value={snapToStep(editorShift.end_time || (editorShowsPaidLeaveHours ? editorPtoTemplate.end_time : editorOutAuto || '21:00'), TIME_STEP_MIN)}
                            onChange={(ev) => applyEditorTime('out', ev.target.value)}
                            disabled={busy}
                          >
                            {Array.from({ length: 48 }, (_, i) => {
                              const hm = `${pad2(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`;
                              return <option key={hm} value={hm}>{hm}</option>;
                            })}
                          </select>
                        </label>
                        {(editorShift.status || '') === 'work' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={applyEditorAutoOut}
                            className="sheet-chip h-11 px-3 sheet-chip-off"
                            title={isFullTimeEmp(editorEmp) ? 'INから+9時間' : `INから+${spanHoursForEmp(editorEmp)}時間`}
                          >
                            自動OUT
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="pt-1 border-t border-[#c5d4e0]">
                    <button
                      type="button"
                      disabled={busy || !canEdit}
                      onClick={() => shareCellToChat(shiftEditor.employee_id, shiftEditor.date)}
                      className="sheet-chip h-10 px-4 sheet-chip-off w-full"
                    >
                      チャットに共有
                    </button>
                    <p className="mt-1.5 text-[12px] text-slate-500">このセルの内容を店舗チャットに投稿します</p>
                  </div>
                  <div className="space-y-2 pt-1 border-t border-[#c5d4e0]">
                    <p className="text-[16px] font-bold text-slate-800">MEMO</p>
                    <textarea
                      value={String(editorMemo?.body || '')}
                      disabled={busy || !canEdit}
                      onChange={(ev) => patchMemoLocal(shiftEditor.employee_id, shiftEditor.date, ev.target.value)}
                      rows={MEMO_MAX_LINES}
                      placeholder={'TF報告会15時参加\n18時経堂IN\n19時MT外部'}
                      className="w-full min-h-[7rem] border border-[#9db4c8] bg-[#eef3f8] px-3 py-2 text-[15px] leading-relaxed outline-none resize-y"
                      style={{ borderRadius: 2 }}
                    />
                    <p className="text-[12px] text-slate-500">最大5行 · Enterで改行（表のMEMOと同じ）</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsPanel && (
            <div className="km-overlay z-[200]" onClick={() => !user?.needsJurisdiction && closeSettings()}>
              <div className="km-dialog max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
                <div className="km-dialog-head flex items-start justify-between gap-3 sticky top-0 z-10">
                  <div>
                    <p className="text-[13px] font-semibold text-white/85">
                      {settingsPanel === 'jurisdiction' && (user?.needsJurisdiction ? '初回登録' : SETTINGS_TITLES.jurisdiction.kicker)}
                      {settingsPanel === 'employees' && SETTINGS_TITLES.employees.kicker}
                      {settingsPanel === 'weekly' && SETTINGS_TITLES.weekly.kicker}
                    </p>
                    <p className="text-[1.15rem] font-extrabold text-white mt-0.5">
                      {settingsPanel === 'jurisdiction' && (user?.needsJurisdiction ? '担当店舗を選ぶ' : SETTINGS_TITLES.jurisdiction.title)}
                      {settingsPanel === 'employees' && SETTINGS_TITLES.employees.title}
                      {settingsPanel === 'weekly' && SETTINGS_TITLES.weekly.title}
                    </p>
                    <p className="text-[13px] text-white/80 mt-0.5">
                      {settingsPanel === 'jurisdiction' && (user?.needsJurisdiction
                        ? 'メール登録は完了済み。次に担当する店舗を選んでください'
                        : SETTINGS_TITLES.jurisdiction.sub)}
                      {settingsPanel === 'employees' && `${storeName} · ${SETTINGS_TITLES.employees.sub}`}
                      {settingsPanel === 'weekly' && SETTINGS_TITLES.weekly.sub}
                    </p>
                  </div>
                  {!user?.needsJurisdiction && (
                    <button type="button" onClick={closeSettings} className="text-[14px] font-bold text-white/90 px-3 py-1 rounded-lg hover:bg-white/15">閉じる</button>
                  )}
                </div>
                <div className="km-dialog-body space-y-4">

                  {settingsPanel === 'jurisdiction' && (
                    <>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className={labelCls}>
                          <span>表示名</span>
                          <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="日下 竜汰" />
                        </label>
                        <label className={labelCls}>
                          <span>社員番号<span className="text-rose-600 ml-0.5" aria-hidden="true">*</span></span>
                          <input
                            className={inputCls}
                            value={byeCode}
                            onChange={(e) => setByeCode(e.target.value)}
                            placeholder="304642"
                            inputMode="numeric"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>
                        {needsAreaFilter && (
                        <label className={labelCls}>
                          <span>エリア（絞り込み）</span>
                          <select className={inputCls} value={selectedArea} onChange={(e) => onAreaChange(e.target.value)}>
                            <option value="">すべて</option>
                            {catalogAreas.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </label>
                        )}
                        {usesTerritory && (
                        <label className={labelCls}>
                          <span>テリトリー（絞り込み）</span>
                          <select className={inputCls} value={selectedTerritory} onChange={(e) => onTerritoryChange(e.target.value)}>
                            <option value="">すべて</option>
                            {territoryOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </label>
                        )}
                      </div>
                      <p className="text-[15px] font-semibold text-slate-700">管轄店舗（タップして選択）</p>
                      {!catalogStores.length ? (
                        <p className="text-[13px] text-rose-600 font-semibold">店舗一覧を読み込めません。スプレッドシートの「店舗データ」または「アルバイト登録」を確認してください。</p>
                      ) : !areaStores.length ? (
                        <p className="text-[13px] text-slate-500">該当する店舗がありません。エリアを「すべて」に戻してください。</p>
                      ) : (
                      <div className="flex flex-wrap gap-2">
                        {areaStores.map((s) => {
                          const on = selectedStores.includes(s.store_id);
                          return (
                            <button key={s.store_id} type="button" onClick={() => toggleStore(s.store_id)} className={`px-4 py-2.5 rounded-xl text-[15px] font-bold border ${on ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white text-slate-700 border-slate-200'}`}>
                              {s.store_name}
                            </button>
                          );
                        })}
                      </div>
                      )}
                      <button type="button" disabled={busy || !selectedStores.length || !String(byeCode || '').trim()} onClick={saveJurisdiction} className={btnPrimary}>
                        {user?.needsJurisdiction ? '登録して進む' : '保存'}
                      </button>
                    </>
                  )}

                  {settingsPanel === 'employees' && (
                    <>
                      {empFormOpen ? (
                        <div className="app-section-card space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="app-section-title">
                              {empForm.employee_id ? `${String(empForm.name || 'このスタッフ').trim()} を編集` : 'スタッフを追加'}
                            </p>
                            <button type="button" onClick={closeEmpForm} className="text-[13px] font-bold text-slate-500 hover:text-slate-800">新規追加に切替</button>
                          </div>

                          <label className={labelCls}>
                            <span>氏名（フルネーム）<span className="text-rose-600 ml-0.5" aria-hidden="true">*</span></span>
                            <input className={inputCls} value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} placeholder="蜂谷 有加" autoFocus={!empForm.employee_id} />
                          </label>

                          <label className={labelCls}>
                            <span>社員コード<span className="text-rose-600 ml-0.5" aria-hidden="true">*</span></span>
                            <input className={`${inputCls} tabular-nums`} value={empForm.bye_code} onChange={(e) => setEmpForm({ ...empForm, bye_code: e.target.value.replace(/[^0-9]/g, '') })} placeholder="030400" inputMode="numeric" />
                            <span className="text-[12px] text-slate-400 font-medium">先頭の 0 も入力してください（例：030400）</span>
                          </label>

                          <div className={labelCls}>
                            <span>区分</span>
                            <div className="flex gap-2 pt-1">
                              {['社員', 'アルバイト'].map((t) => {
                                const on = normalizeEmpType(empForm.employment_type) === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setEmpForm({ ...empForm, employment_type: t, work_hours: carryOverHours(empForm, t) })}
                                    className={`flex-1 h-11 rounded-xl border text-[15px] font-bold ${on ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                  >
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className={labelCls}>
                            <span>1日の勤務時間（休憩込み）</span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {hourOptionsForEmp(empForm).map((h) => (
                                <button key={h} type="button" onClick={() => setEmpForm({ ...empForm, work_hours: h })} className={`h-11 min-w-[3.25rem] px-2 rounded-xl border text-[15px] font-bold ${Number(spanHoursForEmp(empForm)) === h ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>{h}h</button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap items-center pt-1">
                            <button
                              type="button"
                              disabled={busy || !String(empForm.name || '').trim() || !String(empForm.bye_code || '').trim()}
                              onClick={saveEmployee}
                              className={btnPrimary}
                            >
                              {empForm.employee_id ? '変更を保存' : 'スタッフを追加'}
                            </button>
                            <button type="button" onClick={closeEmpForm} className={btnSecondary}>キャンセル</button>
                          </div>

                          {empForm.employee_id && canEdit && (
                            <div className="pt-3 mt-1 border-t border-slate-200">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={requestUnregisterEmployee}
                                className="text-[13px] font-bold text-rose-600 hover:text-rose-700 underline decoration-rose-200"
                              >
                                登録を解除する
                              </button>
                              <p className={panelSubCls + ' mt-1'}>退職・異動などで使います。解除するとマスタから削除されます。</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <p className="app-section-title">登録済みスタッフ {employees.length}名</p>
                            {canEdit && (
                              <button type="button" onClick={openEmpFormForNew} className={btnPrimary}>新しいスタッフを追加</button>
                            )}
                          </div>
                          {!employees.length ? (
                            <p className={panelSubCls}>まだスタッフがいません。「新しいスタッフを追加」から登録してください。</p>
                          ) : (
                            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
                              {employees.map((e) => (
                                <li key={e.employee_id}>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => openEmpFormForEdit(e)}
                                    className="w-full py-3 px-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 disabled:hover:bg-white"
                                  >
                                    <span className="min-w-0">
                                      <span className="block font-bold text-[15px] text-slate-900 truncate">{e.name}</span>
                                      <span className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isFullTimeEmp(e) ? 'bg-[#3a4a5a] text-white' : 'bg-[#2f7ec4] text-white'}`}>
                                          {isFullTimeEmp(e) ? '社員' : 'アルバイト'}
                                        </span>
                                        <span className="text-[12px] font-medium text-slate-400 tabular-nums">{e.bye_code || '—'}</span>
                                        <span className="text-[12px] font-medium text-slate-400">{spanHoursForEmp(e)}h</span>
                                      </span>
                                    </span>
                                    {canEdit && <span className="shrink-0 text-[13px] font-bold text-[var(--acc-500)]">編集</span>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className={panelSubCls}>名前をタップすると編集できます。ここで追加したスタッフが一覧に並びます。</p>
                        </>
                      )}
                    </>
                  )}

                  {settingsPanel === 'weekly' && (
                    <>
                      {!employees.length ? (
                        <p className={panelSubCls}>先に従業員を登録してください</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {employees.map((e) => (
                              <button key={e.employee_id} type="button" onClick={() => { selectWeeklyEmp(e.employee_id); setWeeklySpanH(null); }} className={`px-4 py-2.5 rounded-xl text-[15px] font-bold border ${weeklyEmpId === e.employee_id ? 'bg-[var(--acc-500)] text-white border-[var(--acc-500)]' : 'bg-white border-slate-200 text-slate-800'}`}>{e.name}</button>
                            ))}
                          </div>
                          {weeklyEmpId && (
                            <>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-bold text-slate-500">基本の勤務</span>
                                  <select disabled={!canEdit} className={weeklySelCls} value={weeklyBulkStart} onChange={(e) => setWeeklyBulkStart(snapToStep(e.target.value, TIME_STEP_MIN))}>
                                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <span className="text-slate-400 font-bold">〜</span>
                                  <span className="text-[15px] font-bold tabular-nums text-slate-800">{addHoursToHm(weeklyBulkStart, weeklySpan)}</span>
                                  <select disabled={!canEdit} className={weeklySelCls} value={String(weeklySpan)} onChange={(e) => setWeeklySpanH(Number(e.target.value))} title="拘束時間（休憩込み）">
                                    {WEEKLY_SPAN_OPTIONS.map((h) => <option key={h} value={h}>{h}時間</option>)}
                                  </select>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <button type="button" disabled={!canEdit} onClick={() => applyWeeklyBulk('weekday')} className={weeklyBulkBtnCls}>平日を出勤</button>
                                  <button type="button" disabled={!canEdit} onClick={() => applyWeeklyBulk('all-off')} className={weeklyBulkBtnCls}>全部休みに戻す</button>
                                </div>
                              </div>
                              <div>
                                {WEEKDAY_TEMPLATE_ORDER.map((wd) => {
                                  const label = WEEKDAY_LABELS[wd];
                                  const cell = weeklyCell(weeklyEmpId, wd);
                                  const isWork = cell.status === 'work';
                                  const isOff = cell.status !== 'work' && cell.status !== 'undef';
                                  const dayStart = snapToStep(cell.start_time || weeklyBulkStart, TIME_STEP_MIN);
                                  const daySpan = (isWork && spanHoursBetweenHm(cell.start_time, cell.end_time)) || weeklySpan;
                                  const dayEnd = snapToStep(isWork && cell.end_time ? cell.end_time : addHoursToHm(dayStart, daySpan), TIME_STEP_MIN);
                                  const leaveVal = cell.leave_code ? String(parseLeaveCode(cell.leave_code)) : '';
                                  return (
                                    <div key={wd} className="grid grid-cols-[1.75rem_4.75rem_1fr] items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                                      <div className={`text-[16px] font-black ${weekdayTextClass(wd)}`}>{label}</div>
                                      <div className="flex gap-1">
                                        <button type="button" disabled={!canEdit} title="出勤" onClick={() => setWeeklyCell(weeklyEmpId, wd, weeklyWorkPatch(cell.start_time || weeklyBulkStart, daySpan))} className={`h-9 w-9 rounded-lg text-[14px] font-black border ${isWork ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'}`}>出</button>
                                        <button type="button" disabled={!canEdit} title="休み" onClick={() => setWeeklyLeave(weeklyEmpId, wd, leaveVal)} className={`h-9 w-9 rounded-lg text-[14px] font-black border ${isOff ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-200'}`}>休</button>
                                      </div>
                                      {isWork ? (
                                        <div className="flex items-center gap-1.5">
                                          <select disabled={!canEdit} className={weeklySelCls} value={dayStart} onChange={(e) => setWeeklyCell(weeklyEmpId, wd, weeklyWorkPatch(e.target.value, daySpan))}>
                                            {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                          </select>
                                          <span className="text-slate-400 font-bold">〜</span>
                                          <select disabled={!canEdit} className={weeklySelCls} value={dayEnd} onChange={(e) => setWeeklyCell(weeklyEmpId, wd, { status: 'work', start_time: dayStart, end_time: snapToStep(e.target.value, TIME_STEP_MIN), leave_code: '' })}>
                                            {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                          </select>
                                          <span className="text-[12px] font-bold text-slate-400 tabular-nums">{spanHoursBetweenHm(dayStart, dayEnd)}h</span>
                                        </div>
                                      ) : (
                                        <select disabled={!canEdit || !isOff} className={`${weeklySelCls} w-full max-w-[13rem] font-semibold`} value={leaveVal} onChange={(e) => setWeeklyLeave(weeklyEmpId, wd, e.target.value)}>
                                          <option value="">公休</option>
                                          {(leaveCodeGroups.used || []).map((c) => <option key={`u-${c.code}`} value={c.code}>{c.code} {c.name}</option>)}
                                          {(leaveCodeGroups.unused || []).map((c) => <option key={`n-${c.code}`} value={c.code}>{c.code} {c.name}</option>)}
                                        </select>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className={panelSubCls}>
                              {weeklyStatus === 'saving'
                                ? '保存中…'
                                : weeklyStatus === 'saved'
                                  ? '自動保存しました（そのまま閉じてOK）'
                                  : weeklyStatus === 'dirty'
                                    ? '未保存の変更があります…'
                                    : '「出」「休」で切替。変更は自動保存されます'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setSettingsPanel(null)} className="px-4 py-2.5 rounded-xl text-[15px] font-bold border border-slate-300 bg-white text-slate-700">閉じる</button>
                              <button type="button" disabled={!canEdit || busy} onClick={() => saveWeeklyAndApply('all')} className="px-4 py-2.5 rounded-xl text-[15px] font-bold border border-slate-300 bg-white text-slate-700 disabled:opacity-40">全員を反映</button>
                              <button type="button" disabled={!canEdit || busy || !weeklyEmpId} onClick={() => saveWeeklyAndApply('employee')} className="px-4 py-2.5 rounded-xl text-[15px] font-bold bg-[var(--acc-500)] text-white disabled:opacity-40">このスタッフを反映</button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>

      {kintaiToast && (
        <div
          className={`fixed bottom-5 left-1/2 z-[300] -translate-x-1/2 max-w-[min(92vw,28rem)] px-5 py-3 text-center text-[13px] font-semibold shadow-lg border whitespace-pre-line ${
            kintaiToast.kind === 'ok'
              ? 'bg-white text-zinc-800 border-zinc-300'
              : 'bg-zinc-900 text-white border-zinc-900'
          }`}
          style={{ borderRadius: 8 }}
          role="status"
        >
          {kintaiToast.text}
        </div>
      )}

      {storeId && (
        <>
          <StoreChatFab
            open={chat.open}
            unread={chat.unread}
            onToggle={() => chat.setOpen((v) => !v)}
          />
          <StoreChatPanel
            open={chat.open}
            storeId={storeId}
            storeName={storeName}
            user={user}
            messages={chat.messages}
            loading={chat.loading}
            sending={chat.sending}
            draft={chat.draft}
            onDraft={chat.setDraft}
            onSend={() => chat.send().catch((e) => notify(e.message || String(e), 'err'))}
            onClose={() => chat.setOpen(false)}
            onOpenLink={openChatCellLink}
            onDelete={(id) => chat.remove(id).catch((e) => notify(e.message || String(e), 'err'))}
          />
        </>
      )}

      <ConfirmDialog box={confirmBox} onCancel={() => setConfirmBox(null)} />
    </div>
  );
}

