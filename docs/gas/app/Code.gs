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
    MASTER: 'マスターデータ',
    STORES: 'マスターデータ',
    EMPLOYEES: 'マスターデータ',
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

var MASTER_HEADERS = [
  '店舗ID', '店舗名', 'エリア', '社員コード', '氏名', 'メール', '雇用区分', '勤務時間'
];

var HIDDEN_SHEETS = [
  '週間固定', 'シフト', 'シフトメモ', '権限', '設定', '同期ログ', 'バイバイ貼り付け'
];

var OBSOLETE_SHEETS = [
  '使い方', '店舗マスタ', '従業員マスタ',
  '従業員_店舗別ビュー', '店舗ID早見'
];

/**
 * スプシ表示用の日本語ヘッダ（英語キー → 日本語）
 * コード内は英語キーのまま参照する。
 */
var HEADER_JA = {
  store_id: '店舗ID',
  store_name: '店舗名',
  area: 'エリア',
  is_active: '有効',
  store_active: '店舗有効',
  sort_order: '表示順',
  note: '備考',
  employee_id: '従業員ID',
  name: '氏名',
  name_key: '氏名キー',
  email: 'メール',
  bye_code: '社員コード',
  primary_store_id: '主所属店舗',
  employment_type: '雇用区分',
  calendar_sync: 'カレンダー同期',
  memo_offset: 'メモ行オフセット',
  work_hours: '勤務時間',
  shift_id: 'シフトID',
  date: '日付',
  status: '区分',
  leave_code: '休日休暇コード',
  start_time: '開始',
  end_time: '終了',
  break_minutes: '休憩分',
  source: '入力元',
  updated_at: '更新日時',
  updated_by: '更新者',
  memo_id: 'メモID',
  kind: '種類',
  title: '件名',
  body: '内容',
  weekly_id: '週間ID',
  weekday: '曜日',
  role: '役割',
  key: 'キー',
  value: '値',
  logged_at: '記録日時',
  type: '種類',
  target: '対象',
  range: '範囲',
  result: '結果',
  message: 'メッセージ'
};

/** 日本語／英語ヘッダ → 英語キー */
var HEADER_ALIAS = (function () {
  var map = {};
  Object.keys(HEADER_JA).forEach(function (en) {
    map[en] = en;
    map[HEADER_JA[en]] = en;
  });
  return map;
})();

/** 旧 gas-kyodo SHOPS「ひばりが丘」＋スクショ確認のスタッフ（社員コードは文字列） */
var HIBARI_STAFF = [
  { bye_code: '030396', name: '津田 加奈', employment_type: '社員', work_hours: '' },
  { bye_code: '030400', name: '吉田 薫理', employment_type: '社員', work_hours: '' },
  { bye_code: '30204', name: '黒川 沙由美', employment_type: 'パート', work_hours: 4 },
  { bye_code: '30331', name: '徳重 翠', employment_type: '社員', work_hours: '' },
  { bye_code: '303523', name: '大野 雅代', employment_type: '社員', work_hours: '' },
  { bye_code: '30469', name: '手塚 柚衣', employment_type: '社員', work_hours: '' }
];

var HIBARI_STORE = {
  store_id: 'S002',
  store_name: 'ひばりが丘',
  area: '第7エリア'
};

function onOpen() {
  hideSystemSheets_();
  SpreadsheetApp.getUi()
    .createMenu('シフト基盤')
    .addItem('マスターデータを見やすくする', 'menuSimplifyMaster')
    .addItem('マスターデータに統合（不要シート削除）', 'menuRebuildMasterData')
    .addItem('ひばりが丘スタッフを投入（不足分）', 'menuSeedHibariStaff')
    .addItem('ひばりが丘9月シフトを投入（スクショ反映）', 'menuSeedHibariSep2026Shifts')
    .addItem('週間を診断＆パイロット2店を同期', 'menuSyncPilotWeekly')
    .addToUi();
}

/**
 * ひばりが丘スタッフをマスターデータへ投入（既存の同社員コードは上書きしない）
 */
function menuSeedHibariStaff() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'ひばりが丘スタッフを投入',
    'マスターデータにひばりが丘スタッフ（6名）を追加します。\n' +
      '同じ社員コードが既にある行はスキップします。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = seedHibariStaff_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function seedHibariStaff_() {
  var sh = mustEmployeesSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['name', 'bye_code']);
  if (map.store_id == null && map.primary_store_id == null) {
    throw new Error('店舗ID列がありません。メニュー「マスターデータを見やすくする」を先に実行してください。');
  }
  var data = sh.getDataRange().getValues();
  var existing = {};
  for (var r = 1; r < data.length; r++) {
    var code = String(
      data[r][map.bye_code != null ? map.bye_code : map.employee_id] ||
        data[r][map.employee_id] ||
        ''
    ).trim();
    if (code) existing[code] = true;
  }

  var added = 0;
  var skipped = 0;
  var colCount = headers.length;
  HIBARI_STAFF.forEach(function (emp) {
    var code = String(emp.bye_code).trim();
    if (existing[code]) {
      skipped++;
      return;
    }
    var row = new Array(colCount).fill('');
    if (map.store_id != null) row[map.store_id] = HIBARI_STORE.store_id;
    if (map.primary_store_id != null) row[map.primary_store_id] = HIBARI_STORE.store_id;
    if (map.store_name != null) row[map.store_name] = HIBARI_STORE.store_name;
    if (map.area != null) row[map.area] = HIBARI_STORE.area;
    if (map.employee_id != null) row[map.employee_id] = code;
    if (map.bye_code != null) row[map.bye_code] = code;
    row[map.name] = emp.name;
    if (map.name_key != null) row[map.name_key] = String(emp.name).replace(/\s+/g, '');
    if (map.employment_type != null) row[map.employment_type] = emp.employment_type;
    if (map.work_hours != null && emp.work_hours !== '') row[map.work_hours] = emp.work_hours;
    if (map.is_active != null) row[map.is_active] = true;
    if (map.store_active != null) row[map.store_active] = true;
    sh.appendRow(row);
    var last = sh.getLastRow();
    if (map.bye_code != null) sh.getRange(last, map.bye_code + 1).setNumberFormat('@').setValue(code);
    if (map.employee_id != null && map.employee_id !== map.bye_code) {
      sh.getRange(last, map.employee_id + 1).setNumberFormat('@').setValue(code);
    }
    existing[code] = true;
    added++;
  });

  hideSystemSheets_();
  return (
    'ひばりが丘（S002）\n' +
    '✓ 追加 ' + added + '名\n' +
    '✓ スキップ（既存） ' + skipped + '名\n' +
    '対象: 津田・吉田・黒川・徳重・大野・手塚'
  );
}

/**
 * 現場シフト表スクショ（sayumi/midori/hana/kaori/masayo/yui）を 2026-09 に投入。
 * 画像OCRベースのため、細部は現場で微修正前提。
 */
var HIBARI_SEP2026_SHIFTS = {
  // 黒川 沙由美（パート）
  '30204': [
    '10-16','公休','10-16','10-16','10-16','公休','10-16','11-17','9-15','10-16',
    '有休','公休','公休','10-16','10-16','13-19','10-16','10-16','10-16','公休',
    '公休','公休','公休','公休','10-16','公休','公休','公休','10-16','11-17'
  ],
  // 徳重 翠
  '30331': [
    '9-18','9-18','公休','12:30-21:30','8:30-17:30','9-18','9-18','公休','9-18','有休',
    '公休','8:30-17:30','8:30-17:30','公休','公休','11-20','13-22','12:30-21:30','8:30-17:30','公休',
    '公休','8:30-17:30','8:30-17:30','13-22','公休','8:30-17:30','公休','公休','9-18',''
  ],
  // 津田 加奈（「確定」は勤務・09:00-18:00 仮置き）
  '030396': [
    '公休','確定','確定','12:30-21:30','9-18','9-18','公休','13-22','確定','確定',
    '公休','公休','公休','9-18','13-22','確定','確定','公休','公休','9-18',
    '9-18','公休','確定','確定','12:30-21:30','公休','公休','9-18','9-18','確定'
  ],
  // 吉田 薫理
  '030400': [
    '13-22','公休','13-22','公休','9-18','公休','公休','有休','有休','13-22',
    '公休','9-18','9-18','11-20','公休','9-18','9-18','公休','9-18','公休',
    '8:30-17:30','9-18','9-18','9-18','公休','9-18','9-18','11-20','13-22','公休'
  ],
  // 大野 雅代
  '303523': [
    '公休','17-22','公休','公休','公休','8:30-17','公休','公休','17-22','公休',
    '公休','公休','有休','公休','公休','17-22','公休','公休','公休','8:30-17',
    '11-16','公休','公休','公休','公休','公休','8:30-17','公休','公休','17-22'
  ],
  // 手塚 柚衣
  '30469': [
    '12-19','10-17','公休','13-20','公休','9-16','12-19','10-17','10-17','公休',
    '公休','公休','公休','15-22','12-19','10-17','公休','13-20','公休','公休',
    '公休','10-17','公休','公休','13-20','公休','公休','15-22','10-17','10-17'
  ]
};

function menuSeedHibariSep2026Shifts() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'ひばりが丘 2026-09 シフト投入',
    'スタッフ6名の9月シフトをスプシに書き込みます。\n' +
      '・先にスタッフ投入も実行します（不足分のみ）\n' +
      '・ひばりが丘×2026-09×対象6名の既存シフト行は置き換えます\n' +
      '・スクショOCRベースです。時間の細部はWebで直してください\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = seedHibariStaff_() + '\n\n' + seedHibariMonthShifts_('2026-09', HIBARI_SEP2026_SHIFTS);
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

/** clasp / 診断用: 店舗ごとの週間固定を返す */
function dumpWeeklySchedules() {
  var stores = listAllStores_();
  var out = [];
  stores.forEach(function (s) {
    var weekly = readWeeklyForStore_(s.store_id);
    var emps = listEmployeesDetailed_(s.store_id);
    out.push({
      store_id: s.store_id,
      store_name: s.store_name,
      employee_count: emps.length,
      employees: emps.map(function (e) {
        return { employee_id: e.employee_id, name: e.name, bye_code: e.bye_code, employment_type: e.employment_type };
      }),
      weekly_count: weekly.length,
      weekly: weekly
    });
  });
  return { ok: true, stores: out };
}

/**
 * 9月スクショ多数決ベースのひばり週間テンプレ（曜日: 0=日 … 6=土）
 * 同数のときは休み寄り／週末休みを優先したうえで、現場で直す前提。
 */
var HIBARI_WEEKLY_TEMPLATE = {
  '30204': [ // 黒川 沙由美（パート・日中）
    { status: 'off' },
    { status: 'work', start_time: '10:00', end_time: '16:00' },
    { status: 'work', start_time: '10:00', end_time: '16:00' },
    { status: 'work', start_time: '10:00', end_time: '16:00' },
    { status: 'work', start_time: '10:00', end_time: '16:00' },
    { status: 'work', start_time: '10:00', end_time: '16:00' },
    { status: 'off' }
  ],
  '30331': [ // 徳重 翠
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'off' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'off' },
    { status: 'work', start_time: '12:30', end_time: '21:30' },
    { status: 'work', start_time: '08:30', end_time: '17:30' }
  ],
  '030396': [ // 津田 加奈
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'work', start_time: '13:00', end_time: '22:00' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'work', start_time: '12:30', end_time: '21:30' },
    { status: 'off' }
  ],
  '030400': [ // 吉田 薫理
    { status: 'off' },
    { status: 'work', start_time: '11:00', end_time: '20:00' },
    { status: 'work', start_time: '13:00', end_time: '22:00' },
    { status: 'off' },
    { status: 'work', start_time: '09:00', end_time: '18:00' },
    { status: 'off' },
    { status: 'work', start_time: '09:00', end_time: '18:00' }
  ],
  '303523': [ // 大野 雅代（少なめ・水夕・日昼）
    { status: 'work', start_time: '08:30', end_time: '17:00' },
    { status: 'off' },
    { status: 'off' },
    { status: 'work', start_time: '17:00', end_time: '22:00' },
    { status: 'off' },
    { status: 'off' },
    { status: 'off' }
  ],
  '30469': [ // 手塚 柚衣
    { status: 'off' },
    { status: 'work', start_time: '15:00', end_time: '22:00' },
    { status: 'work', start_time: '10:00', end_time: '17:00' },
    { status: 'work', start_time: '10:00', end_time: '17:00' },
    { status: 'off' },
    { status: 'work', start_time: '13:00', end_time: '20:00' },
    { status: 'off' }
  ]
};

/** 経堂デフォルト: 月〜金 12:00-21:00 / 土日休み */
function kyodoDefaultWeeklyDays_() {
  return [
    { status: 'off' },
    { status: 'work', start_time: '12:00', end_time: '21:00' },
    { status: 'work', start_time: '12:00', end_time: '21:00' },
    { status: 'work', start_time: '12:00', end_time: '21:00' },
    { status: 'work', start_time: '12:00', end_time: '21:00' },
    { status: 'work', start_time: '12:00', end_time: '21:00' },
    { status: 'off' }
  ];
}

function menuSyncPilotWeekly() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'パイロット2店の週間同期',
    '経堂・ひばりが丘の週間固定を整え、診断シートに「変更前」を残します。\n\n' +
      '・ひばり: 9月シフト表から作ったテンプレで上書き\n' +
      '・経堂: 2026-09の月間があれば多数決、無ければ月〜金12-21／土日休\n' +
      '・既存の週間は無効化してから差し替え\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = syncPilotWeekly_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function syncPilotWeekly_() {
  seedHibariStaff_();
  var before = dumpWeeklySchedules();
  writeWeeklyDiagnosisSheet_(before, '変更前');

  var hibariItems = weeklyItemsFromTemplate_('S002', HIBARI_WEEKLY_TEMPLATE);
  replaceWeeklyForStore_('S002', hibariItems, 'weekly-sync');

  var kyodoFromMonth = buildWeeklyItemsFromMonth_('S001', '2026-09');
  var kyodoItems = kyodoFromMonth.items.length
    ? kyodoFromMonth.items
    : weeklyItemsFromDefaultStore_('S001', kyodoDefaultWeeklyDays_());
  replaceWeeklyForStore_('S001', kyodoItems, 'weekly-sync');

  var after = dumpWeeklySchedules();
  writeWeeklyDiagnosisSheet_(after, '変更後');

  return (
    '週間同期完了\n' +
    '✓ ひばりが丘: テンプレ ' + hibariItems.length + '行\n' +
    '✓ 経堂: ' + (kyodoFromMonth.items.length ? '9月から多数決' : 'デフォルト月〜金') +
    ' ' + kyodoItems.length + '行\n' +
    '✓ 診断シート「週間診断」に変更前／後を出力'
  );
}

function weeklyItemsFromTemplate_(storeId, templateByEmp) {
  var items = [];
  Object.keys(templateByEmp || {}).forEach(function (eid) {
    var days = templateByEmp[eid] || [];
    for (var wd = 0; wd < 7; wd++) {
      var cell = days[wd] || { status: 'off' };
      items.push({
        employee_id: eid,
        weekday: wd,
        status: cell.status || 'off',
        start_time: cell.start_time || '',
        end_time: cell.end_time || '',
        break_minutes: ''
      });
    }
  });
  return items;
}

function weeklyItemsFromDefaultStore_(storeId, daysTemplate) {
  var emps = listEmployeesDetailed_(storeId);
  var items = [];
  emps.forEach(function (e) {
    var eid = String(e.employee_id || e.bye_code || '').trim();
    if (!eid) return;
    for (var wd = 0; wd < 7; wd++) {
      var cell = daysTemplate[wd] || { status: 'off' };
      items.push({
        employee_id: eid,
        weekday: wd,
        status: cell.status || 'off',
        start_time: cell.start_time || '',
        end_time: cell.end_time || '',
        break_minutes: ''
      });
    }
  });
  return items;
}

function buildWeeklyItemsFromMonth_(storeId, yearMonth) {
  var ym = String(yearMonth || '').trim();
  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var map = headerIndexMap_(getHeaders_(sh));
  var values = getDataRows_(sh);
  var byEmpWd = {};
  var hit = 0;
  values.forEach(function (r) {
    if (String(r[map.store_id] || '') !== storeId) return;
    var d0 = normalizeDate_(r[map.date]);
    if (!d0 || d0.substring(0, 7) !== ym) return;
    var eid = String(r[map.employee_id] || '').trim();
    if (!eid) return;
    var status = String(r[map.status || ''] || 'undef');
    if (status === 'undef' || status === 'pto' || status === 'absent') return;
    hit++;
    var parts = d0.split('-').map(Number);
    var wd = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    var key = eid + '__' + wd;
    if (!byEmpWd[key]) byEmpWd[key] = [];
    byEmpWd[key].push({
      status: status === 'work' ? 'work' : 'off',
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time])
    });
  });

  if (!hit) return { items: [], sample_days: 0 };

  var emps = listEmployeesDetailed_(storeId);
  var items = [];
  emps.forEach(function (e) {
    var eid = String(e.employee_id || e.bye_code || '').trim();
    if (!eid) return;
    for (var wd = 0; wd < 7; wd++) {
      var list = byEmpWd[eid + '__' + wd] || [];
      var picked = majorityWeeklyCell_(list);
      items.push({
        employee_id: eid,
        weekday: wd,
        status: picked.status,
        start_time: picked.start_time,
        end_time: picked.end_time,
        break_minutes: ''
      });
    }
  });
  return { items: items, sample_days: hit };
}

function majorityWeeklyCell_(list) {
  if (!list.length) return { status: 'off', start_time: '', end_time: '' };
  var work = 0;
  var off = 0;
  var timeCount = {};
  list.forEach(function (c) {
    if (c.status === 'work') {
      work++;
      var t = (c.start_time || '') + '-' + (c.end_time || '');
      if (c.start_time && c.end_time) timeCount[t] = (timeCount[t] || 0) + 1;
    } else off++;
  });
  if (work > off) {
    var best = '';
    var bestN = 0;
    Object.keys(timeCount).forEach(function (t) {
      if (timeCount[t] > bestN) {
        bestN = timeCount[t];
        best = t;
      }
    });
    var se = best.split('-');
    return {
      status: 'work',
      start_time: se[0] || '12:00',
      end_time: se[1] || '21:00'
    };
  }
  return { status: 'off', start_time: '', end_time: '' };
}

function replaceWeeklyForStore_(storeId, items, actor) {
  ensureWeeklySheet_();
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
  var rows = [];
  (items || []).forEach(function (it, idx) {
    var empId = String(it.employee_id || '').trim();
    var wd = Number(it.weekday);
    var status = String(it.status || 'off');
    if (!empId || isNaN(wd) || wd < 0 || wd > 6) return;
    if (SHIFT_APP.STATUS.indexOf(status) < 0) status = 'off';
    var start = String(it.start_time || '').trim();
    var end = String(it.end_time || '').trim();
    if (status === 'work') {
      if (!isHm_(start)) start = '12:00';
      if (!isHm_(end)) end = '21:00';
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
    if (map.break_minutes != null) row[map.break_minutes] = '';
    row[map.is_active] = true;
    if (map.updated_at != null) row[map.updated_at] = now;
    if (map.updated_by != null) row[map.updated_by] = actor || 'system';
    rows.push(row);
  });
  if (rows.length) writeSheetRows_(sh, sh.getLastRow() + 1, rows);
  return rows.length;
}

function writeWeeklyDiagnosisSheet_(dump, label) {
  var ss = ss_();
  var name = '週間診断';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (label === '変更前') sh.clear();

  var startRow = Math.max(sh.getLastRow() + 1, 1);
  var lines = [[label, Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')]];
  lines.push(['店舗', '氏名', '社員コード', '日', '月', '火', '水', '木', '金', '土']);
  (dump.stores || []).forEach(function (s) {
    var byEmp = {};
    (s.weekly || []).forEach(function (w) {
      var id = String(w.employee_id || '');
      if (!byEmp[id]) byEmp[id] = {};
      byEmp[id][Number(w.weekday)] = w;
    });
    (s.employees || []).forEach(function (e) {
      var id = String(e.employee_id || e.bye_code || '');
      var row = [s.store_name, e.name, id];
      for (var wd = 0; wd < 7; wd++) {
        var cell = (byEmp[id] || {})[wd];
        if (!cell || cell.status === 'off') row.push('×');
        else if (cell.status === 'work') row.push((cell.start_time || '') + '-' + (cell.end_time || ''));
        else row.push(cell.status || '');
      }
      lines.push(row);
    });
    if (!(s.employees || []).length) {
      lines.push([s.store_name, '(従業員なし)', '', '', '', '', '', '', '', '']);
    }
  });
  sh.getRange(startRow, 1, lines.length, 10).setValues(lines);
  try { sh.showSheet(); } catch (e) {}
}

function parseHibariShiftCell_(raw) {
  var text = String(raw == null ? '' : raw).trim().replace(/\s+/g, '');
  if (!text) return { status: 'undef', start_time: '', end_time: '', leave_code: '', memo: '' };
  if (text === '公休' || text === '×' || text === 'x' || text === 'X') {
    return { status: 'off', start_time: '', end_time: '', leave_code: '', memo: '' };
  }
  if (text === '有休' || text === '有給') {
    return { status: 'pto', start_time: '', end_time: '', leave_code: 61, memo: '' };
  }
  if (text === '確定' || text === '終日') {
    return { status: 'work', start_time: '09:00', end_time: '18:00', leave_code: '', memo: text };
  }
  var m = text.match(/^(\d{1,2})(?::(\d{2}))?[-~〜](\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    var sh = ('0' + Number(m[1])).slice(-2) + ':' + (m[2] || '00');
    var eh = ('0' + Number(m[3])).slice(-2) + ':' + (m[4] || '00');
    return { status: 'work', start_time: sh, end_time: eh, leave_code: '', memo: '' };
  }
  return { status: 'undef', start_time: '', end_time: '', leave_code: '', memo: text };
}

function seedHibariMonthShifts_(yearMonth, byEmpDays) {
  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式です。');
  var storeId = HIBARI_STORE.store_id;
  var staffSummary = seedHibariStaff_();

  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var ensured = ensureLeaveCodeHeader_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, [
    'shift_id', 'date', 'employee_id', 'store_id', 'status',
    'start_time', 'end_time', 'source', 'updated_at', 'updated_by'
  ]);

  var empIds = Object.keys(byEmpDays || {});
  var data = sh.getDataRange().getValues();
  var deleteRows = [];
  for (var r = data.length - 1; r >= 1; r--) {
    var sid = String(data[r][map.store_id] || '').trim();
    var eid = String(data[r][map.employee_id] || '').trim();
    var d0 = normalizeDate_(data[r][map.date]);
    if (sid !== storeId) continue;
    if (empIds.indexOf(eid) < 0) continue;
    if (!d0 || d0.substring(0, 7) !== ym) continue;
    deleteRows.push(r + 1);
  }
  for (var di = 0; di < deleteRows.length; di++) {
    sh.deleteRow(deleteRows[di]);
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var toAppend = [];
  var memoItems = [];
  var written = 0;
  var blank = 0;

  empIds.forEach(function (eid) {
    var days = byEmpDays[eid] || [];
    for (var i = 0; i < days.length; i++) {
      var day = i + 1;
      var date = ym + '-' + ('0' + day).slice(-2);
      var parsed = parseHibariShiftCell_(days[i]);
      if (parsed.status === 'undef' && !parsed.memo) {
        blank++;
        continue;
      }
      var row = new Array(headers.length).fill('');
      row[map.shift_id] = 'SH' + stamp + '-' + eid + '-' + day;
      row[map.date] = date;
      row[map.employee_id] = eid;
      row[map.store_id] = storeId;
      row[map.status] = parsed.status;
      if (map.leave_code != null) row[map.leave_code] = parsed.leave_code;
      row[map.start_time] = parsed.start_time;
      row[map.end_time] = parsed.end_time;
      if (map.source != null) row[map.source] = 'import';
      if (map.updated_at != null) row[map.updated_at] = now;
      if (map.updated_by != null) row[map.updated_by] = 'hibari-seed';
      toAppend.push(row);
      written++;
      if (parsed.memo) {
        memoItems.push({
          memo_id: '',
          date: date,
          employee_id: eid,
          body: parsed.memo,
          kind: 'note'
        });
      }
    }
  });

  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    writeSheetRows_(sh, startRow, toAppend);
  }

  var memoSaved = 0;
  if (memoItems.length) {
    try {
      var msh = mustSheet_(SHIFT_APP.SHEETS.MEMOS);
      var mheaders = getHeaders_(msh);
      var mmap = headerIndexMap_(mheaders);
      requireHeaders_(mmap, ['memo_id', 'date', 'employee_id', 'store_id', 'kind', 'body']);
      var mdata = msh.getDataRange().getValues();
      for (var mr = mdata.length - 1; mr >= 1; mr--) {
        var msid = String(mdata[mr][mmap.store_id] || '').trim();
        var meid = String(mdata[mr][mmap.employee_id] || '').trim();
        var md0 = normalizeDate_(mdata[mr][mmap.date]);
        if (msid !== storeId) continue;
        if (empIds.indexOf(meid) < 0) continue;
        if (!md0 || md0.substring(0, 7) !== ym) continue;
        msh.deleteRow(mr + 1);
      }
      var memoRows = memoItems.map(function (it, idx) {
        var row = new Array(mheaders.length).fill('');
        row[mmap.memo_id] = 'MM' + stamp + '-' + it.employee_id + '-' + idx;
        row[mmap.date] = it.date;
        row[mmap.employee_id] = it.employee_id;
        row[mmap.store_id] = storeId;
        row[mmap.kind] = it.kind || 'note';
        row[mmap.body] = it.body;
        if (mmap.updated_at != null) row[mmap.updated_at] = now;
        if (mmap.updated_by != null) row[mmap.updated_by] = 'hibari-seed';
        return row;
      });
      writeSheetRows_(msh, msh.getLastRow() + 1, memoRows);
      memoSaved = memoRows.length;
    } catch (e) {
      memoSaved = 0;
    }
  }

  hideSystemSheets_();
  return (
    'ひばりが丘シフト投入 ' + ym + '\n' +
    '✓ シフト行 ' + written + '\n' +
    '✓ 空欄スキップ ' + blank + '\n' +
    '✓ 削除した旧行 ' + deleteRows.length + '\n' +
    '✓ メモ（確定など） ' + memoSaved + '\n' +
    staffSummary
  );
}

function menuSimplifyMaster() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'マスターデータを見やすくする',
    '列を「店舗ID・店舗名・エリア・社員コード・氏名・メール・雇用区分・勤務時間」だけにします。\n' +
      'ほかのシートは非表示にします。実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = simplifyMasterVisible_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function rebuildMasterData() {
  return rebuildMasterData_();
}

function menuRebuildMasterData() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'マスターデータに統合',
    '店舗マスタと従業員マスタを「マスターデータ」1枚にまとめ、\n' +
      '使い方・店舗別ビュー・店舗ID早見など不要シートを削除します。\n' +
      'シフト・権限などのデータは残します。実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = rebuildMasterData_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function menuMigrateHeadersJa() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'ヘッダを日本語に変換',
    '各シート1行目の英語ヘッダを日本語に置き換えます。\nデータ行はそのまま残ります。実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = migrateHeadersToJapanese_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

/**
 * 既存スプシの英語ヘッダ → 日本語へ一括変換
 */
function migrateHeadersToJapanese_() {
  var ss = ss_();
  var sheetNames = [
    SHIFT_APP.SHEETS.MASTER,
    SHIFT_APP.SHEETS.SHIFTS,
    SHIFT_APP.SHEETS.MEMOS,
    SHIFT_APP.SHEETS.WEEKLY,
    SHIFT_APP.SHEETS.ACL,
    SHIFT_APP.SHEETS.SETTINGS,
    SHIFT_APP.SHEETS.LOG
  ];
  var lines = [];
  sheetNames.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      lines.push('スキップ（未作成）: ' + name);
      return;
    }
    var headers = getHeaders_(sh);
    if (!headers.length) {
      lines.push('スキップ（空）: ' + name);
      return;
    }
    var next = headers.map(function (h) {
      var key = HEADER_ALIAS[h] || h;
      return HEADER_JA[key] || h;
    });
    sh.getRange(1, 1, 1, next.length).setValues([next]);
    lines.push('✓ ' + name);
  });
  return lines.join('\n');
}

/**
 * 店舗マスタ＋従業員マスタ → マスターデータ に統合し、不要シートを削除
 */
function rebuildMasterData_() {
  var ss = ss_();
  var storeSh = ss.getSheetByName('店舗マスタ') || ss.getSheetByName('マスターデータ');
  var empSh = ss.getSheetByName('従業員マスタ') || ss.getSheetByName('マスターデータ');
  if (!storeSh && !empSh) throw new Error('店舗マスタ／従業員マスタ／マスターデータが見つかりません。');

  var stores = readSheetObjects_(storeSh);
  var emps = empSh ? readSheetObjects_(empSh) : [];

  var storeById = {};
  stores.forEach(function (r) {
    var id = String(r.store_id || r.primary_store_id || '').trim();
    if (!id || isKeyValue_(id)) return;
    if (!storeById[id]) {
      var active = r.store_active != null && r.store_active !== ''
        ? r.store_active
        : (r.employee_id ? true : r.is_active);
      storeById[id] = {
        store_id: id,
        store_name: String(r.store_name || '').trim(),
        area: String(r.area || '').trim(),
        store_active: active === '' || active == null ? true : active,
        sort_order: r.sort_order === '' || r.sort_order == null ? 10 : Number(r.sort_order)
      };
    }
  });
  emps.forEach(function (r) {
    var id = String(r.primary_store_id || r.store_id || '').trim();
    if (!id || isKeyValue_(id)) return;
    if (!storeById[id]) {
      storeById[id] = {
        store_id: id,
        store_name: String(r.store_name || '').trim(),
        area: String(r.area || '').trim(),
        store_active: true,
        sort_order: 10
      };
    }
  });

  var empRows = [];
  var idMap = {};
  emps.forEach(function (r) {
    var code = String(r.bye_code || r.employee_id || '').trim();
    var name = String(r.name || '').trim();
    if (!code || !name || isKeyValue_(code)) return;
    var oldId = String(r.employee_id || '').trim();
    if (oldId && oldId !== code) idMap[oldId] = code;
    var sid = String(r.primary_store_id || r.store_id || '').trim();
    var st = storeById[sid] || { store_id: sid, store_name: String(r.store_name || ''), area: String(r.area || '') };
    empRows.push([
      st.store_id,
      st.store_name || String(r.store_name || ''),
      st.area || String(r.area || ''),
      code,
      name,
      String(r.email || ''),
      String(r.employment_type || '社員'),
      r.work_hours === '' || r.work_hours == null ? '' : r.work_hours
    ]);
  });

  empRows.sort(function (a, b) {
    var c = String(a[1]).localeCompare(String(b[1]), 'ja');
    if (c) return c;
    return String(a[4]).localeCompare(String(b[4]), 'ja');
  });

  var master = ss.getSheetByName('マスターデータ');
  if (!master) master = ss.insertSheet('マスターデータ', 0);
  resetMasterSheet_(master);
  master.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  if (empRows.length) {
    master.getRange(2, 4, empRows.length, 1).setNumberFormat('@');
    master.getRange(2, 1, empRows.length, MASTER_HEADERS.length).setValues(empRows);
  }
  applyMasterLayout_(master);
  remapEmployeeIds_(idMap);
  hideSystemSheets_();
  ss.setActiveSheet(master);
  ss.moveActiveSheet(1);

  var lines = ['✓ マスターデータ ' + empRows.length + '行'];
  OBSOLETE_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    ss.deleteSheet(sh);
    lines.push('削除: ' + name);
  });
  lines.push('✓ システムシートを非表示');
  return lines.join('\n');
}

function simplifyMasterVisible_() {
  var ss = ss_();
  var master = ss.getSheetByName('マスターデータ');
  if (!master) throw new Error('マスターデータが見つかりません。');
  var rows = readSheetObjects_(master);
  var idMap = {};
  var out = [];
  rows.forEach(function (r) {
    var code = String(r.bye_code || r.employee_id || '').trim();
    var name = String(r.name || '').trim();
    if (!code || !name || isKeyValue_(code)) return;
    var oldId = String(r.employee_id || '').trim();
    if (oldId && oldId !== code) idMap[oldId] = code;
    out.push([
      String(r.store_id || r.primary_store_id || ''),
      String(r.store_name || ''),
      String(r.area || ''),
      code,
      name,
      String(r.email || ''),
      String(r.employment_type || '社員'),
      r.work_hours === '' || r.work_hours == null ? '' : r.work_hours
    ]);
  });
  out.sort(function (a, b) {
    var c = String(a[1]).localeCompare(String(b[1]), 'ja');
    if (c) return c;
    return String(a[4]).localeCompare(String(b[4]), 'ja');
  });
  resetMasterSheet_(master);
  master.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  if (out.length) {
    master.getRange(2, 4, out.length, 1).setNumberFormat('@');
    master.getRange(2, 1, out.length, MASTER_HEADERS.length).setValues(out);
  }
  applyMasterLayout_(master);
  var remapped = remapEmployeeIds_(idMap);
  hideSystemSheets_();
  ss.setActiveSheet(master);
  return '✓ マスターデータ ' + out.length + '行\n✓ シフト等の社員コード付け替え ' + remapped + '件\n✓ ほかのシートを非表示';
}

function remapEmployeeIds_(idMap) {
  var keys = Object.keys(idMap || {});
  if (!keys.length) return 0;
  var count = 0;
  ['シフト', 'シフトメモ', '週間固定'].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) return;
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.employee_id == null) return;
    var last = sh.getLastRow();
    if (last < 2) return;
    var range = sh.getRange(2, map.employee_id + 1, last - 1, 1);
    var vals = range.getValues();
    for (var i = 0; i < vals.length; i++) {
      var cur = String(vals[i][0] || '').trim();
      if (idMap[cur]) {
        vals[i][0] = idMap[cur];
        count++;
      }
    }
    range.setNumberFormat('@');
    range.setValues(vals);
  });
  return count;
}

function writeSheetRows_(sh, startRow, values) {
  if (!values || !values.length) return;
  var numRows = values.length;
  var numCols = values[0].length;
  sh.getRange(startRow, 1, numRows, numCols).setValues(values);
}

function hideSystemSheets_() {
  var ss = ss_();
  HIDDEN_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && !sh.isSheetHidden()) sh.hideSheet();
  });
  var master = ss.getSheetByName('マスターデータ');
  if (master && master.isSheetHidden()) master.showSheet();
}

function readSheetObjects_(sh) {
  if (!sh) return [];
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  var values = getDataRows_(sh);
  return values.map(function (row) {
    var obj = {};
    Object.keys(map).forEach(function (k) {
      if (HEADER_JA[k] || k === 'store_active' || k === 'primary_store_id' || k === 'work_hours') {
        obj[k] = row[map[k]];
      }
    });
    return obj;
  }).filter(function (o) {
    var id = String(o.employee_id || o.store_id || o.primary_store_id || '');
    return id && !isKeyValue_(id);
  });
}

function isKeyValue_(v) {
  return /^(employee_id|store_id|primary_store_id|name|店舗ID|従業員ID)$/i.test(String(v || '').trim());
}

function resetMasterSheet_(sh) {
  var filter = sh.getFilter();
  if (filter) filter.remove();
  var all = sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), 20));
  all.clearDataValidations();
  all.clearNote();
  all.clear();
}

function applyMasterLayout_(sh) {
  var extra = sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), 20));
  extra.clearDataValidations();
  extra.clearNote();

  var cols = MASTER_HEADERS.length;
  sh.setTabColor('#4a86e8');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 28);
  var header = sh.getRange(1, 1, 1, cols);
  header.setBackground('#1f4e79').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  [100, 130, 120, 110, 140, 260, 100, 90].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 100), cols).setFontFamily('Meiryo');
  var last = Math.max(sh.getLastRow(), 2);
  sh.getRange(2, 1, last, cols).setVerticalAlignment('middle').setFontSize(10);
  sh.getRange(2, 4, 500, 1).setNumberFormat('@');
  var empRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['社員', 'パート', 'その他'], true).setAllowInvalid(true).build();
  sh.getRange(2, 7, 500, 1).setDataValidation(empRule);
  var existing = sh.getFilter();
  if (existing) existing.remove();
  sh.getRange(1, 1, last, cols).createFilter();
  header.setNote('1行＝1人。人の識別は社員コード。メールがあればカレンダー同期します。');
}

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

  var sh = mustEmployeesSheet_();
  var map = ensureHeaderColumn_(sh, 'work_hours');
  requireHeaders_(map, ['name', 'bye_code', 'primary_store_id']);
  var headers = getHeaders_(sh);
  map = headerIndexMap_(headers);

  var employeeId = byeCode;
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;

  for (var r = 1; r < data.length; r++) {
    var code = String(data[r][map.bye_code] != null ? data[r][map.bye_code] : data[r][map.employee_id] || '');
    if (code === byeCode || String(data[r][map.employee_id] || '') === String(p.employee_id || '')) {
      if (String(data[r][map.primary_store_id] || data[r][map.store_id] || '') === storeId || !storeId) {
        rowIndex = r + 1;
        break;
      }
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

  // 社員でも9時間とは限らないため、区分に関わらず work_hours を保存する
  var workHours = '';
  var wh = Number(p.work_hours);
  if (!isNaN(wh) && wh > 0) {
    workHours = wh;
  } else if (p.work_hours == null) {
    // 未指定なら既存の値を残す
    if (map.work_hours != null && rowVals[map.work_hours] !== '' && rowVals[map.work_hours] != null) {
      workHours = Number(rowVals[map.work_hours]) || '';
    }
  }
  // アルバイトは空を許さず既定4時間
  if (workHours === '' && isPart) workHours = 4;

  if (map.employee_id != null) rowVals[map.employee_id] = employeeId;
  rowVals[map.name] = name;
  if (map.bye_code != null) rowVals[map.bye_code] = byeCode;
  if (map.store_id != null) rowVals[map.store_id] = storeId;
  if (map.primary_store_id != null) rowVals[map.primary_store_id] = storeId;
  var storeInfo = listAllStores_().filter(function (s) { return s.store_id === storeId; })[0];
  if (storeInfo) {
    if (map.store_name != null && !rowVals[map.store_name]) rowVals[map.store_name] = storeInfo.store_name;
    if (map.area != null && !rowVals[map.area]) rowVals[map.area] = storeInfo.area;
  }
  if (map.employment_type != null) {
    rowVals[map.employment_type] = sheetEmpType;
  }
  if (map.work_hours != null) {
    rowVals[map.work_hours] = workHours === '' ? '' : workHours;
  }

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

  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][map.employee_id] || data[r][map.bye_code] || '') !== id) continue;
    if (String(data[r][map.primary_store_id] || data[r][map.store_id] || '') !== String(storeId)) {
      throw new Error('店舗が一致しません。');
    }
    if (map.is_active != null) {
      sh.getRange(r + 1, map.is_active + 1).setValue(false);
    } else {
      sh.deleteRow(r + 1);
    }
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

function ensureLeaveCodeHeader_(sh) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  if (map.leave_code != null) return { headers: headers, map: map };
  var col = headers.length + 1;
  sh.getRange(1, col).setValue(HEADER_JA.leave_code);
  headers.push(HEADER_JA.leave_code);
  map = headerIndexMap_(headers);
  return { headers: headers, map: map };
}

function leaveCodeStatus_(code) {
  var n = Number(code);
  if (!n || n === 999) return '';
  if ([11, 12, 21, 22, 31, 32, 33, 34, 35, 41, 42, 43, 44, 45].indexOf(n) >= 0) return 'work';
  if ([61, 62, 63, 64, 65, 71, 73, 74, 75, 76, 77, 78].indexOf(n) >= 0) return 'pto';
  if ([80, 90].indexOf(n) >= 0) return 'absent';
  return 'off';
}

function isAutoHouteiDay_(s) {
  if (!s) return true;
  var st = String(s.status || 'undef');
  if (st === 'work' || st === 'pto' || st === 'absent') return false;
  var n = Number(s.leave_code);
  if (!n || n === 10 || n === 20) return true;
  return false;
}

/** 日曜始まり。先頭の端数週（日曜なし）は全部20。日曜を含む週は最後の休みが10。 */
function computeAutoHouteiMap_(byDay, ym, daysInMonth) {
  var parts = String(ym || '').split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var out = {};
  var week = [];
  function flush(hasSunday) {
    var auto = [];
    for (var i = 0; i < week.length; i++) {
      var d = week[i];
      if (isAutoHouteiDay_(byDay[d])) auto.push(d);
    }
    week = [];
    if (!auto.length) return;
    var ten = 0;
    if (hasSunday) ten = auto[auto.length - 1];
    for (var j = 0; j < auto.length; j++) {
      var dd = auto[j];
      out[ym + '-' + pad2_(dd)] = dd === ten ? 10 : 20;
    }
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var wd = new Date(year, month - 1, d).getDay();
    if (wd === 0 && week.length) {
      var hasSun = false;
      for (var k = 0; k < week.length; k++) {
        if (new Date(year, month - 1, week[k]).getDay() === 0) hasSun = true;
      }
      flush(hasSun);
    }
    week.push(d);
  }
  if (week.length) {
    var hasSun2 = false;
    for (var k2 = 0; k2 < week.length; k2++) {
      if (new Date(year, month - 1, week[k2]).getDay() === 0) hasSun2 = true;
    }
    flush(hasSun2);
  }
  return out;
}

function fillHouteiOnRows_(rows, map, ym, daysInMonth) {
  if (!rows || !rows.length || map.leave_code == null) return;
  var byEmp = {};
  rows.forEach(function (row) {
    var eid = String(row[map.employee_id] || '');
    if (!byEmp[eid]) byEmp[eid] = [];
    byEmp[eid].push(row);
  });
  Object.keys(byEmp).forEach(function (eid) {
    var list = byEmp[eid];
    var byDay = {};
    list.forEach(function (row) {
      var date = normalizeDate_(row[map.date]);
      var day = date ? Number(date.substring(8, 10)) : 0;
      byDay[day] = {
        status: String(row[map.status] || ''),
        leave_code: map.leave_code != null ? row[map.leave_code] : ''
      };
    });
    var codes = computeAutoHouteiMap_(byDay, ym, daysInMonth);
    list.forEach(function (row) {
      var date = normalizeDate_(row[map.date]);
      var code = codes[date];
      if (!code) return;
      var snap = {
        status: String(row[map.status] || ''),
        leave_code: row[map.leave_code]
      };
      if (!isAutoHouteiDay_(snap)) return;
      row[map.leave_code] = code;
      if (!snap.status || snap.status === 'undef') row[map.status] = 'off';
    });
  });
}

function readShifts_(storeId, ym, email, acl) {
  var sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var ensured = ensureLeaveCodeHeader_(sh);
  var map = ensured.map;
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
      leave_code: map.leave_code != null && r[map.leave_code] !== '' && r[map.leave_code] != null ? Number(r[map.leave_code]) : '',
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
      writeSheetRows_(sh, block[0].row, block.map(function (b) { return b.values; }));
      ui++;
    }
  }
  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    writeSheetRows_(sh, startRow, toAppend);
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
  var ensured = ensureLeaveCodeHeader_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
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

  fillHouteiOnRows_(toUpdate.map(function (u) { return u.values; }).concat(toAppend), map, ym, days);

  // 連続行をまとめて一括書き込み
  if (toUpdate.length) {
    toUpdate.sort(function (a, b) { return a.row - b.row; });
    var i = 0;
    while (i < toUpdate.length) {
      var startIdx = i;
      while (i + 1 < toUpdate.length && toUpdate[i + 1].row === toUpdate[i].row + 1) i++;
      var block = toUpdate.slice(startIdx, i + 1);
      var vals = block.map(function (b) { return b.values; });
      writeSheetRows_(sh, block[0].row, vals);
      i++;
    }
  }

  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    writeSheetRows_(sh, startRow, toAppend);
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
  var ensured = ensureLeaveCodeHeader_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, [
    'shift_id', 'date', 'employee_id', 'store_id', 'status',
    'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'
  ]);

  var leaveCode = p.leave_code === '' || p.leave_code == null ? '' : Number(p.leave_code);
  if (leaveCode !== '' && (isNaN(leaveCode) || leaveCode < 0)) leaveCode = '';

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
  if (map.leave_code != null) rowVals[map.leave_code] = leaveCode;
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
      leave_code: leaveCode,
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
  var ensured = ensureLeaveCodeHeader_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
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
    var leaveCode = it.leave_code === '' || it.leave_code == null ? '' : Number(it.leave_code);
    if (leaveCode !== '' && (isNaN(leaveCode) || leaveCode < 0)) leaveCode = '';

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
      if (map.leave_code != null) full[map.leave_code] = leaveCode;
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
      if (map.leave_code != null) row[map.leave_code] = leaveCode;
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
      writeSheetRows_(sh, block[0].row, block.map(function (b) { return b.values; }));
      ui++;
    }
  }
  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    writeSheetRows_(sh, startRow, toAppend);
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

  var shiftRes = readShifts_(storeId, ym, email, acl);
  var byEmpDate = {};
  (shiftRes.shifts || []).forEach(function (s) {
    var eid = String(s.employee_id || '').trim();
    var date = String(s.date || '');
    if (!eid || !date) return;
    byEmpDate[eid + '__' + date] = s;
  });

  var dateHeaders = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var t = new Date(year, month - 1, d);
    dateHeaders.push(t.getMonth() + 1 + '/' + t.getDate() + '(' + dayOfWeekStr[t.getDay()] + ')');
  }
  var headerRow = [year + '/' + month + '/1', '～', year + '/' + month + '/' + daysInMonth].concat(dateHeaders);

  var outputData = [];
  withCode.forEach(function (emp) {
    var code = String(emp.bye_code).trim();
    var outputName = String(emp.name || '').replace(/[ 　]+/g, '　');
    var rowsForStaff = [];
    for (var r = 0; r < 4; r++) {
      var row = [code, outputName, BYE_BYE.ROW_TYPES[r].code];
      for (var dd = 0; dd < daysInMonth; dd++) row.push('');
      rowsForStaff.push(row);
    }

    var byDay = {};
    for (var d0 = 1; d0 <= daysInMonth; d0++) {
      var dt0 = ym + '-' + pad2_(d0);
      byDay[d0] = byEmpDate[String(emp.employee_id || '') + '__' + dt0]
        || byEmpDate[String(emp.bye_code || '') + '__' + dt0]
        || null;
    }
    var houtei = computeAutoHouteiMap_(byDay, ym, daysInMonth);

    for (var day = 1; day <= daysInMonth; day++) {
      var date = ym + '-' + pad2_(day);
      var idx = day - 1;
      var s = byDay[day];
      var status = s ? String(s.status || '') : '';
      var leaveCode = s && s.leave_code !== '' && s.leave_code != null ? Number(s.leave_code) : 0;
      var valForShift = '';
      var kind = leaveCode ? leaveCodeStatus_(leaveCode) : '';

      if (leaveCode && leaveCode !== 10 && leaveCode !== 20 && leaveCode !== 999) {
        rowsForStaff[0][3 + idx] = leaveCode;
        if (kind === 'work') {
          valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes);
          if (!valForShift) warnings.push(emp.name + ' ' + date + '：休日休暇コード' + leaveCode + 'なのに時刻不正');
        } else if (kind === 'pto') {
          valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes) || '08:30-17:30R1:00';
        }
      } else if (houtei[date]) {
        rowsForStaff[0][3 + idx] = houtei[date];
      } else if (status === 'absent') {
        rowsForStaff[0][3 + idx] = BYE_BYE.CODE.ABSENT;
      } else if (status === 'pto') {
        rowsForStaff[0][3 + idx] = BYE_BYE.CODE.PTO;
        valForShift = '08:30-17:30R1:00';
      } else if (status === 'work') {
        valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes);
        if (!valForShift) warnings.push(emp.name + ' ' + date + '：勤務なのに時刻不正');
      }

      if (valForShift) rowsForStaff[1][3 + idx] = valForShift;
    }

    // 自動展開行へミラー（貼り付け先が見やすい）
    for (var c = 3; c < 3 + daysInMonth; c++) {
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
    weekHolidays.forEach(function (idx) { holidayRow[3 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
  } else {
    var last = weekHolidays.pop();
    holidayRow[3 + last] = BYE_BYE.CODE.HOUTEI;
    weekHolidays.forEach(function (idx) { holidayRow[3 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
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
  var filter = sh.getFilter();
  if (filter) filter.remove();
  var all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  all.clearDataValidations();
  all.clear();
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
    var numStaff = Math.floor(outputData.length / 4);
    for (var i = 0; i < numStaff; i++) {
      sh.getRange(2 + i * 4, 1, 4, width).setBackground(i % 2 === 0 ? color1 : color2);
    }
  }
  sh.hideSheet();
  return true;
}

function rowsToTsv_(rows) {
  return (rows || []).map(function (row) {
    return (row || []).slice(0, 34).map(function (cell) {
      var s = cell == null ? '' : String(cell);
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
  var sh = mustStoresSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['store_id', 'store_name']);
  var values = getDataRows_(sh);
  var byId = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[map.store_id] || row[map.primary_store_id] || '').trim();
    if (!id || isKeyValue_(id)) continue;
    if (!byId[id]) {
      byId[id] = {
        store_id: id,
        store_name: map.store_name != null ? String(row[map.store_name] || '') : '',
        area: map.area != null ? String(row[map.area] || '') : '',
        sort_order: map.sort_order != null ? Number(row[map.sort_order] || 0) : 0,
        active: true
      };
    }
    if (!byId[id].store_name && map.store_name != null) {
      byId[id].store_name = String(row[map.store_name] || '');
    }
  }
  var list = [];
  Object.keys(byId).forEach(function (k) {
    if (!byId[k].active) return;
    list.push(byId[k]);
  });
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
  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.work_hours == null) map = ensureHeaderColumn_(sh, 'work_hours');
  requireHeaders_(map, ['name', 'primary_store_id']);
  var values = getDataRows_(sh);
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (map.is_active != null && !isTruthy_(row[map.is_active])) continue;
    var id = String((map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || '').trim();
    if (!id || isKeyValue_(id)) continue;
    var primary = String(row[map.primary_store_id] || row[map.store_id] || '');
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
      bye_code: id,
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
    var sh = mustEmployeesSheet_();
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
  var sh = mustEmployeesSheet_();
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
  ].map(function (k) { return HEADER_JA[k] || k; });
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

function mustStoresSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('マスターデータ') || ss.getSheetByName('店舗マスタ');
  if (!sh) throw new Error('シート「マスターデータ」が見つかりません。メニュー「マスターデータに統合」を実行してください。');
  return sh;
}

function mustEmployeesSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('マスターデータ') || ss.getSheetByName('従業員マスタ');
  if (!sh) throw new Error('シート「マスターデータ」が見つかりません。メニュー「マスターデータに統合」を実行してください。');
  return sh;
}

/** ヘッダが無ければ末尾に追加して index map を返す（key は英語、書き込みは日本語） */
function ensureHeaderColumn_(sh, headerName) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  if (map[headerName] != null) return map;
  var label = HEADER_JA[headerName] || headerName;
  var col = Math.max(sh.getLastColumn(), headers.length) + 1;
  if (headers.length === 1 && !headers[0]) col = 1;
  sh.getRange(1, col).setValue(label);
  map[headerName] = col - 1;
  return map;
}

function getHeaders_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });
}

/** 日本語／英語どちらでも英語キーで参照できる map を返す */
function headerIndexMap_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var raw = headers[i];
    if (!raw) continue;
    var key = HEADER_ALIAS[raw] || raw;
    map[key] = i;
    map[raw] = i;
  }
  if (map.primary_store_id == null && map.store_id != null) map.primary_store_id = map.store_id;
  if (map.store_id == null && map.primary_store_id != null) map.store_id = map.primary_store_id;
  if (map.employee_id == null && map.bye_code != null) map.employee_id = map.bye_code;
  if (map.bye_code == null && map.employee_id != null) map.bye_code = map.employee_id;
  return map;
}

function requireHeaders_(map, names) {
  for (var i = 0; i < names.length; i++) {
    if (map[names[i]] == null) {
      var label = HEADER_JA[names[i]] || names[i];
      throw new Error('ヘッダ列が不足しています: ' + label);
    }
  }
}

function getDataRows_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var numRows = lastRow - 1;
  if (numRows < 1) return [];
  var rows = sh.getRange(2, 1, numRows, lastCol).getValues();
  return rows.filter(function (row) {
    var a = String(row[0] == null ? '' : row[0]).trim();
    return !isKeyValue_(a);
  });
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
