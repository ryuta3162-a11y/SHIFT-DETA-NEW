/**
 * ============================================================
 * 新 シフト『キンタイ・カレンダー』管理 — Webアプリ骨格
 * ============================================================
 *
 * 同じ Apps Script プロジェクトに次を置く:
 *   - SetupSheets.gs（初期セットアップ・既存）
 *   - Code.gs（このファイル）
 *   - index.html（画面）
 *
 * 認証: ToDo List と同じく「会社メールでログイン」
 *   （Session のメールが空でも動く。権限シートで制御）
 *
 * デプロイ推奨:
 *   - 実行ユーザー: 自分（スプシを一般に共有しなくてよい）
 *   - アクセスできるユーザー: 組織内の全員
 */

var SHIFT_APP = {
  SHEETS: {
    STORES: '店舗マスタ',
    EMPLOYEES: '従業員マスタ',
    SHIFTS: 'シフト',
    MEMOS: 'シフトメモ',
    ACL: '権限',
    SETTINGS: '設定',
    LOG: '同期ログ'
  },
  STATUS: ['work', 'off', 'pto', 'absent', 'undef'],
  ROLES: { VIEWER: 'viewer', EDITOR: 'editor', ADMIN: 'admin' }
};

/* ============================================================
 * Web 入口
 * ============================================================ */
function doGet() {
  var boot =
    '<script>window.__SHIFT_EXEC_BASE__=' +
    JSON.stringify(ScriptApp.getService().getUrl()) +
    ';</script>';
  var html = HtmlService.createHtmlOutputFromFile('index').getContent();
  if (html.indexOf('<head>') !== -1) {
    html = html.replace('<head>', '<head>' + boot);
  } else {
    html = boot + html;
  }
  return HtmlService.createHtmlOutput(html)
    .setTitle(getSetting_('app_title', 'シフト・キンタイ・カレンダー'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================================================
 * クライアント API
 * ============================================================ */

/** 画面初期情報（ログイン不要） */
function getBootstrap() {
  return {
    ok: true,
    appTitle: getSetting_('app_title', 'シフト・キンタイ・カレンダー'),
    companyDomain: getSetting_('company_domain', 'okamoto-group.co.jp'),
    sessionEmail: peekSessionEmail_(),
    serverYearMonth: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM'),
    statuses: SHIFT_APP.STATUS.slice()
  };
}

/**
 * ToDo List と同じ方式: 会社メールでログイン
 * @param {string} email
 */
function loginWithEmail(email) {
  var normalized = normalizeEmail_(email);
  assertCompanyDomain_(normalized);

  var sessionEmail = peekSessionEmail_();
  if (sessionEmail && sessionEmail !== normalized) {
    throw new Error(
      'Googleログイン中のアカウント（' + sessionEmail + '）と入力メールが一致しません。'
    );
  }

  var acl = resolveAcl_(normalized);
  var stores = listStoresForUser_(acl);
  var profile = findEmployeeByEmail_(normalized);
  return {
    ok: true,
    email: normalized,
    name: profile ? profile.name : normalized.split('@')[0],
    roleMax: acl.roleMax,
    isAdmin: acl.isAdmin,
    stores: stores,
    appTitle: getSetting_('app_title', 'シフト・キンタイ・カレンダー'),
    statuses: SHIFT_APP.STATUS.slice()
  };
}

/**
 * @param {string} storeId
 * @param {string} yearMonth yyyy-MM
 * @param {string} userEmail ログイン中メール
 */
function getShifts(storeId, yearMonth, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);

  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');

  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var sid = String(r[map.store_id] || '').trim();
    if (sid !== storeId) continue;
    var date = normalizeDate_(r[map.date]);
    if (!date || date.substring(0, 7) !== ym) continue;
    out.push({
      shift_id: String(r[map.shift_id] || ''),
      date: date,
      employee_id: String(r[map.employee_id] || ''),
      store_id: sid,
      status: String(r[map.status] || ''),
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time]),
      break_minutes: r[map.break_minutes] === '' || r[map.break_minutes] == null ? '' : Number(r[map.break_minutes]),
      source: map.source != null ? String(r[map.source] || '') : '',
      updated_at: map.updated_at != null ? String(r[map.updated_at] || '') : '',
      updated_by: map.updated_by != null ? String(r[map.updated_by] || '') : ''
    });
  }
  out.sort(function (a, b) {
    if (a.date === b.date) return String(a.employee_id).localeCompare(String(b.employee_id));
    return String(a.date).localeCompare(String(b.date));
  });

  return {
    ok: true,
    storeId: storeId,
    yearMonth: ym,
    canEdit: canEditStore_(acl, storeId),
    employees: listEmployeesForStore_(storeId),
    shifts: out
  };
}

/**
 * payload: { user_email, shift_id?, date, employee_id, store_id, status, start_time?, end_time?, break_minutes? }
 */
function upsertShift(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);

  var date = normalizeDate_(p.date);
  var employeeId = String(p.employee_id || '').trim();
  var status = String(p.status || '').trim();
  if (!date) throw new Error('date が必要です。');
  if (!employeeId) throw new Error('employee_id が必要です。');
  if (SHIFT_APP.STATUS.indexOf(status) < 0) throw new Error('status が不正です。');

  var start = String(p.start_time || '').trim();
  var end = String(p.end_time || '').trim();
  if (status === 'work') {
    if (!isHm_(start) || !isHm_(end)) throw new Error('勤務のときは開始・終了時刻（HH:mm）が必要です。');
  } else {
    start = '';
    end = '';
  }

  var breakMin = p.break_minutes === '' || p.break_minutes == null ? '' : Number(p.break_minutes);
  if (breakMin !== '' && (isNaN(breakMin) || breakMin < 0)) throw new Error('break_minutes が不正です。');

  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, [
    'shift_id', 'date', 'employee_id', 'store_id', 'status',
    'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'
  ]);

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var shiftId = String(p.shift_id || '').trim();
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;

  if (shiftId) {
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][map.shift_id] || '') === shiftId) {
        rowIndex = r + 1;
        break;
      }
    }
    if (rowIndex < 0) throw new Error('指定の shift_id が見つかりません。');
  } else {
    for (var r2 = 1; r2 < data.length; r2++) {
      var d = normalizeDate_(data[r2][map.date]);
      if (
        d === date &&
        String(data[r2][map.employee_id] || '') === employeeId &&
        String(data[r2][map.store_id] || '') === storeId
      ) {
        rowIndex = r2 + 1;
        shiftId = String(data[r2][map.shift_id] || '');
        break;
      }
    }
    if (!shiftId) {
      shiftId = 'SH' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + employeeId;
    }
  }

  var colCount = headers.length;
  var rowVals = [];
  var c;
  if (rowIndex > 0) {
    rowVals = sh.getRange(rowIndex, 1, 1, colCount).getValues()[0];
  } else {
    for (c = 0; c < colCount; c++) rowVals.push('');
  }

  rowVals[map.shift_id] = shiftId;
  rowVals[map.date] = date;
  rowVals[map.employee_id] = employeeId;
  rowVals[map.store_id] = storeId;
  rowVals[map.status] = status;
  rowVals[map.start_time] = start;
  rowVals[map.end_time] = end;
  rowVals[map.break_minutes] = breakMin === '' ? '' : breakMin;
  rowVals[map.source] = 'web';
  rowVals[map.updated_at] = now;
  rowVals[map.updated_by] = email;

  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, colCount).setValues([rowVals]);
  } else {
    sh.appendRow(rowVals);
  }

  return {
    ok: true,
    shift: {
      shift_id: shiftId,
      date: date,
      employee_id: employeeId,
      store_id: storeId,
      status: status,
      start_time: start,
      end_time: end,
      break_minutes: breakMin === '' ? '' : breakMin,
      source: 'web',
      updated_at: now,
      updated_by: email
    }
  };
}

function deleteShift(shiftId, storeId, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, String(storeId || ''), true);

  var id = String(shiftId || '').trim();
  if (!id) throw new Error('shift_id が必要です。');

  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var map = headerIndexMap_(getHeaders_(sh));
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][map.shift_id] || '') !== id) continue;
    if (String(data[r][map.store_id] || '') !== String(storeId)) {
      throw new Error('店舗が一致しないため削除できません。');
    }
    sh.deleteRow(r + 1);
    return { ok: true, deleted: id };
  }
  throw new Error('シフトが見つかりません。');
}

/* ============================================================
 * 認証（ToDo List 方式）
 * ============================================================ */
function peekSessionEmail_() {
  var active = '';
  var effective = '';
  try {
    active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {}
  try {
    effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e2) {}
  return active || effective || '';
}

function normalizeEmail_(email) {
  var s = String(email || '').trim().toLowerCase();
  if (!s || s.indexOf('@') < 0) throw new Error('メールアドレスを正しく入力してください。');
  return s;
}

function assertCompanyDomain_(email) {
  var domain = String(getSetting_('company_domain', 'okamoto-group.co.jp') || '').toLowerCase();
  if (!domain) return;
  var at = email.indexOf('@');
  var userDomain = at >= 0 ? email.substring(at + 1) : '';
  if (userDomain !== domain) {
    throw new Error('このアプリは @' + domain + ' のメールのみ利用できます。');
  }
}

/** クライアントから渡されたメールを検証して返す */
function resolveClientEmail_(clientEmail) {
  var email = normalizeEmail_(clientEmail);
  assertCompanyDomain_(email);

  var sessionEmail = peekSessionEmail_();
  if (sessionEmail && sessionEmail !== email) {
    throw new Error('Googleアカウントとログインメールが一致しません。');
  }

  // 権限シートにいること（なければここで弾く）
  resolveAcl_(email);
  return email;
}

function resolveAcl_(email) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.ACL);
  var values = getDataRows_(sh);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['email', 'store_id', 'role', 'is_active']);

  var stores = {};
  var isAdmin = false;
  var roleMax = '';

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[map.email] || '').trim().toLowerCase() !== email) continue;
    if (!isTruthy_(row[map.is_active])) continue;
    var role = String(row[map.role] || '').trim().toLowerCase();
    var sid = String(row[map.store_id] || '').trim();
    if (role === SHIFT_APP.ROLES.ADMIN || sid === '*') {
      isAdmin = true;
      roleMax = SHIFT_APP.ROLES.ADMIN;
    }
    if (sid && sid !== '*') {
      stores[sid] = betterRole_(stores[sid], role);
    }
    roleMax = betterRole_(roleMax, role);
  }

  if (!isAdmin && Object.keys(stores).length === 0) {
    throw new Error('権限がありません。DXチームに「権限」シートへの登録を依頼してください。(' + email + ')');
  }

  return { email: email, isAdmin: isAdmin, stores: stores, roleMax: roleMax || SHIFT_APP.ROLES.VIEWER };
}

function betterRole_(a, b) {
  var rank = { '': 0, viewer: 1, editor: 2, admin: 3 };
  var x = String(a || '').toLowerCase();
  var y = String(b || '').toLowerCase();
  return (rank[y] || 0) >= (rank[x] || 0) ? y : x;
}

function assertStoreAccess_(acl, storeId, needEdit) {
  storeId = String(storeId || '').trim();
  if (!storeId) throw new Error('store_id が必要です。');
  if (acl.isAdmin) return;
  var role = acl.stores[storeId];
  if (!role) throw new Error('この店舗を見る権限がありません。');
  if (needEdit && role !== SHIFT_APP.ROLES.EDITOR && role !== SHIFT_APP.ROLES.ADMIN) {
    throw new Error('この店舗を編集する権限がありません。');
  }
}

function canEditStore_(acl, storeId) {
  if (acl.isAdmin) return true;
  var role = acl.stores[storeId];
  return role === SHIFT_APP.ROLES.EDITOR || role === SHIFT_APP.ROLES.ADMIN;
}

function listStoresForUser_(acl) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.STORES);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['store_id', 'store_name', 'is_active', 'sort_order']);
  var values = getDataRows_(sh);
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isTruthy_(row[map.is_active])) continue;
    var id = String(row[map.store_id] || '').trim();
    if (!id) continue;
    if (!acl.isAdmin && !acl.stores[id]) continue;
    list.push({
      store_id: id,
      store_name: String(row[map.store_name] || ''),
      area: map.area != null ? String(row[map.area] || '') : '',
      sort_order: Number(row[map.sort_order] || 0),
      role: acl.isAdmin ? SHIFT_APP.ROLES.ADMIN : acl.stores[id]
    });
  }
  list.sort(function (a, b) {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.store_name.localeCompare(b.store_name, 'ja');
  });
  return list;
}

function listEmployeesForStore_(storeId) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['employee_id', 'name', 'primary_store_id', 'is_active']);
  var values = getDataRows_(sh);
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isTruthy_(row[map.is_active])) continue;
    var id = String(row[map.employee_id] || '').trim();
    if (!id) continue;
    list.push({
      employee_id: id,
      name: String(row[map.name] || ''),
      primary_store_id: String(row[map.primary_store_id] || ''),
      is_primary: String(row[map.primary_store_id] || '') === storeId
    });
  }
  list.sort(function (a, b) {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.name.localeCompare(b.name, 'ja');
  });
  return list;
}

function findEmployeeByEmail_(email) {
  try {
    var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.email == null || map.name == null) return null;
    var values = getDataRows_(sh);
    var target = String(email || '').trim().toLowerCase();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][map.email] || '').trim().toLowerCase() !== target) continue;
      return {
        employee_id: map.employee_id != null ? String(values[i][map.employee_id] || '') : '',
        name: String(values[i][map.name] || '')
      };
    }
  } catch (e) {}
  return null;
}

/* ============================================================
 * シートユーティリティ
 * ============================================================ */
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function mustSheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」が見つかりません。セットアップを実行してください。');
  return sh;
}

function getHeaders_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });
}

function headerIndexMap_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) map[headers[i]] = i;
  }
  return map;
}

function requireHeaders_(map, names) {
  for (var i = 0; i < names.length; i++) {
    if (map[names[i]] == null) throw new Error('ヘッダ列が不足しています: ' + names[i]);
  }
}

function getDataRows_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  return sh.getRange(2, 1, lastRow, lastCol).getValues();
}

function getSetting_(key, fallback) {
  try {
    var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.SETTINGS);
    if (!sh) return fallback;
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.key == null || map.value == null) return fallback;
    var rows = getDataRows_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][map.key] || '').trim() === key) {
        return String(rows[i][map.value] != null ? rows[i][map.value] : fallback);
      }
    }
  } catch (e) {}
  return fallback;
}

function isTruthy_(v) {
  if (v === true || v === 1) return true;
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'Y';
}

function normalizeDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  }
  return s.length >= 10 ? s.substring(0, 10) : s;
}

function formatHm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'HH:mm');
  }
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return pad2_(m[1]) + ':' + m[2];
  return s;
}

function isHm_(s) {
  return /^\d{1,2}:\d{2}$/.test(String(s || ''));
}

function pad2_(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}
