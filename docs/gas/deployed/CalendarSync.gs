/**
 * Googleカレンダー反映（第7エリア CalendarAndAttendance 準拠・簡略版）
 * - いったん対象: ログイン本人のGoogleカレンダーのみ（従業員マスタのメール一致）
 * - データ元: 店舗シフトシート（正規化）＋メモ
 * - 推奨: サービスに Google Calendar API（Calendar v3）を追加
 */

var CAL_SYNC = {
  SOURCE: 'shift-one',
  THROTTLE_MS: 120,
  PAUSE_EVERY: 12,
  PAUSE_MS: 400,
  MAX_RETRY: 4,
  BACKOFF_MS: 500
};

/**
 * 初回だけ実行: カレンダー権限の許可ダイアログを出す
 * Apps Script 編集画面 → 関数 authorizeCalendarOnce → 実行 → 許可
 */
function authorizeCalendarOnce() {
  var cal = CalendarApp.getDefaultCalendar();
  var name = cal ? cal.getName() : '(none)';
  // Advanced Calendar API も触ってスコープを確定
  try {
    if (typeof Calendar !== 'undefined' && Calendar.CalendarList) {
      Calendar.CalendarList.list({ maxResults: 1 });
    }
  } catch (e) {}
  return 'カレンダー権限OK: ' + name;
}

/**
 * payload: { user_email, store_id, year_month, employee_id?, phase?, day_from?, day_to? }
 * phase:
 *   - 省略/'full' … 従来どおり一括
 *   - 'prepare' … 当月の同期予定クリアのみ（進捗用）
 *   - 'chunk' … day_from〜day_to だけ登録（進捗用・操作はフロントで分割）
 * いったんはログイン本人のGoogleカレンダーのみ
 */
function syncCalendarMonth(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var ym = String(p.year_month || '').trim();
  var phase = String(p.phase || 'full').trim().toLowerCase();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');

  var storeName = resolveStoreNameForCal_(storeId);
  var selfEmp = resolveSelfCalendarEmployee_(storeId, email);
  if (!selfEmp) {
    return {
      ok: false,
      yearMonth: ym,
      storeId: storeId,
      synced: 0,
      failed: 1,
      results: [],
      message: 'ログイン中のメール（' + email + '）が従業員マスタにありません。自分の行にメールを入れてください。'
    };
  }

  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();

  if (phase === 'prepare') {
    try {
      var calPrep = openSelfCalendarCal_(selfEmp.email);
      var sod = new Date(year, month - 1, 1, 0, 0, 0, 0);
      var eod = new Date(year, month, 0, 23, 59, 59, 999);
      var deleted = purgeManagedEventsInRangeCal_(calPrep, sod, eod, year, month);
      return {
        ok: true,
        phase: 'prepare',
        yearMonth: ym,
        daysInMonth: daysInMonth,
        deleted: deleted,
        email: selfEmp.email,
        name: selfEmp.name,
        message: '準備完了（旧同期 ' + deleted + '件クリア）'
      };
    } catch (ePrep) {
      return {
        ok: false,
        phase: 'prepare',
        yearMonth: ym,
        daysInMonth: daysInMonth,
        message: String(ePrep && ePrep.message ? ePrep.message : ePrep)
      };
    }
  }

  var dayFrom = p.day_from != null ? Number(p.day_from) : 1;
  var dayTo = p.day_to != null ? Number(p.day_to) : daysInMonth;
  if (isNaN(dayFrom) || dayFrom < 1) dayFrom = 1;
  if (isNaN(dayTo) || dayTo > daysInMonth) dayTo = daysInMonth;
  if (dayFrom > dayTo) {
    return { ok: true, phase: phase, yearMonth: ym, created: 0, message: '対象日なし' };
  }

  var doPurge = phase !== 'chunk';
  var shiftsBundle = readShifts_(storeId, ym, email, acl, {});
  var shifts = shiftsBundle.shifts || [];
  var memos = shiftsBundle.memos || [];
  var results = [];
  var synced = 0;
  var failed = 0;

  try {
    var r = syncOneEmployeeCalendar_(selfEmp, storeId, storeName, ym, shifts, memos, {
      purge: doPurge,
      dayFrom: dayFrom,
      dayTo: dayTo
    });
    results.push(r);
    if (r.ok) synced++;
    else failed++;
  } catch (e) {
    failed++;
    results.push({
      ok: false,
      name: selfEmp.name,
      email: selfEmp.email,
      message: String(e && e.message ? e.message : e)
    });
  }

  return {
    ok: failed === 0,
    phase: phase,
    yearMonth: ym,
    storeId: storeId,
    dayFrom: dayFrom,
    dayTo: dayTo,
    daysInMonth: daysInMonth,
    synced: synced,
    failed: failed,
    total: 1,
    results: results,
    created: results[0] && results[0].created != null ? results[0].created : 0,
    message: failed === 0
      ? (phase === 'chunk'
        ? (dayFrom + '〜' + dayTo + '日を登録（' + (results[0] && results[0].created || 0) + '件）')
        : (selfEmp.name + ' さんのカレンダー（' + selfEmp.email + '）へ ' + ym + ' を登録しました'))
      : ((results[0] && results[0].message) || 'カレンダー登録に失敗しました')
  };
}

function openSelfCalendarCal_(empEmail) {
  var cal = null;
  try { cal = CalendarApp.getCalendarById(empEmail); } catch (e1) { cal = null; }
  if (!cal) {
    try { cal = CalendarApp.getDefaultCalendar(); } catch (e2) { cal = null; }
  }
  if (!cal) {
    throw new Error(
      'カレンダーにアクセスできません: ' + empEmail +
      '\n権限許可（authorizeCalendarOnce）済みか確認してください。'
    );
  }
  return cal;
}

/**
 * payload: { user_email, store_id, year_month, employee_id? }
 * ログイン本人の同期予定だけ削除（会議・他タスクは保持）
 */
function clearCalendarMonth(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var ym = String(p.year_month || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');

  var selfEmp = resolveSelfCalendarEmployee_(storeId, email);
  if (!selfEmp) {
    return {
      ok: false,
      yearMonth: ym,
      cleared: 0,
      failed: 1,
      results: [],
      message: 'ログイン中のメール（' + email + '）が従業員マスタにありません。自分の行にメールを入れてください。'
    };
  }

  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var sod = new Date(year, month - 1, 1, 0, 0, 0, 0);
  var eod = new Date(year, month, 0, 23, 59, 59, 999);
  var results = [];
  var cleared = 0;
  var failed = 0;

  try {
    var cal = CalendarApp.getCalendarById(selfEmp.email);
    if (!cal) {
      try { cal = CalendarApp.getDefaultCalendar(); } catch (eDef) { cal = null; }
    }
    if (!cal) throw new Error('自分のカレンダーにアクセスできません: ' + selfEmp.email);
    var n = purgeManagedEventsInRangeCal_(cal, sod, eod, year, month);
    cleared = 1;
    results.push({
      ok: true,
      name: selfEmp.name,
      email: selfEmp.email,
      deleted: n,
      message: selfEmp.name + '：' + month + '月の同期予定を ' + n + '件クリア（会議・他タスクは保持）'
    });
  } catch (e) {
    failed = 1;
    results.push({
      ok: false,
      name: selfEmp.name,
      email: selfEmp.email,
      message: String(e && e.message ? e.message : e)
    });
  }

  return {
    ok: failed === 0,
    yearMonth: ym,
    cleared: cleared,
    failed: failed,
    results: results,
    message: failed === 0
      ? (month + '月をクリアしました（' + selfEmp.email + '／会議・他タスクは保持）')
      : ((results[0] && results[0].message) || 'クリアに失敗しました')
  };
}

/** ログインメールと一致する従業員（自分）だけ返す */
function resolveSelfCalendarEmployee_(storeId, loginEmail) {
  var target = String(loginEmail || '').trim().toLowerCase();
  if (!target || target.indexOf('@') < 0) return null;
  var list = listEmployeesForCalendar_(storeId, '');
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].email || '').toLowerCase() === target) return list[i];
  }
  try {
    var sh = mustEmployeesSheet_();
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.email == null) return null;
    var values = getDataRows_(sh);
    for (var r = 0; r < values.length; r++) {
      if (!isEmployeeActive_(values[r], map)) continue;
      var em = String(values[r][map.email] || '').trim().toLowerCase();
      if (em !== target) continue;
      var id = String((map.bye_code != null ? values[r][map.bye_code] : '') || values[r][map.employee_id] || '').trim();
      if (!id) continue;
      return {
        employee_id: id,
        name: String(values[r][map.name] || ''),
        email: em,
        bye_code: id
      };
    }
  } catch (e) {}
  return null;
}

function resolveStoreNameForCal_(storeId) {
  try {
    var stores = listAllStores_() || [];
    for (var i = 0; i < stores.length; i++) {
      if (String(stores[i].store_id) === String(storeId)) {
        return String(stores[i].store_name || storeId);
      }
    }
  } catch (e) {}
  return String(storeId || '');
}

function listEmployeesForCalendar_(storeId, onlyEmployeeId) {
  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['name', 'primary_store_id']);
  var values = getDataRows_(sh);
  var allStores = listAllStores_();
  var onlyId = onlyEmployeeId != null && String(onlyEmployeeId).trim()
    ? String(onlyEmployeeId).trim()
    : '';
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isEmployeeActive_(row, map)) continue;
    var id = String((map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || '').trim();
    if (!id || isKeyValue_(id)) continue;
    if (onlyId && id !== onlyId && String(row[map.employee_id] || '') !== onlyId) continue;
    var primary = String(row[map.primary_store_id] || row[map.store_id] || '');
    var storeNameOnRow = map.store_name != null ? String(row[map.store_name] || '').trim() : '';
    if (!employeeBelongsToStore_(primary, storeId, allStores, storeNameOnRow)) continue;
    var empEmail = map.email != null ? String(row[map.email] || '').trim() : '';
    if (!empEmail || empEmail.indexOf('@') < 0) continue;
    if (map.calendar_sync != null && row[map.calendar_sync] !== '' && row[map.calendar_sync] != null) {
      if (!isTruthy_(row[map.calendar_sync])) continue;
    }
    list.push({
      employee_id: id,
      name: String(row[map.name] || ''),
      email: empEmail.toLowerCase(),
      bye_code: id
    });
  }
  return list;
}

function syncOneEmployeeCalendar_(emp, storeId, storeName, ym, allShifts, allMemos, opt) {
  opt = opt || {};
  var cal = openSelfCalendarCal_(emp.email);

  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var days = new Date(year, month, 0).getDate();
  var dayFrom = opt.dayFrom != null ? Number(opt.dayFrom) : 1;
  var dayTo = opt.dayTo != null ? Number(opt.dayTo) : days;
  if (isNaN(dayFrom) || dayFrom < 1) dayFrom = 1;
  if (isNaN(dayTo) || dayTo > days) dayTo = days;

  if (opt.purge !== false) {
    var sod = new Date(year, month - 1, 1, 0, 0, 0, 0);
    var eod = new Date(year, month, 0, 23, 59, 59, 999);
    purgeManagedEventsInRangeCal_(cal, sod, eod, year, month);
  }

  var byDay = {};
  (allShifts || []).forEach(function (s) {
    if (String(s.employee_id) !== String(emp.employee_id) && String(s.employee_id) !== String(emp.bye_code)) return;
    var d = String(s.date || '').slice(0, 10);
    if (d.substring(0, 7) !== ym) return;
    byDay[d] = s;
  });
  var memoByDay = {};
  (allMemos || []).forEach(function (m) {
    if (String(m.employee_id) !== String(emp.employee_id) && String(m.employee_id) !== String(emp.bye_code)) return;
    var d = String(m.date || '').slice(0, 10);
    if (d.substring(0, 7) !== ym) return;
    var body = String(m.body || '').trim();
    if (body) memoByDay[d] = body;
  });

  var created = 0;
  var skipped = 0;
  var ops = 0;
  var tz = Session.getScriptTimeZone() || 'Asia/Tokyo';

  for (var day = dayFrom; day <= dayTo; day++) {
    var date = ym + '-' + pad2_(day);
    var s = byDay[date];
    var memo = memoByDay[date] || '';
    if (!s && !memo) continue;

    var status = s ? String(s.status || 'undef') : 'undef';
    var leaveCode = s && s.leave_code !== '' && s.leave_code != null ? Number(s.leave_code) : 0;
    var startHm = s ? formatHm_(s.start_time) : '';
    var endHm = s ? formatHm_(s.end_time) : '';
    var dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    var nextMidnight = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    var extra = memo ? ('\n\n【メモ】\n' + memo) : '';
    var calendarId = emp.email;

    // 勤務（第7準拠）: 勤務帯＝勤務場所 / 前後＝不在(outOfOffice)
    if (status === 'work' && isHm_(startHm) && isHm_(endHm)) {
      var range = buildDateRangeCal_(year, month, day, startHm, endHm);
      var shiftKey = makeCalSyncKey_(year, month, day, 'SHIFT');
      var workLocKey = makeCalSyncKey_(year, month, day, 'WORK_LOC');

      if ((range.start - dayStart) / 60000 >= 10) {
        insertOutOfOfficeCal_(calendarId, dayStart, range.start, makeCalSyncKey_(year, month, day, 'OFF_BEFORE'));
        created++;
        ops = afterCalOp_(ops);
      }
      if ((nextMidnight - range.end) / 60000 >= 10) {
        insertOutOfOfficeCal_(calendarId, range.end, nextMidnight, makeCalSyncKey_(year, month, day, 'OFF_AFTER'));
        created++;
        ops = afterCalOp_(ops);
      }
      if (!insertWorkingLocationCal_(calendarId, range.start, range.end, storeName, workLocKey, shiftKey)) {
        var title = '勤務 ' + startHm + '-' + endHm;
        var desc = makeCalDescription_(shiftKey, (startHm + '-' + endHm) + extra, tz);
        var ev = createCalEventRetry_(cal, title, range.start, range.end, { description: desc });
        try {
          ev.setColor(CalendarApp.EventColor.PALE_RED);
          ev.setTransparency(CalendarApp.EventTransparency.TRANSPARENT);
          ev.setLocation(storeName);
        } catch (eSet) {}
      }
      created++;
      ops = afterCalOp_(ops);
      continue;
    }

    if (status === 'pto' || leaveCode === 61 || leaveCode === 62) {
      var ptoKey = makeCalSyncKey_(year, month, day, 'PTO');
      var ptoTitle = leaveCode === 62 ? '特別休暇' : '有休';
      var ptoEv = createCalAllDayRetry_(cal, ptoTitle, dayStart, {
        description: makeCalDescription_(ptoKey, ptoTitle + extra, tz)
      });
      try {
        ptoEv.setColor(CalendarApp.EventColor.GRAY);
        ptoEv.setTransparency(CalendarApp.EventTransparency.OPAQUE);
      } catch (eP) {}
      created++;
      ops = afterCalOp_(ops);
      continue;
    }

    if (status === 'absent' || leaveCode === 80) {
      var abKey = makeCalSyncKey_(year, month, day, 'ABSENT');
      var abEv = createCalAllDayRetry_(cal, '欠勤', dayStart, {
        description: makeCalDescription_(abKey, '欠勤' + extra, tz)
      });
      try {
        abEv.setColor(CalendarApp.EventColor.GRAY);
        abEv.setTransparency(CalendarApp.EventTransparency.OPAQUE);
      } catch (eA) {}
      created++;
      ops = afterCalOp_(ops);
      continue;
    }

    if (status === 'off' || leaveCode === 10 || leaveCode === 20) {
      var offKey = makeCalSyncKey_(year, month, day, 'OFF');
      var offTitle = leaveCode === 10 ? '法定休日' : '公休';
      var offEv = createCalAllDayRetry_(cal, offTitle, dayStart, {
        description: makeCalDescription_(offKey, offTitle + extra, tz)
      });
      try {
        offEv.setColor(CalendarApp.EventColor.GRAY);
        offEv.setTransparency(CalendarApp.EventTransparency.OPAQUE);
      } catch (eO) {}
      created++;
      ops = afterCalOp_(ops);
      continue;
    }

    if (leaveCode && isHm_(startHm) && isHm_(endHm)) {
      var lr = buildDateRangeCal_(year, month, day, startHm, endHm);
      var lk = makeCalSyncKey_(year, month, day, 'LEAVE');
      if ((lr.start - dayStart) / 60000 >= 10) {
        insertOutOfOfficeCal_(calendarId, dayStart, lr.start, makeCalSyncKey_(year, month, day, 'OFF_BEFORE'));
        created++;
        ops = afterCalOp_(ops);
      }
      if ((nextMidnight - lr.end) / 60000 >= 10) {
        insertOutOfOfficeCal_(calendarId, lr.end, nextMidnight, makeCalSyncKey_(year, month, day, 'OFF_AFTER'));
        created++;
        ops = afterCalOp_(ops);
      }
      if (!insertWorkingLocationCal_(calendarId, lr.start, lr.end, storeName, makeCalSyncKey_(year, month, day, 'WORK_LOC'), lk)) {
        var lt = '休暇 ' + startHm + '-' + endHm;
        var lev = createCalEventRetry_(cal, lt, lr.start, lr.end, {
          description: makeCalDescription_(lk, 'code=' + leaveCode + extra, tz)
        });
        try { lev.setColor(CalendarApp.EventColor.ORANGE); } catch (eL) {}
      }
      created++;
      ops = afterCalOp_(ops);
      continue;
    }

    if (memo) {
      var mk = makeCalSyncKey_(year, month, day, 'MEMO');
      var mev = createCalAllDayRetry_(cal, memo.slice(0, 40), dayStart, {
        description: makeCalDescription_(mk, memo, tz)
      });
      try { mev.setColor(CalendarApp.EventColor.PALE_GREEN); } catch (eM) {}
      created++;
      ops = afterCalOp_(ops);
    } else {
      skipped++;
    }
  }

  return {
    ok: true,
    name: emp.name,
    email: emp.email,
    created: created,
    skipped: skipped,
    dayFrom: dayFrom,
    dayTo: dayTo,
    message: emp.name + '：新規 ' + created + '件（' + dayFrom + '〜' + dayTo + '日）'
  };
}

function makeCalSyncKey_(y, m, d, type) {
  return y + '-' + pad2_(m) + '-' + pad2_(d) + ':' + type;
}

function makeCalDescription_(key, note, tz) {
  return (
    '[SYNC_KEY:' + key + ']\n' +
    '[SOURCE:' + CAL_SYNC.SOURCE + ']\n' +
    '原文: ' + String(note || '') + '\n' +
    '同期: ' + Utilities.formatDate(new Date(), tz || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
  );
}

function buildDateRangeCal_(year, month, day, startHm, endHm) {
  var sp = String(startHm).split(':');
  var ep = String(endHm).split(':');
  var start = new Date(year, month - 1, day, Number(sp[0]), Number(sp[1]), 0, 0);
  var end = new Date(year, month - 1, day, Number(ep[0]), Number(ep[1]), 0, 0);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start: start, end: end };
}

function isManagedCalDescription_(desc) {
  var s = String(desc || '');
  if (s.indexOf('[SOURCE:' + CAL_SYNC.SOURCE + ']') >= 0) return true;
  if (s.indexOf('[SYNC_KEY:') >= 0) return true;
  return false;
}

/** 第7準拠: SYNC_KEY付き／同期ソースのみ削除。会議・手動タスクは残す */
function isManagedCalendarEventCal_(ev, year, month) {
  var title = String(ev.getTitle() || '');
  if (title === '予定あり' || title === '×') return true;
  var desc = '';
  try { desc = ev.getDescription() || ''; } catch (eD) { desc = ''; }
  var monthPrefix = year + '-' + pad2_(month) + '-';
  var stampPrefix = '[SYNC_KEY:' + monthPrefix;
  if (desc.indexOf(stampPrefix) !== -1) return true;
  if (desc.indexOf('[SYNC_KEY:') === -1) return false;
  // 他月の SYNC_KEY は触らない
  if (desc.indexOf('[SYNC_KEY:') !== -1 && desc.indexOf(stampPrefix) === -1) return false;
  return /^(勤務 |予定あり|不在|×|勤務場所:|公休|有休|タスク\(時間未定\)|タスク)/.test(title);
}

function withCalRetry_(fn, label) {
  var delay = CAL_SYNC.BACKOFF_MS;
  for (var i = 0; i < CAL_SYNC.MAX_RETRY; i++) {
    try {
      var res = fn();
      if (CAL_SYNC.THROTTLE_MS) Utilities.sleep(CAL_SYNC.THROTTLE_MS);
      return res;
    } catch (e) {
      var msg = String(e && e.message ? e.message : e);
      if (/too many|Rate Limit|Service invoked too many times/i.test(msg)) {
        Utilities.sleep(delay);
        delay *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error((label || 'calendar') + ' failed (rate limit)');
}

function createCalEventRetry_(cal, title, start, end, opt) {
  return withCalRetry_(function () { return cal.createEvent(title, start, end, opt || {}); }, 'createEvent');
}

function createCalAllDayRetry_(cal, title, day, opt) {
  return withCalRetry_(function () { return cal.createAllDayEvent(title, day, opt || {}); }, 'createAllDayEvent');
}

function deleteCalEventRetry_(ev) {
  return withCalRetry_(function () { ev.deleteEvent(); return true; }, 'deleteEvent');
}

function afterCalOp_(ops) {
  ops++;
  if (ops % CAL_SYNC.PAUSE_EVERY === 0) Utilities.sleep(CAL_SYNC.PAUSE_MS);
  return ops;
}

function toRfc3339Cal_(dt) {
  return Utilities.formatDate(dt, Session.getScriptTimeZone() || 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss");
}

function assertCalendarApiCal_() {
  if (typeof Calendar === 'undefined' || !Calendar.Events) {
    throw new Error('Google Calendar API（サービス ID: Calendar）が未設定です。');
  }
}

function calSyncPrivateProps_(primaryKey, secondaryKey, note) {
  var p = {
    gasSyncKey: primaryKey,
    gasSyncSource: CAL_SYNC.SOURCE,
    gasSyncedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
  };
  if (secondaryKey) p.gasSyncKey2 = secondaryKey;
  if (note) p.gasSyncNote = String(note).slice(0, 200);
  return p;
}

/** 勤務外 → 表示名「不在」（斜線の outOfOffice） */
function insertOutOfOfficeCal_(calendarId, start, end, syncKey) {
  assertCalendarApiCal_();
  var tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  withCalRetry_(function () {
    return Calendar.Events.insert({
      summary: '不在',
      eventType: 'outOfOffice',
      start: { dateTime: toRfc3339Cal_(start), timeZone: tz },
      end: { dateTime: toRfc3339Cal_(end), timeZone: tz },
      visibility: 'public',
      transparency: 'opaque',
      extendedProperties: { private: calSyncPrivateProps_(syncKey, null, 'off_block') }
    }, calendarId);
  }, 'outOfOffice');
  return true;
}

/** 勤務帯 → 「勤務場所: 経堂」棒線。成功なら true */
function insertWorkingLocationCal_(calendarId, start, end, locationLabel, workLocKey, shiftKey) {
  if (typeof Calendar === 'undefined' || !Calendar.Events) return false;
  var label = String(locationLabel || '店舗').trim() || '店舗';
  var tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  try {
    withCalRetry_(function () {
      return Calendar.Events.insert({
        summary: '勤務場所: ' + label,
        eventType: 'workingLocation',
        start: { dateTime: toRfc3339Cal_(start), timeZone: tz },
        end: { dateTime: toRfc3339Cal_(end), timeZone: tz },
        visibility: 'public',
        transparency: 'transparent',
        extendedProperties: { private: calSyncPrivateProps_(workLocKey, shiftKey, label) },
        workingLocationProperties: {
          type: 'officeLocation',
          officeLocation: { label: label }
        }
      }, calendarId);
    }, 'workingLocation');
    return true;
  } catch (e) {
    Logger.log('workingLocation失敗: ' + e);
    return false;
  }
}

function purgeManagedEventsInRangeCal_(cal, sod, eod, year, month) {
  var events = cal.getEvents(sod, eod);
  var n = 0;
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!isManagedCalendarEventCal_(ev, year, month)) continue;
    try {
      deleteCalEventRetry_(ev);
      n++;
    } catch (eDel) {}
  }
  // outOfOffice / workingLocation（description 無し）は API の extendedProperties で判定
  try {
    n += purgeManagedViaApiCal_(cal.getId(), sod, eod, year, month);
  } catch (eApi) {}
  return n;
}

function purgeManagedViaApiCal_(calendarId, sod, eod, year, month) {
  if (typeof Calendar === 'undefined' || !Calendar.Events || !calendarId) return 0;
  var monthPrefix = year + '-' + pad2_(month) + '-';
  var stampPrefix = '[SYNC_KEY:' + monthPrefix;
  var n = 0;
  var pageToken = null;
  do {
    var list = Calendar.Events.list(calendarId, {
      timeMin: sod.toISOString(),
      timeMax: eod.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken: pageToken
    });
    var items = (list && list.items) || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!isApiManagedEventItemCal_(item, monthPrefix, stampPrefix)) continue;
      try {
        Calendar.Events.remove(calendarId, item.id);
        n++;
        Utilities.sleep(CAL_SYNC.THROTTLE_MS);
      } catch (eR) {}
    }
    pageToken = list && list.nextPageToken;
  } while (pageToken);
  return n;
}

function isApiManagedEventItemCal_(item, monthPrefix, stampPrefix) {
  var desc = item.description || '';
  if (desc.indexOf(stampPrefix) !== -1) return true;
  var priv = (item.extendedProperties && item.extendedProperties.private) || {};
  var k = String(priv.gasSyncKey || '');
  var k2 = String(priv.gasSyncKey2 || '');
  if (k.indexOf(monthPrefix) === 0 || k2.indexOf(monthPrefix) === 0) return true;
  // ソース付きでも、当月キーがあるものだけ（他月や手動は残す）
  if ((priv.gasSyncSource === CAL_SYNC.SOURCE || priv.gasSyncSource === 'kyodo-gas') &&
      (k.indexOf(monthPrefix) === 0 || k2.indexOf(monthPrefix) === 0)) {
    return true;
  }
  return false;
}
