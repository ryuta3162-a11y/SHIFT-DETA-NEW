/**
 * ============================================================
 * 新 シフト『キンタイ・カレンダー』管理 — Webアプリ
 * ============================================================
 *
 * 導線:
 *   ログイン → 管轄店舗登録 → 従業員登録 → 週間固定 → 月間シフト作成
 *
 * デプロイ推奨:
 *   - 実行ユーザー: 自分
 *   - アクセス: 組織内の全員
 */

var SHIFT_APP = {
  SHEETS: {
    STORES: '店舗マスタ',
    EMPLOYEES: '従業員マスタ',
    SHIFTS: 'シフト',
    MEMOS: 'シフトメモ',
    WEEKLY: '週間固定',
    ACL: '権限',
    SETTINGS: '設定',
    LOG: '同期ログ'
  },
  STATUS: ['work', 'off', 'pto', 'absent', 'undef'],
  ROLES: { VIEWER: 'viewer', EDITOR: 'editor', ADMIN: 'admin' },
  WEEKDAY_LABELS: ['日', '月', '火', '水', '木', '金', '土']
};

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
 * 初期・ログイン
 * ============================================================ */
function getBootstrap() {
  return {
    ok: true,
    appTitle: getSetting_('app_title', 'シフト・キンタイ・カレンダー'),
    companyDomain: getSetting_('company_domain', 'okamoto-group.co.jp'),
    sessionEmail: peekSessionEmail_(),
    serverYearMonth: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM'),
    statuses: SHIFT_APP.STATUS.slice(),
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice()
  };
}

function loginWithEmail(email) {
  var normalized = normalizeEmail_(email);
  assertCompanyDomain_(normalized);

  var sessionEmail = peekSessionEmail_();
  if (sessionEmail && sessionEmail !== normalized) {
    throw new Error('Googleログイン中のアカウント（' + sessionEmail + '）と入力メールが一致しません。');
  }

  var acl = resolveAcl_(normalized, { allowEmpty: true });
  var stores = listStoresForUser_(acl);
  var profile = findEmployeeByEmail_(normalized);
  var allStores = listAllStores_();
  return {
    ok: true,
    email: normalized,
    name: profile ? profile.name : normalized.split('@')[0],
    roleMax: acl.roleMax || '',
    isAdmin: acl.isAdmin,
    needsJurisdiction: !acl.isAdmin && stores.length === 0,
    stores: stores,
    allStores: allStores,
    areas: uniqueAreas_(allStores),
    appTitle: getSetting_('app_title', 'シフト・キンタイ・カレンダー'),
    statuses: SHIFT_APP.STATUS.slice(),
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice()
  };
}

/**
 * 管轄店舗を登録（初回／変更）
 * payload: { user_email, display_name, store_ids: string[], role? }
 */
function saveJurisdiction(payload) {
  var p = payload || {};
  var email = softResolveEmail_(p.user_email);
  var storeIds = Array.isArray(p.store_ids) ? p.store_ids : [];
  if (!storeIds.length) throw new Error('管轄店舗を1つ以上選んでください。');

  var all = listAllStores_();
  var valid = {};
  all.forEach(function (s) { valid[s.store_id] = true; });
  storeIds.forEach(function (id) {
    if (!valid[String(id)]) throw new Error('不正な店舗です: ' + id);
  });

  var role = String(p.role || SHIFT_APP.ROLES.EDITOR).toLowerCase();
  if ([SHIFT_APP.ROLES.VIEWER, SHIFT_APP.ROLES.EDITOR, SHIFT_APP.ROLES.ADMIN].indexOf(role) < 0) {
    role = SHIFT_APP.ROLES.EDITOR;
  }

  var sh = mustSheet_(SHIFT_APP.SHEETS.ACL);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['email', 'store_id', 'role', 'is_active']);
  var data = sh.getDataRange().getValues();

  // 既存の個人権限行を無効化（admin * は残す）
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][map.email] || '').trim().toLowerCase() !== email) continue;
    var sid = String(data[r][map.store_id] || '').trim();
    if (sid === '*') continue;
    sh.getRange(r + 1, map.is_active + 1).setValue(false);
  }

  storeIds.forEach(function (id) {
    var row = new Array(headers.length).fill('');
    row[map.email] = email;
    row[map.store_id] = String(id);
    row[map.role] = role;
    row[map.is_active] = true;
    sh.appendRow(row);
  });

  var displayName = String(p.display_name || '').trim();
  if (displayName) upsertSelfProfileName_(email, displayName);

  return loginWithEmail(email);
}

/* ============================================================
 * 従業員
 * ============================================================ */
function listEmployees(storeId, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);
  return {
    ok: true,
    storeId: storeId,
    canEdit: canEditStore_(acl, storeId),
    employees: listEmployeesDetailed_(storeId)
  };
}

/**
 * payload: { user_email, store_id, employee_id?, name, bye_code, employment_type?, work_hours? }
 */
function upsertEmployee(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);

  var name = String(p.name || '').trim();
  var byeCode = String(p.bye_code || '').trim();
  if (!name) throw new Error('正式なフルネームを入力してください。');
  if (!byeCode) throw new Error('社員コードを入力してください。');

  var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
  var map = ensureHeaderColumn_(sh, 'work_hours');
  requireHeaders_(map, ['employee_id', 'name', 'bye_code', 'primary_store_id', 'is_active']);
  var headers = getHeaders_(sh);
  // ensure 後に列が増えている場合があるので map を再取得
  map = headerIndexMap_(headers);

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var employeeId = String(p.employee_id || '').trim();
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;

  if (employeeId) {
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][map.employee_id] || '') === employeeId) {
        rowIndex = r + 1;
        break;
      }
    }
    if (rowIndex < 0) throw new Error('従業員が見つかりません。');
  } else {
    // 同店舗・同社員コードがあれば更新
    for (var r2 = 1; r2 < data.length; r2++) {
      if (String(data[r2][map.bye_code] || '') === byeCode &&
          String(data[r2][map.primary_store_id] || '') === storeId) {
        rowIndex = r2 + 1;
        employeeId = String(data[r2][map.employee_id] || '');
        break;
      }
    }
    if (!employeeId) {
      employeeId = 'E' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    }
  }

  var colCount = headers.length;
  var rowVals = rowIndex > 0
    ? sh.getRange(rowIndex, 1, 1, colCount).getValues()[0]
    : new Array(colCount).fill('');

  var empTypeIn = String(p.employment_type || rowVals[map.employment_type] || '社員').trim();
  // UIは「アルバイト」、スプシ入力規則は 社員 / パート / その他
  var isPart = (empTypeIn === 'アルバイト' || empTypeIn === 'パート');
  var sheetEmpType = isPart ? 'パート' : (empTypeIn === 'その他' ? 'その他' : '社員');

  var workHours = '';
  if (isPart) {
    var wh = Number(p.work_hours);
    if (!isNaN(wh) && wh > 0) workHours = wh;
    else if (map.work_hours != null && rowVals[map.work_hours] !== '' && rowVals[map.work_hours] != null) {
      workHours = Number(rowVals[map.work_hours]) || 4;
    } else {
      workHours = 4;
    }
  }

  rowVals[map.employee_id] = employeeId;
  rowVals[map.name] = name;
  if (map.name_key != null) rowVals[map.name_key] = name.replace(/[\s　]/g, '');
  rowVals[map.bye_code] = byeCode;
  rowVals[map.primary_store_id] = storeId;
  if (map.employment_type != null) {
    rowVals[map.employment_type] = sheetEmpType;
  }
  if (map.work_hours != null) {
    rowVals[map.work_hours] = workHours === '' ? '' : workHours;
  }
  rowVals[map.is_active] = true;
  if (map.calendar_sync != null && rowVals[map.calendar_sync] === '') rowVals[map.calendar_sync] = true;
  if (map.memo_offset != null && rowVals[map.memo_offset] === '') rowVals[map.memo_offset] = 1;
  if (map.note != null && p.note != null) rowVals[map.note] = String(p.note || '');

  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, colCount).setValues([rowVals]);
  else sh.appendRow(rowVals);

  return { ok: true, employee: listEmployeesDetailed_(storeId).filter(function (e) { return e.employee_id === employeeId; })[0] };
}

function deactivateEmployee(employeeId, storeId, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  var id = String(employeeId || '').trim();
  if (!id) throw new Error('employee_id が必要です。');

  var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
  var map = headerIndexMap_(getHeaders_(sh));
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][map.employee_id] || '') !== id) continue;
    if (String(data[r][map.primary_store_id] || '') !== String(storeId)) {
      throw new Error('店舗が一致しません。');
    }
    sh.getRange(r + 1, map.is_active + 1).setValue(false);
    return { ok: true, deactivated: id };
  }
  throw new Error('従業員が見つかりません。');
}

/* ============================================================
 * 週間固定
 * ============================================================ */
function getWeeklySchedule(storeId, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);
  ensureWeeklySheet_();

  var sh = mustSheet_(SHIFT_APP.SHEETS.WEEKLY);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['weekly_id', 'employee_id', 'store_id', 'weekday', 'status']);
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (map.is_active != null && !isTruthy_(r[map.is_active])) continue;
    out.push({
      weekly_id: String(r[map.weekly_id] || ''),
      employee_id: String(r[map.employee_id] || ''),
      store_id: storeId,
      weekday: Number(r[map.weekday]),
      status: String(r[map.status] || 'undef'),
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time]),
      break_minutes: r[map.break_minutes] === '' || r[map.break_minutes] == null ? '' : Number(r[map.break_minutes])
    });
  }
  return {
    ok: true,
    storeId: storeId,
    canEdit: canEditStore_(acl, storeId),
    employees: listEmployeesDetailed_(storeId),
    weekly: out,
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice()
  };
}

/**
 * payload: { user_email, store_id, items: [{employee_id, weekday, status, start_time, end_time, break_minutes}] }
 * 指定店舗の週間固定を全置換（アクティブ行）
 */
function saveWeeklySchedule(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  ensureWeeklySheet_();

  var items = Array.isArray(p.items) ? p.items : [];
  var sh = mustSheet_(SHIFT_APP.SHEETS.WEEKLY);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['weekly_id', 'employee_id', 'store_id', 'weekday', 'status', 'is_active']);

  var data = sh.getDataRange().getValues();
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][map.store_id] || '') !== storeId) continue;
    sh.getRange(r + 1, map.is_active + 1).setValue(false);
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  items.forEach(function (it, idx) {
    var empId = String(it.employee_id || '').trim();
    var wd = Number(it.weekday);
    var status = String(it.status || 'undef');
    if (!empId) return;
    if (isNaN(wd) || wd < 0 || wd > 6) return;
    if (SHIFT_APP.STATUS.indexOf(status) < 0) status = 'undef';

    var start = String(it.start_time || '').trim();
    var end = String(it.end_time || '').trim();
    if (status === 'work') {
      if (!isHm_(start) || !isHm_(end)) throw new Error('勤務の曜日は開始・終了時刻が必要です（' + empId + ' / 曜' + wd + '）');
    } else {
      start = '';
      end = '';
    }

    var row = new Array(headers.length).fill('');
    row[map.weekly_id] = 'W' + storeId + '-' + empId + '-D' + wd + '-' + idx;
    row[map.employee_id] = empId;
    row[map.store_id] = storeId;
    row[map.weekday] = wd;
    row[map.status] = status;
    row[map.start_time] = start;
    row[map.end_time] = end;
    if (map.break_minutes != null) {
      row[map.break_minutes] = it.break_minutes === '' || it.break_minutes == null ? '' : Number(it.break_minutes);
    }
    row[map.is_active] = true;
    if (map.updated_at != null) row[map.updated_at] = now;
    if (map.updated_by != null) row[map.updated_by] = email;
    sh.appendRow(row);
  });

  return getWeeklySchedule(storeId, email);
}

/* ============================================================
 * 月間シフト
 * ============================================================ */

/**
 * 月間取得。編集権限がある場合は週間テンプレを自動で空き日に展開してから返す。
 * （「週間どおりに作成」ボタン不要）
 */
function getShifts(storeId, yearMonth, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);

  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');

  var applied = null;
  if (canEditStore_(acl, storeId)) {
    applied = applyWeeklyToMonth_(storeId, ym, email, false, { strict: false });
  }

  var result = readShifts_(storeId, ym, email, acl);
  result.appliedFromWeekly = applied;
  return result;
}

function readShifts_(storeId, ym, email, acl) {
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
    employees: listEmployeesDetailed_(storeId),
    shifts: out,
    memos: listMemos_(storeId, ym)
  };
}

/**
 * 月間のシフトメモ（従業員×日）
 * 旧シフト表の「名前の下のメモ行」に相当。kind=note / body を主に使う。
 */
function listMemos_(storeId, ym) {
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.MEMOS);
  if (!sh) return [];
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.memo_id == null || map.date == null || map.employee_id == null) return [];
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var sid = map.store_id != null ? String(r[map.store_id] || '').trim() : '';
    if (sid && sid !== storeId) continue;
    var date = normalizeDate_(r[map.date]);
    if (!date || date.substring(0, 7) !== ym) continue;
    var eid = String(r[map.employee_id] || '').trim();
    if (!eid) continue;
    out.push({
      memo_id: String(r[map.memo_id] || ''),
      date: date,
      employee_id: eid,
      store_id: sid || storeId,
      kind: map.kind != null ? String(r[map.kind] || 'note') : 'note',
      title: map.title != null ? String(r[map.title] || '') : '',
      start_time: map.start_time != null ? formatHm_(r[map.start_time]) : '',
      end_time: map.end_time != null ? formatHm_(r[map.end_time]) : '',
      body: map.body != null ? String(r[map.body] || '') : '',
      updated_at: map.updated_at != null ? String(r[map.updated_at] || '') : '',
      updated_by: map.updated_by != null ? String(r[map.updated_by] || '') : ''
    });
  }
  out.sort(function (a, b) {
    if (a.date === b.date) return String(a.employee_id).localeCompare(String(b.employee_id));
    return String(a.date).localeCompare(String(b.date));
  });
  return out;
}

/**
 * メモ一括保存
 * payload: { user_email, store_id, items: [{memo_id?, date, employee_id, body, kind?, title?}] }
 * body が空の既存行は削除する。
 */
function upsertMemosBatch(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return { ok: true, saved: 0, deleted: 0, memos: listMemos_(storeId, '') };

  var sh = mustSheet_(SHIFT_APP.SHEETS.MEMOS);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['memo_id', 'date', 'employee_id', 'store_id', 'kind', 'body', 'updated_at', 'updated_by']);

  var data = sh.getDataRange().getValues();
  var byId = {};
  var byKey = {};
  for (var r = 1; r < data.length; r++) {
    var sid = String(data[r][map.store_id] || '').trim();
    if (sid && sid !== storeId) continue;
    var id = String(data[r][map.memo_id] || '');
    var d0 = normalizeDate_(data[r][map.date]);
    var eid = String(data[r][map.employee_id] || '');
    if (id) byId[id] = { row: r + 1, dataIndex: r };
    byKey[eid + '__' + d0] = { row: r + 1, dataIndex: r, memo_id: id };
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var toUpdate = [];
  var toAppend = [];
  var toDeleteRows = [];
  var ym = '';

  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var date = normalizeDate_(it.date);
    var employeeId = String(it.employee_id || '').trim();
    if (!date || !employeeId) continue;
    if (!ym) ym = date.substring(0, 7);
    var body = String(it.body != null ? it.body : '').trim();
    var kind = String(it.kind || 'note').trim() || 'note';
    var title = String(it.title || '').trim();
    var memoId = String(it.memo_id || '').trim();
    var hit = memoId && byId[memoId] ? byId[memoId] : byKey[employeeId + '__' + date];

    if (!body) {
      if (hit) toDeleteRows.push(hit.row);
      continue;
    }

    if (hit) {
      var full = data[hit.dataIndex].slice();
      if (!memoId) memoId = String(full[map.memo_id] || '') || ('MM' + stamp + '-' + employeeId + '-' + i);
      full[map.memo_id] = memoId;
      full[map.date] = date;
      full[map.employee_id] = employeeId;
      full[map.store_id] = storeId;
      full[map.kind] = kind;
      if (map.title != null) full[map.title] = title;
      full[map.body] = body;
      if (map.updated_at != null) full[map.updated_at] = now;
      if (map.updated_by != null) full[map.updated_by] = email;
      toUpdate.push({ row: hit.row, values: full });
    } else {
      var row = new Array(headers.length).fill('');
      row[map.memo_id] = 'MM' + stamp + '-' + employeeId + '-' + i;
      row[map.date] = date;
      row[map.employee_id] = employeeId;
      row[map.store_id] = storeId;
      row[map.kind] = kind;
      if (map.title != null) row[map.title] = title;
      row[map.body] = body;
      if (map.updated_at != null) row[map.updated_at] = now;
      if (map.updated_by != null) row[map.updated_by] = email;
      toAppend.push(row);
    }
  }

  if (toUpdate.length) {
    toUpdate.sort(function (a, b) { return a.row - b.row; });
    var ui = 0;
    while (ui < toUpdate.length) {
      var startU = ui;
      while (ui + 1 < toUpdate.length && toUpdate[ui + 1].row === toUpdate[ui].row + 1) ui++;
      var block = toUpdate.slice(startU, ui + 1);
      sh.getRange(block[0].row, 1, block[block.length - 1].row, headers.length)
        .setValues(block.map(function (b) { return b.values; }));
      ui++;
    }
  }
  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, startRow + toAppend.length - 1, headers.length).setValues(toAppend);
  }
  // 下から削除して行番号ずれを防ぐ
  toDeleteRows.sort(function (a, b) { return b - a; });
  var deleted = 0;
  var seenDel = {};
  for (var d = 0; d < toDeleteRows.length; d++) {
    var dr = toDeleteRows[d];
    if (seenDel[dr]) continue;
    seenDel[dr] = true;
    sh.deleteRow(dr);
    deleted++;
  }

  var result = {
    ok: true,
    saved: toUpdate.length + toAppend.length,
    deleted: deleted,
    memos: ym ? listMemos_(storeId, ym) : []
  };
  return result;
}

/**
 * 週間固定から月間へ展開（明示呼び出し用・上書き可）
 * payload: { user_email, store_id, year_month, overwrite? }
 */
function generateMonthlyShifts(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var ym = String(p.year_month || '').trim();
  var overwrite = !!p.overwrite;
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式です。');

  var applied = applyWeeklyToMonth_(storeId, ym, email, overwrite, { strict: true });
  var result = readShifts_(storeId, ym, email, acl);
  result.generated = applied;
  result.appliedFromWeekly = applied;
  return result;
}

/**
 * 週間テンプレを月間シフトへ反映（高速版）
 * - 既に全日埋まっていれば書き込みスキップ
 * - 更新は行単位・連続行をまとめて setValues
 * - 新規は一括 append
 */
function applyWeeklyToMonth_(storeId, ym, email, overwrite, opts) {
  opts = opts || {};
  var weekly = readWeeklyForStore_(storeId);
  if (!weekly.length) {
    if (opts.strict) throw new Error('週間固定が未設定です。先に週間スケジュールを保存してください。');
    return { created: 0, skipped: 0, overwrite: !!overwrite, applied: false, reason: 'no_weekly' };
  }

  var hasPattern = weekly.some(function (w) {
    return w.status === 'work' || w.status === 'off' || w.status === 'pto' || w.status === 'absent';
  });
  if (!hasPattern) {
    if (opts.strict) throw new Error('週間スケジュールで出勤○／休み×を設定して保存してください。');
    return { created: 0, skipped: 0, overwrite: !!overwrite, applied: false, reason: 'no_pattern' };
  }

  var byEmpWd = {};
  weekly.forEach(function (w) {
    byEmpWd[w.employee_id + '__' + Number(w.weekday)] = w;
  });

  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var days = new Date(year, month, 0).getDate();
  var employees = listEmployeesDetailed_(storeId);
  if (!employees.length) {
    if (opts.strict) throw new Error('従業員がいません。先に従業員を登録してください。');
    return { created: 0, skipped: 0, overwrite: !!overwrite, applied: false, reason: 'no_employees' };
  }

  var expected = employees.length * days;
  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, [
    'shift_id', 'date', 'employee_id', 'store_id', 'status',
    'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'
  ]);

  var data = sh.getDataRange().getValues();
  var existing = {};
  var filledCount = 0;
  for (var r = 1; r < data.length; r++) {
    var sid = String(data[r][map.store_id] || '').trim();
    if (sid !== storeId) continue;
    var d0 = normalizeDate_(data[r][map.date]);
    if (!d0 || d0.substring(0, 7) !== ym) continue;
    var eid = String(data[r][map.employee_id] || '');
    var st = String(data[r][map.status] || 'undef');
    existing[eid + '__' + d0] = {
      row: r + 1,
      status: st,
      shift_id: String(data[r][map.shift_id] || ''),
      dataIndex: r
    };
    if (st && st !== 'undef') filledCount++;
  }

  // 高速パス: 全日すでに確定済みなら何もしない
  if (!overwrite && filledCount >= expected) {
    return {
      created: 0,
      skipped: expected,
      overwrite: false,
      applied: true,
      reason: 'already_filled',
      fast: true
    };
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var created = 0;
  var skipped = 0;
  var toAppend = [];
  var toUpdate = []; // { row, values }

  for (var d = 1; d <= days; d++) {
    var date = ym + '-' + pad2_(d);
    var weekday = new Date(year, month - 1, d).getDay();
    for (var ei = 0; ei < employees.length; ei++) {
      var emp = employees[ei];
      var w = byEmpWd[emp.employee_id + '__' + weekday];
      var status = 'off';
      var start = '';
      var end = '';
      var breakMin = '';
      if (w) {
        status = (!w.status || w.status === 'undef') ? 'off' : String(w.status);
        start = w.start_time || '';
        end = w.end_time || '';
        breakMin = w.break_minutes === '' || w.break_minutes == null ? '' : Number(w.break_minutes);
      }
      if (status === 'work') {
        if (!isHm_(start)) start = '12:00';
        if (!isHm_(end)) end = '21:00';
      } else {
        start = '';
        end = '';
      }

      var key = emp.employee_id + '__' + date;
      var ex = existing[key];
      if (ex && !overwrite) {
        if (ex.status && ex.status !== 'undef') {
          skipped++;
          continue;
        }
      }

      if (ex) {
        var full = data[ex.dataIndex].slice();
        full[map.status] = status;
        full[map.start_time] = start;
        full[map.end_time] = end;
        if (map.break_minutes != null) full[map.break_minutes] = breakMin;
        if (map.source != null) full[map.source] = 'system';
        if (map.updated_at != null) full[map.updated_at] = now;
        if (map.updated_by != null) full[map.updated_by] = email;
        toUpdate.push({ row: ex.row, values: full });
        created++;
        continue;
      }

      var row = new Array(headers.length).fill('');
      row[map.shift_id] = 'SH' + stamp + '-' + emp.employee_id + '-' + pad2_(d);
      row[map.date] = date;
      row[map.employee_id] = emp.employee_id;
      row[map.store_id] = storeId;
      row[map.status] = status;
      row[map.start_time] = start;
      row[map.end_time] = end;
      if (map.break_minutes != null) row[map.break_minutes] = breakMin;
      if (map.source != null) row[map.source] = 'system';
      if (map.updated_at != null) row[map.updated_at] = now;
      if (map.updated_by != null) row[map.updated_by] = email;
      toAppend.push(row);
      created++;
    }
  }

  // 連続行をまとめて一括書き込み
  if (toUpdate.length) {
    toUpdate.sort(function (a, b) { return a.row - b.row; });
    var i = 0;
    while (i < toUpdate.length) {
      var startIdx = i;
      while (i + 1 < toUpdate.length && toUpdate[i + 1].row === toUpdate[i].row + 1) i++;
      var block = toUpdate.slice(startIdx, i + 1);
      var vals = block.map(function (b) { return b.values; });
      sh.getRange(block[0].row, 1, block[block.length - 1].row, headers.length).setValues(vals);
      i++;
    }
  }

  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, startRow + toAppend.length - 1, headers.length).setValues(toAppend);
  }

  return {
    created: created,
    skipped: skipped,
    overwrite: !!overwrite,
    applied: true,
    appended: toAppend.length,
    updated: toUpdate.length
  };
}

/** 週間固定を店舗単位で軽量取得（権限チェックなし・内部用） */
function readWeeklyForStore_(storeId) {
  ensureWeeklySheet_();
  var sh = mustSheet_(SHIFT_APP.SHEETS.WEEKLY);
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['employee_id', 'store_id', 'weekday', 'status']);
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (map.is_active != null && !isTruthy_(r[map.is_active])) continue;
    out.push({
      employee_id: String(r[map.employee_id] || ''),
      weekday: Number(r[map.weekday]),
      status: String(r[map.status] || 'undef'),
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time]),
      break_minutes: r[map.break_minutes] === '' || r[map.break_minutes] == null ? '' : Number(r[map.break_minutes])
    });
  }
  return out;
}

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
  var rowVals = rowIndex > 0
    ? sh.getRange(rowIndex, 1, 1, colCount).getValues()[0]
    : new Array(colCount).fill('');

  rowVals[map.shift_id] = shiftId;
  rowVals[map.date] = date;
  rowVals[map.employee_id] = employeeId;
  rowVals[map.store_id] = storeId;
  rowVals[map.status] = status;
  rowVals[map.start_time] = start;
  rowVals[map.end_time] = end;
  rowVals[map.break_minutes] = breakMin === '' ? '' : breakMin;
  rowVals[map.source] = String(p.source || 'web');
  rowVals[map.updated_at] = now;
  rowVals[map.updated_by] = email;

  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, colCount).setValues([rowVals]);
  else sh.appendRow(rowVals);

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
      source: String(p.source || 'web'),
      updated_at: now,
      updated_by: email
    }
  };
}

/**
 * 月間セル変更の一括保存
 * payload: { user_email, store_id, items: [{shift_id?, date, employee_id, status, start_time, end_time}] }
 */
function upsertShiftsBatch(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return { ok: true, saved: 0 };

  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, [
    'shift_id', 'date', 'employee_id', 'store_id', 'status',
    'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'
  ]);

  var data = sh.getDataRange().getValues();
  var byId = {};
  var byKey = {};
  for (var r = 1; r < data.length; r++) {
    var sid = String(data[r][map.store_id] || '').trim();
    if (sid !== storeId) continue;
    var id = String(data[r][map.shift_id] || '');
    var d0 = normalizeDate_(data[r][map.date]);
    var eid = String(data[r][map.employee_id] || '');
    if (id) byId[id] = { row: r + 1, dataIndex: r };
    byKey[eid + '__' + d0] = { row: r + 1, dataIndex: r, shift_id: id };
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var toUpdate = [];
  var toAppend = [];

  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var date = normalizeDate_(it.date);
    var employeeId = String(it.employee_id || '').trim();
    var status = String(it.status || '').trim();
    if (!date || !employeeId) continue;
    if (SHIFT_APP.STATUS.indexOf(status) < 0) status = 'undef';
    var start = String(it.start_time || '').trim();
    var end = String(it.end_time || '').trim();
    if (status === 'work') {
      if (!isHm_(start)) start = '12:00';
      if (!isHm_(end)) end = '21:00';
    } else {
      start = '';
      end = '';
    }

    var shiftId = String(it.shift_id || '').trim();
    var hit = shiftId && byId[shiftId] ? byId[shiftId] : byKey[employeeId + '__' + date];
    if (hit) {
      var full = data[hit.dataIndex].slice();
      if (!shiftId) shiftId = String(full[map.shift_id] || '') || ('SH' + stamp + '-' + employeeId + '-' + i);
      full[map.shift_id] = shiftId;
      full[map.date] = date;
      full[map.employee_id] = employeeId;
      full[map.store_id] = storeId;
      full[map.status] = status;
      full[map.start_time] = start;
      full[map.end_time] = end;
      if (map.source != null) full[map.source] = 'web';
      if (map.updated_at != null) full[map.updated_at] = now;
      if (map.updated_by != null) full[map.updated_by] = email;
      toUpdate.push({ row: hit.row, values: full });
    } else {
      var row = new Array(headers.length).fill('');
      row[map.shift_id] = 'SH' + stamp + '-' + employeeId + '-' + i;
      row[map.date] = date;
      row[map.employee_id] = employeeId;
      row[map.store_id] = storeId;
      row[map.status] = status;
      row[map.start_time] = start;
      row[map.end_time] = end;
      if (map.source != null) row[map.source] = 'web';
      if (map.updated_at != null) row[map.updated_at] = now;
      if (map.updated_by != null) row[map.updated_by] = email;
      toAppend.push(row);
    }
  }

  if (toUpdate.length) {
    toUpdate.sort(function (a, b) { return a.row - b.row; });
    var ui = 0;
    while (ui < toUpdate.length) {
      var startU = ui;
      while (ui + 1 < toUpdate.length && toUpdate[ui + 1].row === toUpdate[ui].row + 1) ui++;
      var block = toUpdate.slice(startU, ui + 1);
      sh.getRange(block[0].row, 1, block[block.length - 1].row, headers.length)
        .setValues(block.map(function (b) { return b.values; }));
      ui++;
    }
  }
  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, startRow + toAppend.length - 1, headers.length).setValues(toAppend);
  }

  var ym = '';
  for (var j = 0; j < items.length; j++) {
    var dj = normalizeDate_(items[j].date);
    if (dj) { ym = dj.substring(0, 7); break; }
  }
  var result = ym
    ? readShifts_(storeId, ym, email, acl)
    : { ok: true, employees: listEmployeesDetailed_(storeId), shifts: [], canEdit: true };
  result.saved = toUpdate.length + toAppend.length;
  return result;
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
 * バイバイ貼り付け（コピー用テキスト生成）
 * ============================================================ */
var BYE_BYE = {
  SHEET_NAME: 'バイバイ貼り付け',
  ROW_TYPES: [
    { code: 215001, name: '休日・休暇' },
    { code: 215201, name: 'シフト' },
    { code: 215013, name: '休日・休暇(自動展開)' },
    { code: 215231, name: 'シフト(自動展開)' }
  ],
  BREAK_THRESHOLD_MINUTES: 360,
  CODE: {
    HOUTEI: 10,      // 法定
    HOUTEIGAI: 20,   // 法定外（公休）
    PTO: 61,         // 有休
    SPECIAL: 62,     // 特休
    ABSENT: 80       // 欠勤
  }
};

/**
 * 正規化シフト → バイバイ貼り付け形式
 * @return {{ ok, tsv, warnings, staffCount, yearMonth, storeId, wroteSheet }}
 */
function buildByeByePaste(storeId, yearMonth, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);

  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式です。');

  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();
  var dayOfWeekStr = SHIFT_APP.WEEKDAY_LABELS;

  var employees = listEmployeesDetailed_(storeId);
  var warnings = [];
  var withCode = [];
  employees.forEach(function (e) {
    if (!String(e.bye_code || '').trim()) {
      warnings.push(e.name + '：社員コード未登録（スキップ）');
      return;
    }
    withCode.push(e);
  });
  if (!withCode.length) throw new Error('社員コード付きの従業員がいません。先に従業員登録してください。');

  var shiftRes = getShifts(storeId, ym, email);
  var byEmpDate = {};
  (shiftRes.shifts || []).forEach(function (s) {
    byEmpDate[s.employee_id + '__' + s.date] = s;
  });

  var dateHeaders = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var t = new Date(year, month - 1, d);
    dateHeaders.push(t.getMonth() + 1 + '/' + t.getDate() + '(' + dayOfWeekStr[t.getDay()] + ')');
  }
  var headerRow = [year + '/' + month + '/1', '～', year + '/' + month + '/' + daysInMonth, ''].concat(dateHeaders);

  var outputData = [];
  withCode.forEach(function (emp) {
    var code = String(emp.bye_code).trim();
    var outputName = String(emp.name || '').replace(/[ 　]+/g, '　');
    var rowsForStaff = [];
    for (var r = 0; r < 4; r++) {
      var row = [code, outputName, BYE_BYE.ROW_TYPES[r].code, BYE_BYE.ROW_TYPES[r].name];
      for (var dd = 0; dd < daysInMonth; dd++) row.push('');
      rowsForStaff.push(row);
    }

    var weekHolidays = [];
    var hasExplicitHoutei = false;

    for (var day = 1; day <= daysInMonth; day++) {
      var date = ym + '-' + pad2_(day);
      var currentDate = new Date(year, month - 1, day);
      var idx = day - 1;
      var s = byEmpDate[emp.employee_id + '__' + date];
      var status = s ? String(s.status || '') : '';

      // 日曜区切りで週の公休を 10/20 に振り分け（既存gas-kyodo準拠）
      if (currentDate.getDay() === 0 && idx !== 0) {
        applyWeekHolidayCodes_(rowsForStaff[0], weekHolidays, hasExplicitHoutei);
        weekHolidays = [];
        hasExplicitHoutei = false;
      }

      var valForShift = '';
      var isHoliday = false;

      if (!s || !status || status === 'undef') {
        isHoliday = true;
      } else if (status === 'off') {
        // 公休扱い → 週まとめ後に 10/20
        isHoliday = true;
      } else if (status === 'absent') {
        rowsForStaff[0][4 + idx] = BYE_BYE.CODE.ABSENT;
      } else if (status === 'pto') {
        rowsForStaff[0][4 + idx] = BYE_BYE.CODE.PTO;
        valForShift = '08:30-17:30R1:00';
      } else if (status === 'work') {
        valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes);
        if (!valForShift) {
          warnings.push(emp.name + ' ' + date + '：勤務なのに時刻不正');
          isHoliday = true;
        }
      } else {
        isHoliday = true;
      }

      if (isHoliday) weekHolidays.push(idx);
      if (valForShift) rowsForStaff[1][4 + idx] = valForShift;

      if (idx === daysInMonth - 1) {
        applyWeekHolidayCodes_(rowsForStaff[0], weekHolidays, hasExplicitHoutei);
      }
    }

    // 自動展開行へミラー（貼り付け先が見やすい）
    for (var c = 4; c < 4 + daysInMonth; c++) {
      rowsForStaff[2][c] = rowsForStaff[0][c];
      rowsForStaff[3][c] = rowsForStaff[1][c];
    }
    rowsForStaff.forEach(function (rr) { outputData.push(rr); });
  });

  // シートにも書く（確認用）
  var wroteSheet = false;
  try {
    wroteSheet = writeByeByeSheet_(headerRow, outputData);
  } catch (e) {
    warnings.push('シート書き込みスキップ: ' + e);
  }

  var tsv = rowsToTsv_([headerRow].concat(outputData));
  return {
    ok: true,
    storeId: storeId,
    yearMonth: ym,
    staffCount: withCode.length,
    rowCount: outputData.length + 1,
    tsv: tsv,
    warnings: warnings,
    wroteSheet: wroteSheet
  };
}

function applyWeekHolidayCodes_(holidayRow, weekHolidays, hasExplicitHoutei) {
  if (!weekHolidays || !weekHolidays.length) return;
  if (hasExplicitHoutei) {
    weekHolidays.forEach(function (idx) { holidayRow[4 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
  } else {
    var last = weekHolidays.pop();
    holidayRow[4 + last] = BYE_BYE.CODE.HOUTEI;
    weekHolidays.forEach(function (idx) { holidayRow[4 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
  }
}

function formatByeByeShift_(start, end, breakMinutes) {
  var s = formatHm_(start);
  var e = formatHm_(end);
  if (!isHm_(s) || !isHm_(e)) return '';
  var sp = s.split(':');
  var ep = e.split(':');
  var sh = Number(sp[0]); var sm = Number(sp[1]);
  var eh = Number(ep[0]); var em = Number(ep[1]);
  var duration = (eh * 60 + em) - (sh * 60 + sm);
  if (duration < 0) duration += 1440;

  var breakStr = '';
  if (breakMinutes !== '' && breakMinutes != null && !isNaN(Number(breakMinutes))) {
    var bm = Number(breakMinutes);
    var bh = Math.floor(bm / 60);
    var bmm = bm % 60;
    breakStr = 'R' + pad2_(bh) + ':' + pad2_(bmm);
  } else {
    breakStr = duration > BYE_BYE.BREAK_THRESHOLD_MINUTES ? 'R1:00' : 'R0:00';
  }
  return s + '-' + e + breakStr;
}

function writeByeByeSheet_(headerRow, outputData) {
  var ss = ss_();
  var sh = ss.getSheetByName(BYE_BYE.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(BYE_BYE.SHEET_NAME);
    sh.setTabColor('#cc0000');
  }
  sh.clear();
  var width = headerRow.length;
  if (sh.getMaxColumns() < width) {
    sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  }
  sh.getRange(1, 1, 1, width).setValues([headerRow]);
  sh.getRange(1, 1, 1, width)
    .setBackground('#404040')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  if (outputData.length) {
    if (sh.getMaxRows() < outputData.length + 1) {
      sh.insertRowsAfter(sh.getMaxRows(), outputData.length + 1 - sh.getMaxRows());
    }
    sh.getRange(2, 1, outputData.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, outputData.length, width).setValues(outputData);
    var color1 = '#eaf5f9';
    var color2 = '#fff6e5';
    var numStaff = outputData.length / 4;
    for (var i = 0; i < numStaff; i++) {
      sh.getRange(2 + i * 4, 1, 4, width).setBackground(i % 2 === 0 ? color1 : color2);
    }
  }
  return true;
}

function rowsToTsv_(rows) {
  return (rows || []).map(function (row) {
    return (row || []).map(function (cell) {
      var s = cell == null ? '' : String(cell);
      // TSV: タブ・改行を除去
      return s.replace(/[\t\r\n]+/g, ' ');
    }).join('\t');
  }).join('\n');
}

/* ============================================================
 * 認証・権限
 * ============================================================ */
function peekSessionEmail_() {
  var active = '';
  var effective = '';
  try { active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) {}
  try { effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(); } catch (e2) {}
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

function softResolveEmail_(clientEmail) {
  var email = normalizeEmail_(clientEmail);
  assertCompanyDomain_(email);
  var sessionEmail = peekSessionEmail_();
  if (sessionEmail && sessionEmail !== email) {
    throw new Error('Googleアカウントとログインメールが一致しません。');
  }
  return email;
}

function resolveClientEmail_(clientEmail) {
  var email = softResolveEmail_(clientEmail);
  resolveAcl_(email); // 管轄必須
  return email;
}

function resolveAcl_(email, opt) {
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
    if (sid && sid !== '*') stores[sid] = betterRole_(stores[sid], role);
    roleMax = betterRole_(roleMax, role);
  }

  if (!isAdmin && Object.keys(stores).length === 0) {
    if (opt && opt.allowEmpty) {
      return { email: email, isAdmin: false, stores: {}, roleMax: '', needsJurisdiction: true };
    }
    throw new Error('管轄店舗が未登録です。先に管轄登録を行ってください。(' + email + ')');
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

/* ============================================================
 * マスタ読み取り
 * ============================================================ */
function listAllStores_() {
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
    list.push({
      store_id: id,
      store_name: String(row[map.store_name] || ''),
      area: map.area != null ? String(row[map.area] || '') : '',
      sort_order: Number(row[map.sort_order] || 0)
    });
  }
  list.sort(function (a, b) {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.store_name.localeCompare(b.store_name, 'ja');
  });
  return list;
}

function uniqueAreas_(stores) {
  var seen = {};
  var out = [];
  (stores || []).forEach(function (s) {
    var a = String(s.area || '').trim();
    if (!a || seen[a]) return;
    seen[a] = true;
    out.push(a);
  });
  return out.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
}

function listStoresForUser_(acl) {
  var all = listAllStores_();
  if (acl.isAdmin) {
    return all.map(function (s) {
      return { store_id: s.store_id, store_name: s.store_name, area: s.area, sort_order: s.sort_order, role: SHIFT_APP.ROLES.ADMIN };
    });
  }
  return all.filter(function (s) { return !!acl.stores[s.store_id]; }).map(function (s) {
    return { store_id: s.store_id, store_name: s.store_name, area: s.area, sort_order: s.sort_order, role: acl.stores[s.store_id] };
  });
}

function listEmployeesDetailed_(storeId) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
  var map = ensureHeaderColumn_(sh, 'work_hours');
  requireHeaders_(map, ['employee_id', 'name', 'primary_store_id', 'is_active']);
  var values = getDataRows_(sh);
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isTruthy_(row[map.is_active])) continue;
    var id = String(row[map.employee_id] || '').trim();
    if (!id) continue;
    var primary = String(row[map.primary_store_id] || '');
    // 店舗画面では主所属を優先表示。他店ヘルプは後で拡張可
    if (primary && primary !== storeId) continue;
    var empType = map.employment_type != null ? String(row[map.employment_type] || '') : '';
    if (empType === 'パート') empType = 'アルバイト';
    var workHours = '';
    if (map.work_hours != null && row[map.work_hours] !== '' && row[map.work_hours] != null) {
      var whn = Number(row[map.work_hours]);
      if (!isNaN(whn) && whn > 0) workHours = whn;
    }
    list.push({
      employee_id: id,
      name: String(row[map.name] || ''),
      bye_code: map.bye_code != null ? String(row[map.bye_code] || '') : '',
      primary_store_id: primary,
      employment_type: empType || '社員',
      work_hours: workHours,
      is_primary: primary === storeId
    });
  }
  list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
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

function upsertSelfProfileName_(email, name) {
  // 従業員マスタに自分行がなければ作らない（管理者用）。ある場合のみ名前更新。
  var found = findEmployeeByEmail_(email);
  if (!found || !found.employee_id) return;
  var sh = mustSheet_(SHIFT_APP.SHEETS.EMPLOYEES);
  var map = headerIndexMap_(getHeaders_(sh));
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][map.employee_id] || '') !== found.employee_id) continue;
    sh.getRange(r + 1, map.name + 1).setValue(name);
    if (map.name_key != null) sh.getRange(r + 1, map.name_key + 1).setValue(name.replace(/[\s　]/g, ''));
    return;
  }
}

function findShiftRow_(storeId, employeeId, date) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var map = headerIndexMap_(getHeaders_(sh));
  var values = getDataRows_(sh);
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (String(r[map.employee_id] || '') !== employeeId) continue;
    if (normalizeDate_(r[map.date]) !== date) continue;
    return {
      shift_id: String(r[map.shift_id] || ''),
      status: String(r[map.status] || ''),
      row: i + 2
    };
  }
  return null;
}

function ensureWeeklySheet_() {
  var ss = ss_();
  if (ss.getSheetByName(SHIFT_APP.SHEETS.WEEKLY)) return;
  var sh = ss.insertSheet(SHIFT_APP.SHEETS.WEEKLY);
  var headers = [
    'weekly_id', 'employee_id', 'store_id', 'weekday', 'status',
    'start_time', 'end_time', 'break_minutes', 'is_active', 'updated_at', 'updated_by'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.setTabColor('#3d85c6');
}

/* ============================================================
 * ユーティリティ
 * ============================================================ */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function mustSheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」が見つかりません。セットアップを実行してください。');
  return sh;
}

/** ヘッダが無ければ末尾に追加して index map を返す */
function ensureHeaderColumn_(sh, headerName) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  if (map[headerName] != null) return map;
  var col = Math.max(sh.getLastColumn(), headers.length) + 1;
  if (headers.length === 1 && !headers[0]) col = 1;
  sh.getRange(1, col).setValue(headerName);
  map[headerName] = col - 1;
  return map;
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
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
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

function isHm_(s) { return /^\d{1,2}:\d{2}$/.test(String(s || '')); }

function pad2_(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}
