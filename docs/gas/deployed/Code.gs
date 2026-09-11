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
    MASTER: 'アルバイト登録',
    STORES: 'アルバイト登録',
    EMPLOYEES: 'アルバイト登録',
    MANAGERS: '社員登録',
    STORE_CATALOG: '店舗データ',
    STAFF_AUTH: 'スタッフログイン',
    SHIFTS: 'シフト',
    MEMOS: 'シフトメモ',
    WEEKLY: '週間固定',
    ACL: '社員登録',
    ACL_LEGACY: '権限',
    SETTINGS: '設定',
    LOG: '同期ログ',
    STORE_CHAT: '店舗チャット',
    STAFF_HOPE: 'シフト希望'
  },
  STATUS: ['work', 'off', 'pto', 'absent', 'undef'],
  ROLES: { VIEWER: 'viewer', EDITOR: 'editor', ADMIN: 'admin' },
  WEEKDAY_LABELS: ['日', '月', '火', '水', '木', '金', '土']
};

/** アルバイト登録シート（A〜H） */
var MASTER_HEADERS = [
  '店舗ID', '店舗名', 'エリア', '社員コード', '氏名', 'メール', '雇用区分', '勤務時間'
];

/** 社員登録シート */
var MANAGER_HEADERS = [
  'メール', '管轄店舗', '表示名', '社員コード', '氏名', '備考'
];

var HIDDEN_SHEETS = [
  'シフト', '週間固定', 'シフトメモ', '設定', '同期ログ', 'バイバイ貼り付け', '週間診断',
  '権限', '確認_シフト', '確認_週間', 'マスターデータ', 'スタッフログイン',
  '従業員一覧', '管理店舗', 'シフト希望', '店舗チャット'
];

var DX_VISIBLE_SHEETS = ['社員登録', 'アルバイト登録', '店舗データ', 'シフト一覧'];

/** 店舗別シフト／メモの見出し（人が見やすい最小構成） */
var STORE_SHIFT_HEADERS_JA = [
  'シフトID', '日付', '従業員ID', '店舗ID', '区分', '開始', '終了', '休憩分', '休日休暇コード'
];
var STORE_MEMO_HEADERS_JA = [
  'メモID', '日付', '従業員ID', '内容'
];
var SHIFT_INDEX_HEADERS_JA = [
  '店舗', '年月', '日付', '従業員ID', '氏名', '開始', '終了', '休憩分', '休日休暇コード'
];
var SHIFT_INDEX_SHEET = 'シフト一覧';
var STORE_SHEETS_PROP = 'STORE_SHEETS_V2';

var STATUS_JA_LABEL = {
  work: '出勤',
  off: '休み',
  pto: '有休',
  absent: '欠勤',
  undef: '未定'
};

var ROLE_JA_LABEL = {
  viewer: '閲覧のみ',
  editor: '編集可',
  admin: '管理者'
};

var LEAVE_NAME_BY_CODE = {
  10: '法定休日', 20: '法定外休日', 61: '有休', 77: '産休・育休', 80: '欠勤', 90: '休職'
};

var OBSOLETE_SHEETS = [
  '使い方', '店舗マスタ', '従業員マスタ',
  '従業員_店舗別ビュー', '店舗ID早見',
  '確認_シフト', '確認_週間', 'バイバイ貼り付け', '週間診断',
  'マスターデータ', '権限', '同期ログ', '従業員一覧', '管理店舗',
  'シート1', 'Sheet1'
];

/**
 * スプシ表示用の日本語ヘッダ（英語キー → 日本語）
 * コード内は英語キーのまま参照する。
 */
var HEADER_JA = {
  store_id: '店舗ID',
  store_name: '店舗名',
  area: 'エリア',
  territory: 'テリトリー',
  store_email: '店舗メール',
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
  type: 'タイプ',
  target: '対象',
  range: '範囲',
  result: '結果',
  message: 'メッセージ',
  managed_stores: '管轄店舗',
  display_name: '表示名',
  staff_password_hash: '認証ハッシュ',
  staff_password_salt: '認証ソルト',
  staff_registered: 'スタッフ登録済',
  message_id: 'メッセージID',
  user_email: '送信者メール',
  user_name: '送信者名',
  created_at: '作成日時',
  link_employee_id: 'リンク従業員ID',
  link_date: 'リンク日付',
  link_label: 'リンクラベル',
  hope_id: '希望ID',
  hope_kind: '希望区分',
  hope_state: '申請状態',
  memo: 'メモ'
};

/** 日本語／英語ヘッダ → 英語キー */
var HEADER_ALIAS = (function () {
  var map = {};
  Object.keys(HEADER_JA).forEach(function (en) {
    map[en] = en;
    map[HEADER_JA[en]] = en;
  });
  // 旧シートで kind/type が同じ「種類」だった互換
  map['種類'] = 'kind';
  map['管理店舗'] = 'managed_stores';
  map['管轄店舗'] = 'managed_stores';
  map['社員番号'] = 'bye_code';
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
  buildShiftMenu_();
  try {
    cleanupObsoleteSheetsOnly_();
  } catch (eClean) { /* ignore */ }
  try {
    ensureStoreSheetMigrationOnce_({ quiet: true });
  } catch (eMig) { /* ignore */ }
  try {
    applyPilotSheetVisibility_();
  } catch (eVis) { /* ignore */ }
  try {
    ensureAutoArchiveTrigger_();
  } catch (eTrig) { /* ignore */ }
}

function onInstall(e) {
  onOpen(e);
}

function buildShiftMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('シフト基盤')
    .addItem('店舗別へ移行＆不要シート削除', 'menuMigrateStoreSheets')
    .addItem('シフト一覧を更新', 'menuRefreshShiftIndex')
    .addItem('店舗シフトを最新日付順に整える', 'menuSortStoreShiftSheets')
    .addItem('不要シートだけ削除', 'menuCleanupObsoleteSheets')
    .addItem('雇用区分「パート」→「アルバイト」', 'menuUnifyEmploymentType')
    .addItem('古いシフトを自動整理（今すぐ）', 'menuAutoArchiveStoreShiftsNow')
    .addSeparator()
    .addItem('カレンダー権限を許可（初回）', 'authorizeCalendarOnce')
    .addToUi();
}

/** 確認_* など不要タブだけ即削除（移行済みでも毎回安全に実行可） */
function cleanupObsoleteSheetsOnly_() {
  var ss = ss_();
  var deleted = 0;
  var names = OBSOLETE_SHEETS.slice();
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (isYmShiftSheetName_(n) || isYmMemoSheetName_(n) || n === 'シフト' || n === 'シフトメモ') {
      names.push(n);
    }
  });
  var seen = {};
  names.forEach(function (name) {
    if (seen[name]) return;
    seen[name] = true;
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    try {
      if (ss.getSheets().length <= 1) return;
      ss.deleteSheet(sh);
      deleted++;
    } catch (e) { /* ignore */ }
  });
  // 一覧の再構築は「何か消したときだけ」（毎回だと起動が重い）
  if (deleted > 0) {
    try { rebuildShiftIndexSheet_(); } catch (e2) { /* ignore */ }
    try { applyPilotSheetVisibility_(); } catch (e3) { /* ignore */ }
  }
  return { ok: true, deletedSheets: deleted };
}

function menuCleanupObsoleteSheets() {
  var r = cleanupObsoleteSheetsOnly_();
  SpreadsheetApp.getUi().alert('完了', '不要シートを ' + (r.deletedSheets || 0) + ' 枚削除しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuMigrateStoreSheets() {
  var r = migrateToStoreSheetsAndWipe_({ rebuildIndex: true, force: true });
  SpreadsheetApp.getUi().alert(
    '完了',
    '店舗別シートへ移行しました。\n' +
      'シフト行 ' + (r.shiftRows || 0) + ' / メモ行 ' + (r.memoRows || 0) + '\n' +
      '削除シート ' + (r.deletedSheets || 0) + ' 枚',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** clasp run 用 */
function runMigrateStoreSheets() {
  PropertiesService.getDocumentProperties().deleteProperty(STORE_SHEETS_PROP);
  return migrateToStoreSheetsAndWipe_({ rebuildIndex: true, force: true });
}

function menuRefreshShiftIndex() {
  var n = rebuildShiftIndexSheet_();
  SpreadsheetApp.getUi().alert('完了', 'シフト一覧を更新しました（' + n + ' 行）。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuRepairManagerHeaders() {
  var sh = ensureManagerStoresSheet_();
  applyManagerSheetLayout_(sh);
  SpreadsheetApp.getUi().alert(
    '完了',
    '社員登録ヘッダを次の並びに直しました。\n\n' + MANAGER_HEADERS.join(' / '),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** clasp / 自動実行用（ダイアログなし） */
function runPilotReleasePrep() {
  return runPilotReleasePrep_();
}

function menuPilotReleasePrep() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'パイロット公開準備',
    '次を一括実行します。\n\n' +
      '・シートを「社員登録／アルバイト登録」に改名\n' +
      '・ヘッダ日本語化・レイアウト整備\n' +
      '・生データ・旧確認シートを非表示\n\n' +
      '実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = runPilotReleasePrep_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function menuRenameSheetsAndLayout() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'シート改名・レイアウト整備',
    '次を実行します。\n\n' +
      '・管理店舗 → 社員登録\n' +
      '・従業員一覧 → アルバイト登録\n' +
      '・各シートの見た目を整え、表示をこの3枚に限定\n' +
      '　（社員登録／アルバイト登録／店舗データ）\n\n' +
      '実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = renameSheetsAndLayout_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function menuCleanPartTimeSheet() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'アルバイト登録を正しい状態にする',
    'アルバイト登録から次を削除・修正します。\n\n' +
      '・雇用区分が「社員」の行を削除\n' +
      '・メールが入っている行を削除（社員扱い）\n' +
      '・残った人の雇用区分をすべて「アルバイト」に統一\n' +
      '・メール列を空にする\n\n' +
      '実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = cleanPartTimeSheet_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function menuPolishEmployeesSheet() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'アルバイト登録を整える',
    'アルバイト登録を A〜H（店舗ID〜勤務時間）だけに整え、\n' +
      '認証ハッシュ等は「スタッフログイン」シートへ移します。\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var summary = polishEmployeesSheet_();
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

/**
 * 雇用区分の「パート」を「アルバイト」に統一（社員行は触らない）
 * clasp run / メニュー両用
 */
function unifyEmploymentTypes_() {
  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.employment_type == null) throw new Error('雇用区分列がありません。');
  var last = sh.getLastRow();
  if (last < 2) return '変更なし（データ行なし）';
  var range = sh.getRange(2, map.employment_type + 1, last - 1, 1);
  var values = range.getValues();
  var changed = 0;
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i][0] || '').trim();
    if (v === 'パート') {
      values[i][0] = 'アルバイト';
      changed++;
    }
  }
  if (changed) range.setValues(values);
  try {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['アルバイト', '社員'], true)
      .setAllowInvalid(true)
      .build();
    range.setDataValidation(rule);
  } catch (eVal) { /* ignore */ }
  return '✓ パート → アルバイト に更新: ' + changed + '件';
}

function unifyPartToArbeitForDx() {
  return unifyEmploymentTypes_();
}

function menuUnifyEmploymentType() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    '雇用区分を統一',
    '「パート」をすべて「アルバイト」に書き換えます。\n（「社員」はそのまま）\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  ui.alert('完了', unifyEmploymentTypes_(), ui.ButtonSet.OK);
}

/**
 * アルバイト登録をアルバイトのみに整理
 * - 社員／メールあり行を削除
 * - 雇用区分を「アルバイト」に統一
 * - メール列を空に
 */
function cleanPartTimeSheet_() {
  var sh = mustEmployeesSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['name', 'bye_code']);

  var data = sh.getDataRange().getValues();
  var kept = [];
  var removed = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var code = String(
      (map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || ''
    ).trim();
    var name = map.name != null ? String(row[map.name] || '').trim() : '';
    if (!code && !name) continue;

    var empType = map.employment_type != null ? String(row[map.employment_type] || '').trim() : '';
    var email = map.email != null ? String(row[map.email] || '').trim() : '';
    var isEmployee = empType === '社員' || !!email;
    if (isEmployee) {
      removed++;
      continue;
    }

    var out = row.slice();
    while (out.length < headers.length) out.push('');
    if (map.employment_type != null) out[map.employment_type] = 'アルバイト';
    if (map.email != null) out[map.email] = '';
    if (map.work_hours != null) {
      var wh = Number(out[map.work_hours]);
      if (!wh || isNaN(wh)) out[map.work_hours] = 4;
    }
    kept.push(out);
  }

  kept.sort(function (a, b) {
    var sa = map.store_name != null ? String(a[map.store_name] || '') : '';
    var sb = map.store_name != null ? String(b[map.store_name] || '') : '';
    var c = sa.localeCompare(sb, 'ja');
    if (c) return c;
    var na = map.name != null ? String(a[map.name] || '') : '';
    var nb = map.name != null ? String(b[map.name] || '') : '';
    return na.localeCompare(nb, 'ja');
  });

  resetMasterSheet_(sh);
  sh.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  if (kept.length) {
    // MASTER_HEADERS 順に並べ直す
    var rebuilt = kept.map(function (row) {
      return [
        map.store_id != null || map.primary_store_id != null
          ? String(row[map.store_id != null ? map.store_id : map.primary_store_id] || '')
          : '',
        map.store_name != null ? String(row[map.store_name] || '') : '',
        map.area != null ? String(row[map.area] || '') : '',
        String((map.bye_code != null ? row[map.bye_code] : row[map.employee_id]) || ''),
        map.name != null ? String(row[map.name] || '') : '',
        '',
        'アルバイト',
        map.work_hours != null && row[map.work_hours] !== '' && row[map.work_hours] != null
          ? row[map.work_hours]
          : 4
      ];
    });
    sh.getRange(2, 4, rebuilt.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, rebuilt.length, MASTER_HEADERS.length).setValues(rebuilt);
  }
  applyMasterLayout_(sh);
  invalidateRequestCache_(['stores', 'knownStoreMap', 'employees']);
  hideSystemSheets_();
  ss_().setActiveSheet(sh);
  return (
    '✓ アルバイト登録を整理しました\n' +
    '✓ 削除（社員／メールあり） ' + removed + '名\n' +
    '✓ 残ったアルバイト ' + kept.length + '名\n' +
    '✓ 雇用区分はすべて「アルバイト」'
  );
}

function runPilotReleasePrep_() {
  var lines = [];
  lines.push(renameSheetsAndLayout_());
  lines.push(migrateHeadersToJapanese_());
  try {
    lines.push(polishEmployeesSheet_());
  } catch (e2) {
    lines.push('アルバイト登録整形: ' + e2.message);
  }
  ensureWeeklySheet_();
  var wsh = mustSheet_(SHIFT_APP.SHEETS.WEEKLY);
  ensureWeeklyLeaveCodeHeader_(wsh);
  applyPilotSheetVisibility_();
  return lines.join('\n');
}

function menuRefreshPilotConfirm() {
  var summary = refreshPilotConfirmSheets_();
  SpreadsheetApp.getUi().alert('確認シート更新', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** 旧シート名 → 社員登録／アルバイト登録＋レイアウト */
function renameSheetsAndLayout_() {
  var ss = ss_();
  var lines = [];

  // 管理店舗 → 社員登録
  var mgrOld = ss.getSheetByName('管理店舗');
  var mgrNew = ss.getSheetByName(SHIFT_APP.SHEETS.MANAGERS);
  if (mgrOld && !mgrNew) {
    mgrOld.setName(SHIFT_APP.SHEETS.MANAGERS);
    lines.push('✓ 管理店舗 → 社員登録 に改名');
  } else if (mgrOld && mgrNew && mgrOld.getSheetId() !== mgrNew.getSheetId()) {
    // 両方ある場合は旧を非表示
    if (!mgrOld.isSheetHidden()) mgrOld.hideSheet();
    lines.push('✓ 社員登録あり（旧・管理店舗は非表示）');
  } else {
    lines.push('✓ 社員登録シート確認');
  }

  // 従業員一覧 → アルバイト登録
  var empOld = ss.getSheetByName('従業員一覧');
  var empNew = ss.getSheetByName(SHIFT_APP.SHEETS.EMPLOYEES);
  if (empOld && !empNew) {
    empOld.setName(SHIFT_APP.SHEETS.EMPLOYEES);
    lines.push('✓ 従業員一覧 → アルバイト登録 に改名');
  } else if (empOld && empNew && empOld.getSheetId() !== empNew.getSheetId()) {
    if (!empOld.isSheetHidden()) empOld.hideSheet();
    lines.push('✓ アルバイト登録あり（旧・従業員一覧は非表示）');
  } else {
    lines.push('✓ アルバイト登録シート確認');
  }

  lines.push(ensureManagerStoresLayout_());
  try {
    lines.push(cleanPartTimeSheet_());
  } catch (eClean) {
    lines.push('アルバイト整理: ' + eClean.message);
  }
  try {
    var part = mustEmployeesSheet_();
    applyMasterLayout_(part);
    lines.push('✓ アルバイト登録レイアウト適用');
  } catch (e) {
    lines.push('アルバイト登録レイアウト: ' + e.message);
  }

  // 店舗データ
  var cat = ss.getSheetByName(SHIFT_APP.SHEETS.STORE_CATALOG) || ss.getSheetByName('店舗データ');
  if (cat) {
    applyStoreCatalogLayout_(cat);
    lines.push('✓ 店舗データレイアウト適用');
  }

  applyPilotSheetVisibility_();
  var emp = findEmployeesSheet_();
  if (emp) {
    ss.setActiveSheet(emp);
    ss.moveActiveSheet(2);
  }
  var mgr = ss.getSheetByName(SHIFT_APP.SHEETS.MANAGERS);
  if (mgr) {
    ss.setActiveSheet(mgr);
    ss.moveActiveSheet(1);
  }
  return lines.join('\n');
}

function applyStoreCatalogLayout_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 4);
  var lastRow = Math.max(sh.getLastRow(), 1);
  sh.setTabColor('#27ae60');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lastCol)
    .setBackground('#196f3d')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  [120, 120, 160, 220].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, lastCol).setFontSize(10).setVerticalAlignment('middle');
  }
  var existing = sh.getFilter();
  if (existing) existing.remove();
  sh.getRange(1, 1, Math.max(lastRow, 2), lastCol).createFilter();
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
  var sh = ss_().getSheetByName(shiftMonthlySheetName_(ym)) || mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
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
    var status = String(r[map.status] || 'undef');
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

  var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
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
  // 行・列が足りないと getRange が失敗するので必要分だけ広げる
  var needRows = startRow + numRows - 1;
  var maxRows = sh.getMaxRows();
  if (maxRows < needRows) sh.insertRowsAfter(maxRows, needRows - maxRows);
  var maxCols = sh.getMaxColumns();
  if (maxCols < numCols) sh.insertColumnsAfter(maxCols, numCols - maxCols);
  sh.getRange(startRow, 1, numRows, numCols).setValues(values);
}

function hideSystemSheets_() {
  applyPilotSheetVisibility_();
}

function applyPilotSheetVisibility_() {
  var ss = ss_();
  HIDDEN_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && !sh.isSheetHidden()) sh.hideSheet();
  });
  hideAllMonthlyDataSheets_();
  DX_VISIBLE_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.isSheetHidden()) sh.showSheet();
  });
  var emp = findEmployeesSheet_();
  if (emp) {
    ss.setActiveSheet(emp);
    ss.moveActiveSheet(1);
  }
}

function refreshPilotConfirmSheets_() {
  refreshShiftConfirmSheet_();
  refreshWeeklyConfirmSheet_();
  return '✓ 確認_シフト / 確認_週間 を更新';
}

function refreshShiftConfirmSheet_() {
  var ss = ss_();
  var name = '確認_シフト';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  var headers = ['日付', '店舗', '氏名', '区分', '休暇', '開始', '終了'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  var empName = {};
  var storeName = {};
  var masterSh = findEmployeesSheet_();
  if (masterSh) {
    readSheetObjects_(masterSh).forEach(function (r) {
      var code = String(r.bye_code || r.employee_id || '').trim();
      if (code) empName[code] = String(r.name || code);
      var sid = String(r.store_id || r.primary_store_id || '').trim();
      if (sid) storeName[sid] = String(r.store_name || sid);
    });
  }

  var shiftSheets = [];
  ss.getSheets().forEach(function (sht) {
    var sn = sht.getName();
    if (sn === 'シフト' || sn.indexOf('シフト_') === 0) shiftSheets.push(sht);
  });
  if (!shiftSheets.length) {
    applyConfirmSheetLayout_(sh, '#e69138');
    return;
  }
  var out = [];
  shiftSheets.forEach(function (shiftSh) {
    var map = headerIndexMap_(getHeaders_(shiftSh));
    if (map.store_id == null || map.date == null) return;
    getDataRows_(shiftSh).forEach(function (r) {
      var sid = String(r[map.store_id] || '').trim();
      if (sid !== 'S001' && sid !== 'S002') return;
      var eid = String(r[map.employee_id] || '').trim();
      var st = String(r[map.status] || 'undef');
      var lc = map.leave_code != null ? r[map.leave_code] : '';
      var lcNum = lc === '' || lc == null ? 0 : Number(lc);
      var leaveText = lcNum ? (lcNum + ' ' + (LEAVE_NAME_BY_CODE[lcNum] || '')).trim() : '';
      out.push([
        normalizeDate_(r[map.date]),
        storeName[sid] || sid,
        empName[eid] || eid,
        STATUS_JA_LABEL[st] || st,
        leaveText,
        formatHm_(r[map.start_time]),
        formatHm_(r[map.end_time])
      ]);
    });
  });
  out.sort(function (a, b) {
    var c = String(a[0]).localeCompare(String(b[0]));
    if (c) return c;
    c = String(a[1]).localeCompare(String(b[1]), 'ja');
    if (c) return c;
    return String(a[2]).localeCompare(String(b[2]), 'ja');
  });
  if (out.length) sh.getRange(2, 1, 1 + out.length, headers.length).setValues(out);
  applyConfirmSheetLayout_(sh, '#e69138');
}

function refreshWeeklyConfirmSheet_() {
  var ss = ss_();
  var name = '確認_週間';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  var headers = ['店舗', '氏名', '曜日', '区分', '休暇', '開始', '終了'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  var empName = {};
  var storeName = {};
  var masterSh = findEmployeesSheet_();
  if (masterSh) {
    readSheetObjects_(masterSh).forEach(function (r) {
      var code = String(r.bye_code || r.employee_id || '').trim();
      if (code) empName[code] = String(r.name || code);
      var sid = String(r.store_id || r.primary_store_id || '').trim();
      if (sid) storeName[sid] = String(r.store_name || sid);
    });
  }

  var wsh = ss.getSheetByName('週間固定');
  if (!wsh) {
    applyConfirmSheetLayout_(sh, '#3d85c6');
    return;
  }
  var map = headerIndexMap_(getHeaders_(wsh));
  ensureWeeklyLeaveCodeHeader_(wsh);
  map = headerIndexMap_(getHeaders_(wsh));
  var rows = getDataRows_(wsh);
  var wdOrder = [1, 2, 3, 4, 5, 6, 0];
  var out = [];
  rows.forEach(function (r) {
    if (map.is_active != null && !isTruthy_(r[map.is_active])) return;
    var sid = String(r[map.store_id] || '').trim();
    if (sid !== 'S001' && sid !== 'S002') return;
    var eid = String(r[map.employee_id] || '').trim();
    var wd = Number(r[map.weekday]);
    var st = String(r[map.status] || 'undef');
    var lc = map.leave_code != null ? r[map.leave_code] : '';
    var lcNum = lc === '' || lc == null ? 0 : Number(lc);
    var leaveText = lcNum ? (lcNum + ' ' + (LEAVE_NAME_BY_CODE[lcNum] || '')).trim() : '';
    out.push({
      sort: (sid === 'S001' ? '0' : '1') + empName[eid] + wdOrder.indexOf(wd),
      row: [
        storeName[sid] || sid,
        empName[eid] || eid,
        SHIFT_APP.WEEKDAY_LABELS[wd] || wd,
        STATUS_JA_LABEL[st] || st,
        leaveText,
        formatHm_(r[map.start_time]),
        formatHm_(r[map.end_time])
      ]
    });
  });
  out.sort(function (a, b) { return String(a.sort).localeCompare(String(b.sort), 'ja'); });
  var vals = out.map(function (x) { return x.row; });
  if (vals.length) sh.getRange(2, 1, vals.length, headers.length).setValues(vals);
  applyConfirmSheetLayout_(sh, '#3d85c6');
}

function applyConfirmSheetLayout_(sh, tabColor) {
  sh.setTabColor(tabColor || '#4a86e8');
  sh.setFrozenRows(1);
  var cols = sh.getLastColumn();
  var last = Math.max(sh.getLastRow(), 1);
  var header = sh.getRange(1, 1, 1, cols);
  header.setBackground('#1f4e79').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center');
  if (last > 1) {
    sh.getRange(2, 1, last, cols).setFontSize(11).setVerticalAlignment('middle');
  }
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 120);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 140);
  sh.setColumnWidth(6, 80);
  sh.setColumnWidth(7, 80);
  var existing = sh.getFilter();
  if (existing) existing.remove();
  if (last > 1) sh.getRange(1, 1, last, cols).createFilter();
  header.setNote('Webアプリで保存すると自動更新されます。生データは「シフト」「週間固定」シート（非表示）');
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

  var cols = MASTER_HEADERS.length; // A〜H
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
  sh.getRange(2, 4, Math.max(last - 1, 1), 1).setNumberFormat('@');
  var empRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['アルバイト'], true).setAllowInvalid(true).build();
  sh.getRange(2, 7, Math.max(last - 1, 1), 1).setDataValidation(empRule);
  // I列以降（認証など）は非表示
  var maxCol = sh.getMaxColumns();
  if (maxCol > cols) {
    try { sh.hideColumns(cols + 1, maxCol - cols); } catch (e) { /* ignore */ }
  }
  var existing = sh.getFilter();
  if (existing) existing.remove();
  sh.getRange(1, 1, last, cols).createFilter();
  header.setNote('アルバイト登録：1行＝1人。A〜Hのみ手入力。メールは空でOK。認証は「スタッフログイン」（非表示）。');
}

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};
  if (p.pwa === 'manifest') return servePwaManifest_();
  if (p.pwa === 'sw') return servePwaServiceWorker_();
  if (p.pwa === 'icon' || p.pwa === 'icon-maskable') return servePwaIcon_(p.pwa === 'icon-maskable');
  if (p.action) return handleStaffApiGet_(p, e);

  var base = ScriptApp.getService().getUrl().split('?')[0];
  var boot =
    '<script>window.__SHIFT_EXEC_BASE__=' + JSON.stringify(base) + ';</script>' +
    '<script>window.__SHIFT_APP_BUILD__=' + JSON.stringify(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss')) + ';</script>' +
    '<script>(function(){try{if(!("serviceWorker" in navigator))return;' +
    'navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister();});});' +
    'if(window.caches&&caches.keys)caches.keys().then(function(k){k.forEach(function(n){caches.delete(n);});});' +
    '}catch(e){}})();</script>';
  var html = HtmlService.createHtmlOutputFromFile('index').getContent();
  if (html.indexOf('<head>') !== -1) {
    html = html.replace(
      '<head>',
      '<head><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">' +
        '<meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">'
    );
  } else {
    html = '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">' + html;
  }
  if (html.indexOf('<head>') !== -1) {
    html = html.replace('<head>', '<head>' + boot);
  } else {
    html = boot + html;
  }
  return HtmlService.createHtmlOutput(html)
    .setTitle(resolveAppTitle_())
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function servePwaManifest_() {
  var base = ScriptApp.getService().getUrl().split('?')[0];
  var scopePath = base.substring(0, base.lastIndexOf('/') + 1);
  var manifest = {
    id: base,
    name: 'SHIFT:ONE',
    short_name: 'SHIFT:ONE',
    description: '現場のすべてを、ひとつに。',
    start_url: base + '?mode=staff',
    scope: scopePath,
    display: 'standalone',
    display_override: ['standalone', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#060d1a',
    theme_color: '#1565c0',
    lang: 'ja',
    prefer_related_applications: false,
    icons: [
      { src: base + '?pwa=icon', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: base + '?pwa=icon', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: base + '?pwa=icon-maskable', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  };
  return ContentService.createTextOutput(JSON.stringify(manifest))
    .setMimeType(ContentService.MimeType.JSON);
}

function servePwaServiceWorker_() {
  var sw =
    "self.addEventListener('install',function(e){self.skipWaiting();});" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});" +
    "self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request));});";
  return ContentService.createTextOutput(sw).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function cleanCallbackName_(value) {
  var callback = String(value || '');
  return /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback) ? callback : '';
}

function jsonApiResponse_(payload, e) {
  var callback = e && e.parameter ? cleanCallbackName_(e.parameter.callback) : '';
  var body = callback ? callback + '(' + JSON.stringify(payload) + ');' : JSON.stringify(payload);
  var mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

/** スタッフ PWA（Vercel）向け JSON / JSONP API */
function handleStaffApiGet_(p, e) {
  var action = String(p.action || '');
  try {
    var result;
    if (action === 'getBootstrap') result = getBootstrap();
    else if (action === 'loginWithEmail') result = loginWithEmail(p.email);
    else if (action === 'resumeWorkspace') result = resumeWorkspace(p.email, p.storeId, p.yearMonth, p.skipAllStores);
    else if (action === 'staffVerifyIdentity') result = staffVerifyIdentity(p.byeCode, p.name);
    else if (action === 'staffSetPassword') result = staffSetPassword(p.byeCode, p.name, p.password);
    else if (action === 'staffLogin') result = staffLogin(p.byeCode, p.password);
    else if (action === 'staffResumeSession') result = staffResumeSession(p.token);
    else if (action === 'staffGetMonth') result = staffGetMonth(p.token, p.storeId, p.yearMonth);
    else if (action === 'staffListHopes') result = staffListHopes(p.token, p.storeId, p.yearMonth);
    else if (action === 'staffSubmitHope') result = staffSubmitHope(parseApiPayload_(p.payload));
    else if (action === 'staffCancelHope') result = staffCancelHope(parseApiPayload_(p.payload));
    else if (action === 'staffListStoreChat') result = staffListStoreChat(p.token, p.storeId, p.limit);
    else if (action === 'staffPostStoreChat') result = staffPostStoreChat(parseApiPayload_(p.payload));
    else if (action === 'staffDeleteStoreChat') result = staffDeleteStoreChat(parseApiPayload_(p.payload));
    else if (action === 'saveJurisdiction') result = saveJurisdiction(parseApiPayload_(p.payload));
    else if (action === 'listEmployees') result = listEmployees(p.storeId, p.userEmail);
    else if (action === 'upsertEmployee') result = upsertEmployee(parseApiPayload_(p.payload));
    else if (action === 'saveEmployeeOrder') result = saveEmployeeOrder(parseApiPayload_(p.payload));
    else if (action === 'deactivateEmployee') result = deactivateEmployee(p.employeeId, p.storeId, p.userEmail);
    else if (action === 'getWeeklySchedule') result = getWeeklySchedule(p.storeId, p.userEmail);
    else if (action === 'saveWeeklySchedule') result = saveWeeklySchedule(parseApiPayload_(p.payload));
    else if (action === 'getShifts') result = getShifts(p.storeId, p.yearMonth, p.userEmail, p.applyWeekly);
    else if (action === 'generateMonthlyShifts') result = generateMonthlyShifts(parseApiPayload_(p.payload));
    else if (action === 'clearMonthlyShifts') result = clearMonthlyShifts(parseApiPayload_(p.payload));
    else if (action === 'upsertShift') result = upsertShift(parseApiPayload_(p.payload));
    else if (action === 'upsertShiftsBatch') result = upsertShiftsBatch(parseApiPayload_(p.payload));
    else if (action === 'upsertMemosBatch') result = upsertMemosBatch(parseApiPayload_(p.payload));
    else if (action === 'deleteShift') result = deleteShift(p.shiftId, p.storeId, p.userEmail);
    else if (action === 'buildByeByePaste') result = buildByeByePaste(p.storeId, p.yearMonth, p.userEmail);
    else if (action === 'syncCalendarMonth') result = syncCalendarMonth(parseApiPayload_(p.payload));
    else if (action === 'clearCalendarMonth') result = clearCalendarMonth(parseApiPayload_(p.payload));
    else if (action === 'migrateStoreSheets') result = runMigrateStoreSheets();
    else if (action === 'refreshShiftIndex') result = { ok: true, rows: rebuildShiftIndexSheet_() };
    else if (action === 'listStoreChat') result = listStoreChat(p.storeId, p.userEmail, p.limit);
    else if (action === 'postStoreChat') result = postStoreChat(parseApiPayload_(p.payload));
    else if (action === 'deleteStoreChat') result = deleteStoreChat(parseApiPayload_(p.payload));
    else throw new Error('不明な action: ' + action);
    return jsonApiResponse_(result, e);
  } catch (err) {
    return jsonApiResponse_({ ok: false, message: err.message || String(err) }, e);
  }
}

function parseApiPayload_(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  return JSON.parse(String(raw));
}

function servePwaIcon_(maskable) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#1e88e5"/><stop offset="100%" stop-color="#0d47a1"/></linearGradient></defs>' +
  '<rect width="512" height="512" rx="' + (maskable ? 96 : 112) + '" fill="url(#g)"/>' +
    '<text x="256" y="300" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="168" font-weight="800" fill="#fff">S<tspan fill="#90caf9">:</tspan>1</text>' +
    '</svg>';
  return ContentService.createTextOutput(svg).setMimeType(ContentService.MimeType.SVG);
}

/* ============================================================
 * 初期・ログイン
 * ============================================================ */
function resolveAppTitle_() {
  var raw = getSetting_('app_title', 'SHIFT:ONE');
  var legacy = [
    'シフト・キンタイ・カレンダー', 'Shift Desk', 'シフト管理', 'キンタイAPP', 'キンタイ APP',
    'SHIFT ONE', 'EAST勤怠管理アプリ'
  ];
  if (legacy.indexOf(String(raw || '').trim()) >= 0) return 'SHIFT:ONE';
  return raw || 'SHIFT:ONE';
}

function getBootstrap() {
  // 起動は極薄。店舗カタログは Script Cache 経由（無いときだけ読む）
  var allStores = [];
  try {
    allStores = listAllStoresCached_() || [];
  } catch (e) {
    allStores = [];
  }
  return {
    ok: true,
    appTitle: 'SHIFT:ONE',
    companyDomain: 'okamoto-group.co.jp',
    sessionEmail: peekSessionEmail_(),
    serverYearMonth: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM'),
    statuses: SHIFT_APP.STATUS.slice(),
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice(),
    allStores: allStores,
    areas: uniqueAreas_(allStores)
  };
}

function loginWithEmail(email) {
  var res = buildLoginResult_(email, { ensureRegistered: true, includeAllStores: true, lookupProfile: true });
  if (res && res.__acl) delete res.__acl;
  return res;
}

/**
 * 再訪用: ログイン情報 + 当月シフトを1往復で返す（運営利用の起動を速くする）
 * skipAllStores: "1"/true なら全店舗カタログを省略（端末に店舗一覧がある再訪向け）
 */
function resumeWorkspace(email, storeId, yearMonth, skipAllStores) {
  var skipCatalog = skipAllStores === true || skipAllStores === 1
    || String(skipAllStores || '').toLowerCase() === '1'
    || String(skipAllStores || '').toLowerCase() === 'true';

  var login = buildLoginResult_(email, {
    ensureRegistered: false,
    includeAllStores: !skipCatalog,
    lookupProfile: false
  });

  if (login.needsJurisdiction) {
    return {
      ok: true,
      needsJurisdiction: true,
      user: login,
      storeId: '',
      yearMonth: String(yearMonth || '').trim() || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM'),
      month: null
    };
  }

  var stores = login.stores || [];
  var sid = String(storeId || '').trim();
  var allowed = false;
  for (var i = 0; i < stores.length; i++) {
    if (String(stores[i].store_id) === sid) { allowed = true; break; }
  }
  if (!allowed) sid = stores.length ? String(stores[0].store_id) : '';

  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    ym = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
  }

  var month = null;
  if (sid) {
    var acl = login.__acl || resolveAclCached_(login.email);
    month = getShiftsCore_(sid, ym, login.email, acl, false);
  }
  if (login.__acl) delete login.__acl;

  return {
    ok: true,
    needsJurisdiction: false,
    user: login,
    storeId: sid,
    yearMonth: ym,
    month: month
  };
}

/**
 * @param {object} opts
 *   ensureRegistered: 社員登録シートへ行作成
 *   includeAllStores: 全店舗カタログを返す（登録画面用）
 *   lookupProfile: 従業員マスタから氏名補完
 */
function buildLoginResult_(email, opts) {
  opts = opts || {};
  var normalized = normalizeEmail_(email);
  assertCompanyDomain_(normalized);

  var active = peekActiveUserEmail_();
  if (active && active !== normalized) {
    throw new Error('Googleログイン中のアカウント（' + active + '）と入力メールが一致しません。');
  }

  if (opts.ensureRegistered) {
    try { ensureManagerEmailRegistered_(normalized); } catch (eReg) { /* 後続で再試行 */ }
  }

  var acl = resolveAclCached_(normalized, { allowEmpty: true });
  var allStores = [];
  if (opts.includeAllStores !== false) {
    try {
      allStores = listAllStoresCached_() || [];
    } catch (eAll) {
      allStores = [];
    }
    if (!allStores.length) {
      allStores = [
        { store_id: 'S001', store_name: '経堂', area: '第7エリア', territory: '', sort_order: 0, active: true },
        { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア', territory: '', sort_order: 1, active: true }
      ];
    }
  }

  var stores = listStoresForUser_(acl);
  var needsJur = !acl.isAdmin && stores.length === 0;
  var displayName = String(acl.displayName || '').trim();
  var byeCode = String(acl.byeCode || '').trim();
  if (opts.lookupProfile !== false && (!byeCode || !displayName)) {
    var profile = findEmployeeByEmail_(normalized);
    if (!byeCode && profile && profile.bye_code) byeCode = String(profile.bye_code).trim();
    if (!displayName && profile && profile.name) displayName = String(profile.name).trim();
  }

  return {
    ok: true,
    email: normalized,
    name: needsJur ? displayName : (displayName || normalized.split('@')[0]),
    bye_code: byeCode,
    roleMax: acl.roleMax || '',
    isAdmin: acl.isAdmin,
    needsJurisdiction: needsJur,
    stores: stores,
    allStores: allStores,
    areas: uniqueAreas_(allStores.length ? allStores : stores),
    appTitle: resolveAppTitle_(),
    statuses: SHIFT_APP.STATUS.slice(),
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice(),
    __acl: acl
  };
}

function aclCacheKey_(email) {
  return 'acl:v1:' + String(email || '').trim().toLowerCase();
}

function readAclCache_(email) {
  try {
    var raw = CacheService.getScriptCache().get(aclCacheKey_(email));
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.email) return null;
    return obj;
  } catch (e) {
    return null;
  }
}

function writeAclCache_(email, acl) {
  try {
    if (!acl) return;
    var text = JSON.stringify(acl);
    if (text.length > 90000) return;
    CacheService.getScriptCache().put(aclCacheKey_(email), text, 180);
  } catch (e) { /* ignore */ }
}

function invalidateAclCache_(email) {
  try { CacheService.getScriptCache().remove(aclCacheKey_(email)); } catch (e) { /* ignore */ }
}

function resolveAclCached_(email, opt) {
  var hit = readAclCache_(email);
  if (hit) {
    if (!(hit.needsJurisdiction && !(opt && opt.allowEmpty))) return hit;
  }
  var acl = resolveAcl_(email, opt);
  writeAclCache_(email, acl);
  return acl;
}

/** 手動計測用（Apps Script エディタから実行可） */
function benchResumeWorkspace_() {
  var email = peekSessionEmail_() || peekActiveUserEmail_();
  if (!email) throw new Error('実行ユーザーのメールが取得できません');
  var t0 = Date.now();
  var loginOnly = buildLoginResult_(email, { ensureRegistered: false, includeAllStores: false, lookupProfile: false });
  var t1 = Date.now();
  var sid = (loginOnly.stores && loginOnly.stores[0]) ? loginOnly.stores[0].store_id : '';
  var ym = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
  var month = sid ? getShiftsCore_(sid, ym, loginOnly.email, loginOnly.__acl || resolveAclCached_(loginOnly.email), false) : null;
  var t2 = Date.now();
  var full = resumeWorkspace(email, sid, ym, true);
  var t3 = Date.now();
  return {
    ok: true,
    email: email,
    storeId: sid,
    yearMonth: ym,
    msLoginBuild: t1 - t0,
    msMonthRead: t2 - t1,
    msResumeTotal: t3 - t0,
    msResumeCall: t3 - t2,
    shiftCount: month && month.shifts ? month.shifts.length : 0,
    fromCache: !!(full.month && full.month.fromCache)
  };
}

/**
 * 管轄店舗を登録（初回／変更）
 * payload: { user_email, display_name, bye_code?, store_ids: string[], role? }
 * → スプシ「社員登録」シート（A=メール, B=管轄店舗, C=表示名, D=社員コード, …）
 */
function saveJurisdiction(payload) {
  var p = payload || {};
  var email = softResolveEmail_(p.user_email);
  var storeIds = Array.isArray(p.store_ids) ? p.store_ids : [];
  if (!storeIds.length) throw new Error('管轄店舗を1つ以上選んでください。');

  var byeCode = normalizeByeCode_(p.bye_code);
  if (!byeCode) throw new Error('社員番号を入力してください。');

  invalidateRequestCache_(['stores', 'knownStoreMap']);
  invalidateAclCache_(email);
  var all = listAllStoresCached_() || [];
  var byId = {};
  var byName = {};
  all.forEach(function (s) {
    byId[String(s.store_id)] = s;
    var nm = String(s.store_name || '').trim().replace(/[\s　]/g, '');
    if (nm) byName[nm] = s;
  });

  var resolved = [];
  storeIds.forEach(function (raw) {
    var id = String(raw || '').trim();
    if (!id) return;
    if (byId[id]) {
      resolved.push(id);
      return;
    }
    var nm = id.replace(/[\s　]/g, '');
    if (byName[nm]) {
      resolved.push(byName[nm].store_id);
      return;
    }
    // フォールバックID（S001/S002）も許可
    if (/^S00[12]$/i.test(id)) {
      resolved.push(id.toUpperCase());
      return;
    }
    throw new Error('不正な店舗です: ' + id);
  });
  if (!resolved.length) throw new Error('管轄店舗を1つ以上選んでください。');

  var displayName = String(p.display_name || '').trim();
  upsertManagerStores_(email, resolved, displayName, byeCode);
  if (displayName) {
    try { upsertSelfProfileName_(email, displayName); } catch (eName) { /* 任意 */ }
  }

  invalidateRequestCache_(['stores', 'knownStoreMap', 'employees']);
  invalidateAclCache_(email);
  return loginWithEmail(email);
}

/* ============================================================
 * スタッフ認証（社員コード＋氏名＋パスワード）
 * ============================================================ */
function staffVerifyIdentity(byeCode, name) {
  var emp = findEmployeeRowByCode_(byeCode);
  if (!emp) {
    throw new Error('社員コードが見つかりません。\n店長が「アルバイト登録」に入れているか確認してください。');
  }
  if (!namesMatch_(name, emp.name, emp.name_key)) {
    throw new Error('氏名が一致しません。\nフルネーム（例: 澤野 郁哉）で入力してください。');
  }
  return {
    ok: true,
    bye_code: emp.bye_code,
    name: emp.name,
    store_id: emp.store_id,
    needsPassword: !emp.staff_registered
  };
}

function staffSetPassword(byeCode, name, password) {
  assertStaffPassword_(password, byeCode);
  var emp = findEmployeeRowByCode_(byeCode);
  if (!emp) {
    throw new Error('社員コードと氏名が一致しません。\n店長に確認してください。');
  }
  if (!namesMatch_(name, emp.name, emp.name_key)) {
    throw new Error('社員コードと氏名が一致しません。\n店長に確認してください。');
  }
  writeStaffPassword_(emp.rowIndex, password);
  return staffLogin(byeCode, password);
}

function staffLogin(byeCode, password) {
  var emp = findEmployeeRowByCode_(byeCode);
  if (!emp || !emp.staff_registered) {
    throw new Error('社員コードまたはパスワードが正しくありません。');
  }
  if (!verifyStaffPassword_(password, emp.password_hash, emp.password_salt)) {
    throw new Error('社員コードまたはパスワードが正しくありません。');
  }
  var token = createStaffSession_(emp);
  return buildStaffLoginResponse_(emp, token);
}

function staffResumeSession(token) {
  var sess = resolveStaffSession_(token);
  if (!sess) throw new Error('セッションの有効期限が切れました。再度ログインしてください。');
  var emp = findEmployeeRowByCode_(sess.bye_code);
  if (!emp || !emp.staff_registered) throw new Error('登録情報が見つかりません。店長に確認してください。');
  return buildStaffLoginResponse_(emp, token);
}

function buildStaffLoginResponse_(emp, token) {
  var all = listAllStores_();
  var store = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].store_id === emp.store_id) { store = all[i]; break; }
  }
  if (!store) {
    // 店舗IDが名前の場合も解決
    for (var j = 0; j < all.length; j++) {
      if (storeNamesMatch_(all[j].store_name, emp.store_id) || all[j].store_id === emp.store_id) {
        store = all[j];
        break;
      }
    }
  }
  if (!store && emp.store_id) {
    store = {
      store_id: emp.store_id,
      store_name: emp.store_id,
      area: '',
      territory: '',
      sort_order: 0,
      active: true
    };
  }
  if (!store) throw new Error('所属店舗が見つかりません。店長に確認してください。');
  return {
    ok: true,
    userType: 'staff',
    sessionToken: token,
    bye_code: emp.bye_code,
    employee_id: emp.bye_code,
    email: 'staff:' + emp.bye_code,
    name: emp.name,
    roleMax: SHIFT_APP.ROLES.VIEWER,
    isAdmin: false,
    needsJurisdiction: false,
    canEdit: false,
    stores: [{
      store_id: store.store_id,
      store_name: store.store_name,
      area: store.area,
      sort_order: store.sort_order,
      role: SHIFT_APP.ROLES.VIEWER
    }],
    allStores: [store],
    areas: store.area ? [store.area] : [],
    appTitle: resolveAppTitle_(),
    statuses: SHIFT_APP.STATUS.slice(),
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice()
  };
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

  var empTypeIn = String(p.employment_type || rowVals[map.employment_type] || 'アルバイト').trim();
  // UI・シートとも「アルバイト」（旧「パート」もアルバイト扱い）
  var isPart = (empTypeIn === 'アルバイト' || empTypeIn === 'パート');
  var sheetEmpType = isPart ? 'アルバイト' : (empTypeIn === 'その他' ? 'その他' : '社員');

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

  invalidateRequestCache_(['employees']);
  clearEmpScriptCache_(storeId);
  return { ok: true, employee: listEmployeesDetailed_(storeId).filter(function (e) { return e.employee_id === employeeId; })[0] };
}

/** 退職処理 — マスタ行を物理削除（週間テンプレも削除。過去シフト行は残す） */
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
    sh.deleteRow(r + 1);
    purgeWeeklyForEmployee_(storeId, id);
    invalidateRequestCache_(['employees']);
    clearEmpScriptCache_(storeId);
    return { ok: true, deleted: id };
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
  var ensured = ensureWeeklyLeaveCodeHeader_(sh);
  var map = ensured.map;
  requireHeaders_(map, ['weekly_id', 'employee_id', 'store_id', 'weekday', 'status']);
  var employeesForStore = listEmployeesDetailed_(storeId);
  var resolveEmpId = empIdResolver_(storeId, employeesForStore);
  var values = getDataRows_(sh);
  var out = [];
  var pickedIdx = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (map.is_active != null && !isTruthy_(r[map.is_active])) continue;
    // 同じスタッフ×同じ曜日が重複していたら、入力済み（undef以外）を優先して1件にする
    var wkEmpId = resolveEmpId(r[map.employee_id]);
    var wkStatus = String(r[map.status] || 'undef');
    var wkKey = wkEmpId + '__' + Number(r[map.weekday]);
    if (pickedIdx[wkKey] != null) {
      var keptW = out[pickedIdx[wkKey]];
      var keptOk = keptW.status && keptW.status !== 'undef' ? 1 : 0;
      var curOk = wkStatus && wkStatus !== 'undef' ? 1 : 0;
      if (curOk < keptOk) continue;
      out.splice(pickedIdx[wkKey], 1);
      var wkKeys = Object.keys(pickedIdx);
      for (var wi2 = 0; wi2 < wkKeys.length; wi2++) {
        if (pickedIdx[wkKeys[wi2]] > pickedIdx[wkKey]) pickedIdx[wkKeys[wi2]] -= 1;
      }
      delete pickedIdx[wkKey];
    }
    pickedIdx[wkKey] = out.length;
    out.push({
      weekly_id: String(r[map.weekly_id] || ''),
      employee_id: wkEmpId,
      store_id: storeId,
      weekday: Number(r[map.weekday]),
      status: wkStatus,
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time]),
      break_minutes: r[map.break_minutes] === '' || r[map.break_minutes] == null ? '' : Number(r[map.break_minutes]),
      leave_code: map.leave_code != null && r[map.leave_code] !== '' && r[map.leave_code] != null ? Number(r[map.leave_code]) : ''
    });
  }
  return {
    ok: true,
    storeId: storeId,
    canEdit: canEditStore_(acl, storeId),
    employees: employeesForStore,
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
  var ensured = ensureWeeklyLeaveCodeHeader_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, ['weekly_id', 'employee_id', 'store_id', 'weekday', 'status', 'is_active']);

  // employee_id / employee_ids 指定時は、その対象だけを差し替える（他スタッフの登録を消さない）
  var scopeEmp = String(p.employee_id || '').trim();
  var scopeList = {};
  var hasScopeList = false;
  var rawList = p.employee_ids;
  if (typeof rawList === 'string' && rawList) {
    try { rawList = JSON.parse(rawList); } catch (eJson) { rawList = rawList.split(','); }
  }
  if (Array.isArray(rawList)) {
    for (var li = 0; li < rawList.length; li++) {
      var lid = empKeyOf_(rawList[li]);
      if (!lid) continue;
      scopeList[lid] = true;
      hasScopeList = true;
    }
  }
  if (scopeEmp) {
    scopeList[empKeyOf_(scopeEmp)] = true;
    hasScopeList = true;
  }
  function inScope_(empId) {
    if (!hasScopeList) return true;
    return !!scopeList[empKeyOf_(empId)];
  }
  // 同時保存で他店の行を壊さないよう直列化
  var weeklyLock = LockService.getScriptLock();
  try { weeklyLock.waitLock(20000); } catch (eLock) {
    throw new Error('他の保存と競合しました。少し待ってからもう一度お試しください。');
  }
  var lastRow = sh.getLastRow();
  var lastCol = Math.max(sh.getLastColumn(), headers.length);
  // 全列は読まず、店舗ID・従業員IDの列だけを見て対象行を特定する（多店舗でも軽い）
  var keyMinCol = Math.min(map.store_id, map.employee_id) + 1;
  var keyMaxCol = Math.max(map.store_id, map.employee_id) + 1;
  var keyVals = lastRow >= 2
    ? sh.getRange(2, keyMinCol, lastRow - 1, keyMaxCol - keyMinCol + 1).getValues()
    : [];
  var storeIdx = map.store_id + 1 - keyMinCol;
  var empIdx = map.employee_id + 1 - keyMinCol;
  var targetRows = [];
  for (var r = 0; r < keyVals.length; r++) {
    var rowStore = String(keyVals[r][storeIdx] || '').trim();
    if (rowStore !== storeId) continue;
    var rowEmp = String(keyVals[r][empIdx] || '').trim();
    if (!inScope_(rowEmp)) continue;
    targetRows.push(r + 2);
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var toAppend = [];
  items.forEach(function (it, idx) {
    var empId = String(it.employee_id || '').trim();
    var wd = Number(it.weekday);
    var status = String(it.status || 'undef');
    if (!empId) return;
    if (isNaN(wd) || wd < 0 || wd > 6) return;
    if (SHIFT_APP.STATUS.indexOf(status) < 0) status = 'undef';

    var start = String(it.start_time || '').trim();
    var end = String(it.end_time || '').trim();
    var leaveCode = it.leave_code === '' || it.leave_code == null ? '' : Number(it.leave_code);
    if (leaveCode) status = leaveStatusFromCode_(leaveCode) || status;
    if (status === 'work') {
      if (!isHm_(start) || !isHm_(end)) throw new Error('勤務の曜日は開始・終了時刻が必要です（' + empId + ' / 曜' + wd + '）');
    } else {
      start = '';
      end = '';
    }

    if (!inScope_(empId)) return;

    var row = new Array(lastCol).fill('');
    row[map.weekly_id] = 'W' + storeId + '-' + empId + '-D' + wd + '-' + idx;
    row[map.employee_id] = empId;
    row[map.store_id] = storeId;
    row[map.weekday] = wd;
    row[map.status] = status;
    row[map.start_time] = start;
    row[map.end_time] = end;
    if (map.leave_code != null) row[map.leave_code] = leaveCode;
    if (map.break_minutes != null) {
      row[map.break_minutes] = it.break_minutes === '' || it.break_minutes == null ? '' : Number(it.break_minutes);
    }
    row[map.is_active] = true;
    if (map.updated_at != null) row[map.updated_at] = now;
    if (map.updated_by != null) row[map.updated_by] = email;
    toAppend.push(row);
  });

  // 当店（指定時は対象スタッフ）の既存行を上書き。余りは追記、超過分は空にする
  var reuse = Math.min(targetRows.length, toAppend.length);
  var wi = 0;
  while (wi < reuse) {
    var runStart = wi;
    while (wi + 1 < reuse && targetRows[wi + 1] === targetRows[wi] + 1) wi++;
    writeSheetRows_(sh, targetRows[runStart], toAppend.slice(runStart, wi + 1));
    wi++;
  }
  if (toAppend.length > targetRows.length) {
    writeSheetRows_(sh, sh.getLastRow() + 1, toAppend.slice(targetRows.length));
  } else if (targetRows.length > toAppend.length) {
    var ci = toAppend.length;
    while (ci < targetRows.length) {
      var clrStart = ci;
      while (ci + 1 < targetRows.length && targetRows[ci + 1] === targetRows[ci] + 1) ci++;
      sh.getRange(targetRows[clrStart], 1, ci - clrStart + 1, lastCol).clearContent();
      ci++;
    }
  }

  try { weeklyLock.releaseLock(); } catch (eRel) { /* ignore */ }

  var weeklyOut = [];
  toAppend.forEach(function (row) {
    weeklyOut.push({
      weekly_id: String(row[map.weekly_id] || ''),
      employee_id: String(row[map.employee_id] || ''),
      store_id: storeId,
      weekday: Number(row[map.weekday]),
      status: String(row[map.status] || 'undef'),
      start_time: formatHm_(row[map.start_time]),
      end_time: formatHm_(row[map.end_time]),
      break_minutes: row[map.break_minutes] === '' || row[map.break_minutes] == null ? '' : Number(row[map.break_minutes]),
      leave_code: map.leave_code != null && row[map.leave_code] !== '' && row[map.leave_code] != null ? Number(row[map.leave_code]) : ''
    });
  });

  return {
    ok: true,
    storeId: storeId,
    canEdit: canEditStore_(acl, storeId),
    weekly: weeklyOut,
    employee_id: scopeEmp,
    employee_ids: hasScopeList ? Object.keys(scopeList) : null,
    scoped: hasScopeList,
    weekdayLabels: SHIFT_APP.WEEKDAY_LABELS.slice(),
    saved: toAppend.length
  };
}

/* ============================================================
 * 店舗別データシート（シフト_経堂 / シフトメモ_経堂）＋ シフト一覧
 * ============================================================ */

function isYmShiftSheetName_(n) {
  return /^シフト_\d{4}-\d{2}$/.test(String(n || '')) || /^シフト_\d{4}年\d{1,2}月$/.test(String(n || ''));
}

function isYmMemoSheetName_(n) {
  return /^シフトメモ_\d{4}-\d{2}$/.test(String(n || '')) || /^シフトメモ_\d{4}年\d{1,2}月$/.test(String(n || ''));
}

function sanitizeSheetNamePart_(name) {
  var s = String(name || '').trim()
    .replace(/[\/\\?\*\[\]\:]/g, '')
    .replace(/[\s　]+/g, '');
  if (!s) s = '未設定';
  if (s.length > 70) s = s.substring(0, 70);
  return s;
}

function resolveStoreName_(storeId) {
  var sid = String(storeId || '').trim();
  if (!sid) return '未設定';
  try {
    var all = listAllStores_();
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].store_id) === sid) return String(all[i].store_name || sid);
    }
  } catch (e1) { /* ignore */ }
  return sid;
}

function storeShiftSheetName_(storeId) {
  return 'シフト_' + sanitizeSheetNamePart_(resolveStoreName_(storeId));
}

function storeMemoSheetName_(storeId) {
  return 'シフトメモ_' + sanitizeSheetNamePart_(resolveStoreName_(storeId));
}

/** 後方互換: 旧月次名（移行用） */
function shiftMonthlySheetName_(ym) {
  var s = String(ym || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) throw new Error('年月は yyyy-MM 形式です。');
  return 'シフト_' + s;
}

function memoMonthlySheetName_(ym) {
  var s = String(ym || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) throw new Error('年月は yyyy-MM 形式です。');
  return 'シフトメモ_' + s;
}

function ensureShiftHeadersLean_(sh) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  var needed = ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time', 'break_minutes', 'leave_code'];
  for (var i = 0; i < needed.length; i++) {
    var key = needed[i];
    if (map[key] != null) continue;
    var label = HEADER_JA[key] || key;
    if (key === 'leave_code' && (map['休暇コード'] != null)) {
      map.leave_code = map['休暇コード'];
      continue;
    }
    var col = headers.length + 1;
    sh.getRange(1, col).setValue(label);
    headers.push(label);
    map[key] = col - 1;
    map[label] = col - 1;
  }
  var finalHeaders = getHeaders_(sh);
  var finalMap = headerIndexMap_(finalHeaders);
  // 毎回 getMaxRows 全体に書式を当てると起動が遅くなるので、シートごとに1回だけ
  ensureEmployeeIdTextFormatOnce_(sh, finalMap);
  return { headers: finalHeaders, map: finalMap };
}

/** 軽い見た目（条件付き書式は使わない＝重くしない） */
function applyLightStoreShiftStyle_(sh) {
  if (!sh) return;
  var cols = Math.max(sh.getLastColumn(), STORE_SHIFT_HEADERS_JA.length);
  var head = sh.getRange(1, 1, 1, cols);
  head.setFontWeight('bold');
  head.setBackground('#3a86c4');
  head.setFontColor('#ffffff');
  head.setHorizontalAlignment('center');
  try { sh.setFrozenRows(1); } catch (eF) { /* ignore */ }
  try {
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 110);
    sh.setColumnWidth(3, 90);
    sh.setColumnWidth(4, 70);
    sh.setColumnWidth(5, 70);
    sh.setColumnWidth(6, 70);
    sh.setColumnWidth(7, 70);
    sh.setColumnWidth(8, 70);
    sh.setColumnWidth(9, 110);
  } catch (eW) { /* ignore */ }
}

function polishStoreShiftSheetLight_(sh) {
  if (!sh) return;
  var props = PropertiesService.getDocumentProperties();
  var key = 'SS_STYLE_V1_' + sh.getSheetId();
  if (props.getProperty(key) !== '1') {
    applyLightStoreShiftStyle_(sh);
    props.setProperty(key, '1');
  } else {
    try { sh.setFrozenRows(1); } catch (e) { /* ignore */ }
  }
}

/** 日付の新しい順 → 同じ日は従業員ID順（アプリ動作には影響しないが見やすさ用） */
function sortStoreShiftSheetByDateDesc_(sh) {
  if (!sh) return 0;
  var lastRow = sh.getLastRow();
  if (lastRow < 3) return 0;
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.date == null) return 0;
  var lastCol = Math.max(sh.getLastColumn(), STORE_SHIFT_HEADERS_JA.length);
  var dateCol = map.date + 1;
  var empCol = map.employee_id != null ? map.employee_id + 1 : dateCol;
  sh.getRange(2, 1, lastRow, lastCol).sort([
    { column: dateCol, ascending: false },
    { column: empCol, ascending: true }
  ]);
  return lastRow - 1;
}

function menuSortStoreShiftSheets() {
  var ss = ss_();
  var n = 0;
  var sheets = 0;
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (name.indexOf('シフト_') !== 0) return;
    if (isYmShiftSheetName_(name) || name === SHIFT_INDEX_SHEET) return;
    polishStoreShiftSheetLight_(sh);
    n += sortStoreShiftSheetByDateDesc_(sh);
    sheets += 1;
  });
  SpreadsheetApp.getUi().alert(
    '完了',
    '店舗シフトシート ' + sheets + ' 枚を最新日付順に整えました（行数の合計目安: ' + n + '）。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 店舗名を改称した場合、旧名の店舗シート（例: シフト_ひばりが丘）を
 * 新名（シフト_YOGAフレスポひばりが丘）へ引き継ぐ。
 */
function adoptRenamedStoreSheet_(prefix, storeId, newName) {
  var ss = ss_();
  var target = sanitizeSheetNamePart_(resolveStoreName_(storeId));
  if (!target || target === '未設定') return null;
  var currentNames = {};
  try {
    listAllStores_().forEach(function (s) {
      currentNames[sanitizeSheetNamePart_(s.store_name)] = true;
    });
  } catch (e) { /* ignore */ }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var n = sh.getName();
    if (n === newName || n.indexOf(prefix) !== 0) continue;
    if (n === SHIFT_INDEX_SHEET) continue;
    if (isYmShiftSheetName_(n) || isYmMemoSheetName_(n)) continue;
    var part = n.substring(prefix.length);
    if (part.length < 2 || currentNames[part]) continue;
    if (target.indexOf(part) < 0 && part.indexOf(target) < 0) continue;
    try {
      sh.setName(newName);
      return sh;
    } catch (eRename) {
      return null;
    }
  }
  return null;
}

function ensureShiftSheetForStore_(storeId) {
  var ss = ss_();
  var name = storeShiftSheetName_(storeId);
  var sh = ss.getSheetByName(name);
  if (!sh) sh = adoptRenamedStoreSheet_('シフト_', storeId, name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, STORE_SHIFT_HEADERS_JA.length).setValues([STORE_SHIFT_HEADERS_JA]);
    try { sh.hideSheet(); } catch (e0) { /* ignore */ }
  }
  ensureShiftHeadersLean_(sh);
  polishStoreShiftSheetLight_(sh);
  return sh;
}

function mustShiftSheetForStore_(storeId) {
  return ensureShiftSheetForStore_(storeId);
}

/** @deprecated 月次→店舗別に置換。storeId があれば店舗シートを返す */
function mustShiftSheetForMonth_(ym, storeId) {
  if (storeId) return mustShiftSheetForStore_(storeId);
  // 旧呼び出し救済: ym だけなら従来の月次を開く（移行前）
  var ss = ss_();
  var name = shiftMonthlySheetName_(ym);
  var sh = ss.getSheetByName(name);
  if (sh) {
    ensureLeaveCodeHeader_(sh);
    return sh;
  }
  throw new Error('店舗IDが必要です（店舗別シート）。');
}

function ensureMemoSheetForStore_(storeId) {
  var ss = ss_();
  var name = storeMemoSheetName_(storeId);
  var sh = ss.getSheetByName(name);
  if (!sh) sh = adoptRenamedStoreSheet_('シフトメモ_', storeId, name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, STORE_MEMO_HEADERS_JA.length).setValues([STORE_MEMO_HEADERS_JA]);
    try { sh.hideSheet(); } catch (e0) { /* ignore */ }
  }
  ensureMemoHeaders_(sh);
  return sh;
}

function ensureMemoSheetForMonth_(ym, storeId) {
  if (storeId) return ensureMemoSheetForStore_(storeId);
  var ss = ss_();
  var name = memoMonthlySheetName_(ym);
  var sh = ss.getSheetByName(name);
  if (sh) {
    ensureMemoHeaders_(sh);
    return sh;
  }
  return ensureMemoSheetForStore_('unknown');
}

function ensureMemoHeaders_(sh) {
  var needed = ['memo_id', 'date', 'employee_id', 'body'];
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  for (var i = 0; i < needed.length; i++) {
    var key = needed[i];
    if (map[key] != null) continue;
    if (key === 'kind' && map.type != null) {
      map.kind = map.type;
      continue;
    }
    var col = headers.length + 1;
    var label = HEADER_JA[key] || key;
    sh.getRange(1, col).setValue(label);
    headers.push(label);
    map[key] = col - 1;
    map[label] = col - 1;
  }
  // 旧互換
  if (map.kind == null && map.type != null) map.kind = map.type;
  return { headers: getHeaders_(sh), map: headerIndexMap_(getHeaders_(sh)) };
}

function inferBreakMinutes_(status, start, end) {
  if (String(status || '') !== 'work') return '';
  if (!isHm_(start) || !isHm_(end)) return '';
  var a = String(start).split(':');
  var b = String(end).split(':');
  var mins = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
  if (mins >= 8 * 60) return 60;
  return '';
}

function ensureStoreSheetMigrationOnce_(opts) {
  opts = opts || {};
  var props = PropertiesService.getDocumentProperties();
  if (!opts.force && props.getProperty(STORE_SHEETS_PROP) === '1') return { skipped: true };
  var r = migrateToStoreSheetsAndWipe_({ rebuildIndex: true, force: !!opts.force });
  props.setProperty(STORE_SHEETS_PROP, '1');
  if (!opts.quiet) {
    try {
      ss_().toast('店舗別シートへ移行しました', 'シフト基盤', 5);
    } catch (e) { /* ignore */ }
  }
  return r;
}

function migrateToStoreSheetsAndWipe_(opts) {
  opts = opts || {};
  var ss = ss_();
  var shiftRows = 0;
  var memoRows = 0;
  var deletedSheets = 0;
  var byStoreShifts = {};
  var byStoreMemos = {};

  function ingestShiftSheet_(sh) {
    if (!sh) return;
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.date == null || map.employee_id == null) return;
    var values = getDataRows_(sh);
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var date = normalizeDate_(r[map.date]);
      var eid = String(r[map.employee_id] || '').trim();
      if (!date || !eid) continue;
      var sid = map.store_id != null ? String(r[map.store_id] || '').trim() : '';
      if (!sid) continue;
      if (!byStoreShifts[sid]) byStoreShifts[sid] = {};
      var status = String(r[map.status] || 'undef');
      var start = map.start_time != null ? formatHm_(r[map.start_time]) : '';
      var end = map.end_time != null ? formatHm_(r[map.end_time]) : '';
      var br = map.break_minutes != null && r[map.break_minutes] !== '' && r[map.break_minutes] != null
        ? Number(r[map.break_minutes])
        : inferBreakMinutes_(status, start, end);
      byStoreShifts[sid][eid + '__' + date] = {
        shift_id: map.shift_id != null ? String(r[map.shift_id] || '') : '',
        date: date,
        employee_id: eid,
        store_id: sid,
        status: status,
        start_time: start,
        end_time: end,
        break_minutes: br,
        leave_code: map.leave_code != null && r[map.leave_code] !== '' && r[map.leave_code] != null ? Number(r[map.leave_code]) : ''
      };
    }
  }

  function ingestMemoSheet_(sh) {
    if (!sh) return;
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.date == null || map.employee_id == null) return;
    var values = getDataRows_(sh);
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var date = normalizeDate_(r[map.date]);
      var eid = String(r[map.employee_id] || '').trim();
      var body = map.body != null ? String(r[map.body] || '').trim() : '';
      if (!date || !eid || !body) continue;
      var sid = map.store_id != null ? String(r[map.store_id] || '').trim() : '';
      if (!sid) continue;
      if (!byStoreMemos[sid]) byStoreMemos[sid] = {};
      byStoreMemos[sid][eid + '__' + date] = {
        memo_id: map.memo_id != null ? String(r[map.memo_id] || '') : '',
        date: date,
        employee_id: eid,
        body: body
      };
    }
  }

  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n === 'シフト' || isYmShiftSheetName_(n)) ingestShiftSheet_(sh);
    if (n === 'シフトメモ' || isYmMemoSheetName_(n)) ingestMemoSheet_(sh);
  });

  Object.keys(byStoreShifts).forEach(function (sid) {
    var sh = mustShiftSheetForStore_(sid);
    var ensured = ensureShiftHeadersLean_(sh);
    var map = ensured.map;
    var headers = ensured.headers;
    var existing = {};
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var d0 = normalizeDate_(data[r][map.date]);
      var eid = String(data[r][map.employee_id] || '');
      if (d0 && eid) existing[eid + '__' + d0] = r + 1;
    }
    var rows = [];
    Object.keys(byStoreShifts[sid]).forEach(function (k) {
      var it = byStoreShifts[sid][k];
      if (existing[k]) return;
      var row = new Array(headers.length).fill('');
      row[map.shift_id] = it.shift_id || ('SHMIG-' + it.employee_id + '-' + it.date);
      row[map.date] = it.date;
      row[map.employee_id] = it.employee_id;
      row[map.store_id] = sid;
      row[map.status] = it.status || 'undef';
      row[map.start_time] = it.start_time || '';
      row[map.end_time] = it.end_time || '';
      if (map.break_minutes != null) row[map.break_minutes] = it.break_minutes;
      if (map.leave_code != null) row[map.leave_code] = it.leave_code;
      rows.push(row);
      shiftRows++;
    });
    if (rows.length) writeSheetRows_(sh, sh.getLastRow() + 1, rows);
  });

  Object.keys(byStoreMemos).forEach(function (sid) {
    var sh = ensureMemoSheetForStore_(sid);
    var ensured = ensureMemoHeaders_(sh);
    var map = ensured.map;
    var headers = getHeaders_(sh);
    var existing = {};
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var d0 = normalizeDate_(data[r][map.date]);
      var eid = String(data[r][map.employee_id] || '');
      if (d0 && eid) existing[eid + '__' + d0] = true;
    }
    var rows = [];
    Object.keys(byStoreMemos[sid]).forEach(function (k) {
      var it = byStoreMemos[sid][k];
      if (existing[k]) return;
      var row = new Array(headers.length).fill('');
      row[map.memo_id] = it.memo_id || ('MMMIG-' + it.employee_id + '-' + it.date);
      row[map.date] = it.date;
      row[map.employee_id] = it.employee_id;
      row[map.body] = it.body;
      rows.push(row);
      memoRows++;
    });
    if (rows.length) writeSheetRows_(sh, sh.getLastRow() + 1, rows);
  });

  var toDelete = [];
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n === 'シフト' || n === 'シフトメモ' || isYmShiftSheetName_(n) || isYmMemoSheetName_(n)) {
      toDelete.push(sh);
      return;
    }
    if (OBSOLETE_SHEETS.indexOf(n) >= 0) {
      toDelete.push(sh);
    }
  });
  // 最低1枚は残す（スプシ制約）
  var keepNames = {
    'アルバイト登録': true,
    '社員登録': true,
    '店舗データ': true,
    'シフト一覧': true,
    '週間固定': true,
    'スタッフログイン': true,
    '設定': true
  };
  toDelete = toDelete.filter(function (sh) {
    return !keepNames[sh.getName()];
  });
  toDelete.forEach(function (sh) {
    try {
      if (ss.getSheets().length <= 1) return;
      ss.deleteSheet(sh);
      deletedSheets++;
    } catch (eDel) { /* ignore */ }
  });

  if (opts.rebuildIndex !== false) rebuildShiftIndexSheet_();
  applyPilotSheetVisibility_();
  try {
    PropertiesService.getDocumentProperties().setProperty(STORE_SHEETS_PROP, '1');
  } catch (eProp) { /* ignore */ }
  return { ok: true, shiftRows: shiftRows, memoRows: memoRows, deletedSheets: deletedSheets };
}

function rebuildShiftIndexSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHIFT_INDEX_SHEET);
  if (!sh) sh = ss.insertSheet(SHIFT_INDEX_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, SHIFT_INDEX_HEADERS_JA.length).setValues([SHIFT_INDEX_HEADERS_JA]);
  sh.getRange(1, 1, 1, SHIFT_INDEX_HEADERS_JA.length)
    .setFontWeight('bold')
    .setBackground('#e3f2fd');

  var nameByEmp = {};
  try {
    var stores = listAllStores_();
    stores.forEach(function (st) {
      listEmployeesDetailed_(st.store_id).forEach(function (e) {
        nameByEmp[String(e.employee_id || e.bye_code || '')] = e.name || '';
      });
    });
  } catch (eName) { /* ignore */ }

  var out = [];
  ss.getSheets().forEach(function (src) {
    var n = src.getName();
    if (n.indexOf('シフト_') !== 0 || isYmShiftSheetName_(n) || n === SHIFT_INDEX_SHEET) return;
    if (n.indexOf('シフトメモ_') === 0) return;
    var map = headerIndexMap_(getHeaders_(src));
    if (map.date == null || map.employee_id == null) return;
    var storeLabel = n.replace(/^シフト_/, '');
    var values = getDataRows_(src);
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var date = normalizeDate_(r[map.date]);
      var eid = String(r[map.employee_id] || '').trim();
      if (!date || !eid) continue;
      var start = map.start_time != null ? formatHm_(r[map.start_time]) : '';
      var end = map.end_time != null ? formatHm_(r[map.end_time]) : '';
      var status = map.status != null ? String(r[map.status] || '') : '';
      var br = map.break_minutes != null && r[map.break_minutes] !== '' && r[map.break_minutes] != null
        ? Number(r[map.break_minutes])
        : inferBreakMinutes_(status, start, end);
      var leave = map.leave_code != null && r[map.leave_code] !== '' && r[map.leave_code] != null
        ? Number(r[map.leave_code])
        : '';
      out.push([
        storeLabel,
        date.substring(0, 7),
        date,
        eid,
        nameByEmp[eid] || '',
        start,
        end,
        br,
        leave
      ]);
    }
  });

  out.sort(function (a, b) {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]), 'ja');
    if (a[2] !== b[2]) return String(a[2]).localeCompare(String(b[2]));
    return String(a[3]).localeCompare(String(b[3]));
  });

  if (out.length) {
    sh.getRange(2, 1, 1 + out.length, SHIFT_INDEX_HEADERS_JA.length).setValues(out);
  }
  sh.setFrozenRows(1);
  try {
    var filter = sh.getFilter();
    if (filter) filter.remove();
    sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), SHIFT_INDEX_HEADERS_JA.length).createFilter();
  } catch (eF) { /* ignore */ }
  try { sh.showSheet(); } catch (eS) { /* ignore */ }
  return out.length;
}

function hideAllMonthlyDataSheets_() {
  var ss = ss_();
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n === SHIFT_INDEX_SHEET) return;
    if (n.indexOf('シフト_') === 0 || n.indexOf('シフトメモ_') === 0) {
      try { sh.hideSheet(); } catch (e) { /* ignore */ }
    }
  });
}

function purgeWeeklyForEmployee_(storeId, employeeId) {
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.WEEKLY);
  if (!sh || sh.getLastRow() < 2) return;
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.employee_id == null || map.store_id == null) return;
  var data = sh.getDataRange().getValues();
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][map.store_id] || '') !== String(storeId)) continue;
    if (empKeyOf_(data[r][map.employee_id]) !== empKeyOf_(employeeId)) continue;
    sh.deleteRow(r + 1);
  }
}

/* ============================================================
 * 月間シフト
 * ============================================================ */

/**
 * 月間取得。編集権限がある場合は週間テンプレを自動で空き日に展開してから返す。
 * （「週間どおりに作成」ボタン不要）
 */
/**
 * applyWeekly: true/省略=必要なら週次展開、false=読み取りのみ（プリフェッチ用）
 * URL/JSONP では "0"/"false" でも false 扱い
 */
function getShifts(storeId, yearMonth, userEmail, applyWeekly) {
  // 起動パスでは移行・一覧再構築を走らせない（重い／タイムアウトの原因）
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAclCached_(email);
  assertStoreAccess_(acl, storeId, false);
  return getShiftsCore_(storeId, yearMonth, email, acl, applyWeekly);
}

function getShiftsCore_(storeId, yearMonth, email, acl, applyWeekly) {
  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');

  // 既定は反映しない（表示は読むだけ。反映は「テンプレ反映」から明示的に行う）
  var doApply = false;
  if (applyWeekly === true || applyWeekly === 1) doApply = true;
  else if (typeof applyWeekly === 'string') {
    var aw = String(applyWeekly).toLowerCase();
    if (aw === '1' || aw === 'true' || aw === 'yes') doApply = true;
  }

  if (!doApply) {
    var cached = readShiftMonthCache_(storeId, ym);
    if (cached) {
      cached.canEdit = canEditStore_(acl, storeId);
      cached.fromCache = true;
      return cached;
    }
  }

  var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
  var map = ensured.map;
  var shiftValues = getDataRows_(sh);
  var employees = listEmployeesDetailed_(storeId);
  var applied = null;

  if (doApply && canEditStore_(acl, storeId)) {
    var partsYm = ym.split('-');
    var daysYm = new Date(Number(partsYm[0]), Number(partsYm[1]), 0).getDate();
    var expectedYm = employees.length * daysYm;
    var filledYm = countFilledShiftsForYm_(shiftValues, map, storeId, ym);
    if (expectedYm > 0 && filledYm >= expectedYm) {
      // 全日済みなら週次シート読込・書込を完全スキップ
      applied = {
        created: 0,
        skipped: expectedYm,
        overwrite: false,
        applied: true,
        reason: 'already_filled',
        fast: true,
        sheetReload: false
      };
    } else {
      applied = applyWeeklyToMonth_(storeId, ym, email, false, {
        strict: false,
        employees: employees,
        prefetchedValues: shiftValues,
        prefetchedMap: map,
        prefetchedSheet: sh
      });
      if (applied && applied.sheetReload) shiftValues = getDataRows_(sh);
    }
  }

  var result = readShifts_(storeId, ym, email, acl, {
    employees: employees,
    prefetchedValues: shiftValues,
    prefetchedMap: map
  });
  result.appliedFromWeekly = applied;
  if (!doApply) writeShiftMonthCache_(storeId, ym, result);
  // 起動は遅くせず、数分後／夜間に古い行を保管へ退避（手作業不要）
  try {
    ensureAutoArchiveTrigger_();
    kickDeferredArchiveIfNeeded_(storeId, sh.getLastRow());
  } catch (eTrig) { /* ignore */ }
  return result;
}

/* ============================================================
 * 古いシフトの自動退避（運用者がスプシを触らなくてよい）
 * - 表示用シートには直近数ヶ月だけ残す
 * - 古い行は「シフト_{店}_保管」へ移動（削除ではない）
 * - 夜のトリガー＋起動時の軽量キック
 * ============================================================ */
var SHIFT_AUTO_KEEP_BACK = 2; // 基準月の何ヶ月前まで残すか
var SHIFT_AUTO_KEEP_FWD = 1;  // 基準月の何ヶ月先まで残すか
var SHIFT_AUTO_ARCHIVE_MIN_ROWS = 700;
var SHIFT_AUTO_ARCHIVE_MAX_MOVE = 4000;

function storeShiftArchiveSheetName_(storeId) {
  var base = storeShiftSheetName_(storeId);
  var name = base + '_保管';
  if (name.length > 95) name = name.substring(0, 95);
  return name;
}

function ymToIndex_(ym) {
  var p = String(ym || '').split('-');
  return Number(p[0]) * 12 + Number(p[1]);
}

function shiftYmByMonths_(ym, delta) {
  var p = String(ym || '').split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1 + Number(delta || 0), 1);
  return d.getFullYear() + '-' + pad2_(d.getMonth() + 1);
}

function tokyoYmNow_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
}

function isYmInKeepWindow_(rowYm, pivotYm, keepBack, keepFwd) {
  if (!rowYm || !pivotYm) return true;
  var row = ymToIndex_(rowYm);
  var pivot = ymToIndex_(pivotYm);
  return row >= (pivot - keepBack) && row <= (pivot + keepFwd);
}

function ensureAutoArchiveTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'autoArchiveAllStoreShiftsNightly_') return;
  }
  ScriptApp.newTrigger('autoArchiveAllStoreShiftsNightly_')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
}

/** 起動を止めず、しばらく後に当該店舗の古い行を退避 */
function kickDeferredArchiveIfNeeded_(storeId, rowCount) {
  if (Number(rowCount) < SHIFT_AUTO_ARCHIVE_MIN_ROWS) return;
  var sid = String(storeId || '').trim();
  if (!sid) return;
  var sc = CacheService.getScriptCache();
  if (sc.get('arch:v2:' + sid) || sc.get('arch:kick:' + sid)) return;
  try { sc.put('arch:kick:' + sid, '1', 86400); } catch (eK) { /* ignore */ }

  var props = PropertiesService.getDocumentProperties();
  var q = [];
  try { q = JSON.parse(props.getProperty('ARCH_QUEUE_V1') || '[]') || []; } catch (eQ) { q = []; }
  if (q.indexOf(sid) < 0) q.push(sid);
  props.setProperty('ARCH_QUEUE_V1', JSON.stringify(q));
  ensureDeferredArchiveTrigger_();
}

function ensureDeferredArchiveTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'drainArchiveQueue_') return;
  }
  ScriptApp.newTrigger('drainArchiveQueue_')
    .timeBased()
    .after(120000)
    .create();
}

function drainArchiveQueue_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'drainArchiveQueue_') {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (eDel) { /* ignore */ }
    }
  }
  var props = PropertiesService.getDocumentProperties();
  var q = [];
  try { q = JSON.parse(props.getProperty('ARCH_QUEUE_V1') || '[]') || []; } catch (eQ) { q = []; }
  props.setProperty('ARCH_QUEUE_V1', '[]');
  for (var j = 0; j < q.length; j++) {
    try {
      autoArchiveStoreShiftSheet_(q[j], { force: true, pivotYm: tokyoYmNow_() });
    } catch (eOne) { /* continue */ }
  }
  try { ensureAutoArchiveTrigger_(); } catch (eNight) { /* ignore */ }
}

function autoArchiveAllStoreShiftsNightly_() {
  var stores = [];
  try { stores = listAllStoresCached_() || []; } catch (e) { stores = []; }
  for (var i = 0; i < stores.length; i++) {
    try {
      autoArchiveStoreShiftSheet_(stores[i].store_id, {
        force: true,
        pivotYm: tokyoYmNow_()
      });
    } catch (eOne) { /* 1店失敗しても続行 */ }
  }
}

function menuAutoArchiveStoreShiftsNow() {
  ensureAutoArchiveTrigger_();
  var stores = listAllStoresCached_() || [];
  var moved = 0;
  var touched = 0;
  for (var i = 0; i < stores.length; i++) {
    var r = autoArchiveStoreShiftSheet_(stores[i].store_id, {
      force: true,
      pivotYm: tokyoYmNow_()
    });
    touched++;
    if (r && r.moved) moved += Number(r.moved) || 0;
  }
  SpreadsheetApp.getUi().alert(
    '古いシフトの自動整理',
    '対象店舗: ' + touched + ' / 保管へ移動: ' + moved + ' 行\n（直近数ヶ月以外は「シフト_*_保管」へ移しました）',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function maybeAutoArchiveStoreShifts_(storeId, sh, map, values, pivotYm) {
  // 互換用（ホットパスでは呼ばない）。必要なら force 実行。
  autoArchiveStoreShiftSheet_(storeId, {
    force: true,
    pivotYm: pivotYm || tokyoYmNow_(),
    prefetchedSheet: sh,
    prefetchedMap: map,
    prefetchedValues: values
  });
}

/**
 * 直近ウィンドウ外の行を保管シートへ移し、表示用シートを軽くする
 */
function autoArchiveStoreShiftSheet_(storeId, opt) {
  opt = opt || {};
  var sid = String(storeId || '').trim();
  if (!sid) return { ok: false, reason: 'no_store' };

  var lock = LockService.getDocumentLock();
  try {
    if (!lock.tryLock(5000)) return { ok: false, reason: 'busy' };
  } catch (eLock) {
    return { ok: false, reason: 'busy' };
  }

  try {
    var sh = opt.prefetchedSheet || ss_().getSheetByName(storeShiftSheetName_(sid));
    if (!sh) return { ok: true, skipped: true, reason: 'no_sheet' };

    var map = opt.prefetchedMap;
    var values = opt.prefetchedValues;
    if (!map || !values) {
      var ensured = ensureShiftHeadersLean_(sh);
      map = ensured.map;
      values = getDataRows_(sh);
    }
    if (!map || map.date == null) return { ok: false, reason: 'no_date' };
    if (values.length < SHIFT_AUTO_ARCHIVE_MIN_ROWS && !opt.force) {
      return { ok: true, skipped: true, reason: 'small' };
    }

    var pivot = String(opt.pivotYm || tokyoYmNow_()).trim();
    if (!/^\d{4}-\d{2}$/.test(pivot)) pivot = tokyoYmNow_();
    var keepBack = opt.keepBack != null ? Number(opt.keepBack) : SHIFT_AUTO_KEEP_BACK;
    var keepFwd = opt.keepFwd != null ? Number(opt.keepFwd) : SHIFT_AUTO_KEEP_FWD;

    var headers = getHeaders_(sh);
    var width = Math.max(headers.length, sh.getLastColumn());
    var keep = [];
    var move = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var d = normalizeDate_(row[map.date]);
      var rowYm = d ? d.substring(0, 7) : '';
      var line = row.slice(0, width);
      while (line.length < width) line.push('');
      if (!rowYm || isYmInKeepWindow_(rowYm, pivot, keepBack, keepFwd)) {
        keep.push(line);
      } else {
        move.push(line);
      }
    }

    if (!move.length) return { ok: true, moved: 0, kept: keep.length };

    if (move.length > SHIFT_AUTO_ARCHIVE_MAX_MOVE) {
      // 一度に移しすぎない（タイムアウト回避）。古い側から優先するため move 先頭を残す
      var overflow = move.splice(SHIFT_AUTO_ARCHIVE_MAX_MOVE);
      keep = keep.concat(overflow);
    }

    var archName = storeShiftArchiveSheetName_(sid);
    var ash = ss_().getSheetByName(archName);
    if (!ash) {
      ash = ss_().insertSheet(archName);
      ash.getRange(1, 1, 1, Math.max(headers.length, 1)).setValues([headers.slice()]);
      try { ash.hideSheet(); } catch (eHide) { /* ignore */ }
    } else {
      // ヘッダが空なら埋める
      if (ash.getLastRow() < 1) {
        ash.getRange(1, 1, 1, Math.max(headers.length, 1)).setValues([headers.slice()]);
      }
      try { ash.hideSheet(); } catch (eHide2) { /* ignore */ }
    }

    if (move.length) {
      writeSheetRows_(ash, ash.getLastRow() + 1, move);
    }

    var prevRows = Math.max(0, sh.getLastRow() - 1);
    if (keep.length) writeSheetRows_(sh, 2, keep);
    else if (prevRows > 0) {
      sh.getRange(2, 1, prevRows, Math.max(width, sh.getLastColumn())).clearContent();
    }
    if (prevRows > keep.length) {
      sh.getRange(keep.length + 2, 1, prevRows - keep.length, Math.max(width, sh.getLastColumn())).clearContent();
    }

    invalidateShiftMonthCache_(sid, '');
    try {
      CacheService.getScriptCache().put('arch:v2:' + sid, '1', 21600);
    } catch (eC) { /* ignore */ }

    return { ok: true, moved: move.length, kept: keep.length, archive: archName, pivotYm: pivot };
  } finally {
    try { lock.releaseLock(); } catch (eRel) { /* ignore */ }
  }
}

function shiftMonthCacheKey_(storeId, ym) {
  return 'sm:' + String(storeId || '') + ':' + String(ym || '');
}

function readShiftMonthCache_(storeId, ym) {
  try {
    var raw = CacheService.getScriptCache().get(shiftMonthCacheKey_(storeId, ym));
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.ok || !Array.isArray(obj.employees) || !Array.isArray(obj.shifts)) return null;
    return obj;
  } catch (e) {
    return null;
  }
}

function writeShiftMonthCache_(storeId, ym, result) {
  try {
    var payload = {
      ok: true,
      storeId: result.storeId,
      yearMonth: result.yearMonth,
      canEdit: !!result.canEdit,
      employees: result.employees || [],
      shifts: result.shifts || [],
      memos: result.memos || []
    };
    var text = JSON.stringify(payload);
    // Script Cache は約100KB上限。大きい月はスキップ
    if (text.length > 90000) return;
    CacheService.getScriptCache().put(shiftMonthCacheKey_(storeId, ym), text, 180);
  } catch (e) { /* ignore */ }
}

function invalidateShiftMonthCache_(storeId, ym) {
  try {
    var cache = CacheService.getScriptCache();
    if (ym) {
      cache.remove(shiftMonthCacheKey_(storeId, ym));
      return;
    }
    // 年月不明時は近傍12か月を消す
    var now = new Date();
    for (var i = -6; i <= 6; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      var keyYm = d.getFullYear() + '-' + pad2_(d.getMonth() + 1);
      cache.remove(shiftMonthCacheKey_(storeId, keyYm));
    }
  } catch (eInv) { /* ignore */ }
}

function countFilledShiftsForYm_(values, map, storeId, ym) {
  if (!values || !map || map.date == null || map.status == null) return 0;
  var filled = 0;
  for (var i = 0; i < values.length; i++) {
    if (!shiftRowMatchesStore_(values[i], map, storeId)) continue;
    var d = normalizeDate_(values[i][map.date]);
    if (!d || d.substring(0, 7) !== ym) continue;
    var st = String(values[i][map.status] || 'undef');
    if (st && st !== 'undef') filled++;
  }
  return filled;
}

/** 店舗専用シートでは store_id 空欄も自店行とみなす */
function shiftRowMatchesStore_(row, map, storeId) {
  if (!map || map.store_id == null) return true;
  var sid = String(row[map.store_id] || '').trim();
  if (!sid) return true;
  return sid === String(storeId || '').trim();
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
    var hasSchedule = false;
    list.forEach(function (row) {
      var date = normalizeDate_(row[map.date]);
      var day = date ? Number(date.substring(8, 10)) : 0;
      var st = String(row[map.status] || '');
      var lc = map.leave_code != null ? row[map.leave_code] : '';
      if (st === 'work' || st === 'off' || st === 'pto' || st === 'absent' || (lc !== '' && lc != null && Number(lc))) {
        hasSchedule = true;
      }
      byDay[day] = { status: st, leave_code: lc };
    });
    // シフトが1日も無いスタッフには自動休日を付けない（空欄のまま）
    if (!hasSchedule) return;
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

function readShifts_(storeId, ym, email, acl, opt) {
  opt = opt || {};
  var map = opt.prefetchedMap;
  var values = opt.prefetchedValues;
  if (!values || !map) {
    var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
    map = ensured.map;
    values = getDataRows_(sh);
  }
  requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);
  var empList = opt.employees || listEmployeesDetailed_(storeId);
  var resolveEmp = empIdResolver_(storeId, empList);
  var out = [];
  var seenIdx = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (!shiftRowMatchesStore_(r, map, storeId)) continue;
    // Date 型だけ年月を先判定（シリアル番号などは normalize に任せる）
    var rawDate = r[map.date];
    if (Object.prototype.toString.call(rawDate) === '[object Date]' && !isNaN(rawDate.getTime())) {
      if (rawDate.getFullYear() !== Number(ym.substring(0, 4)) || (rawDate.getMonth() + 1) !== Number(ym.substring(5, 7))) continue;
    } else if (typeof rawDate === 'string') {
      var rawStr = rawDate;
      var yFast = ym.substring(0, 4);
      var mNum = Number(ym.substring(5, 7));
      var m2 = pad2_(mNum);
      var maybeYm = rawStr.indexOf(ym) >= 0
        || rawStr.indexOf(yFast + '/' + m2) >= 0
        || rawStr.indexOf(yFast + '/' + mNum + '/') >= 0
        || rawStr.indexOf(yFast + '-' + m2) >= 0;
      // yyyy-MM / yyyy/M 形式で明らかに他月ならスキップ
      if (!maybeYm && /^\d{4}[-/]\d{1,2}/.test(rawStr)) continue;
    }
    var date = normalizeDate_(rawDate);
    if (!date || date.substring(0, 7) !== ym) continue;
    // 従業員IDは従業員マスタの表記に揃える（先頭ゼロ落ちでも同じ人として扱う）
    var rowEmpId = resolveEmp(r[map.employee_id]);
    // 同じ従業員×同じ日が重複していても表示が揺れないよう、有効な行を優先して1件に寄せる
    var dedupeKey = rowEmpId + '__' + date;
    if (seenIdx[dedupeKey] != null) {
      var kept = out[seenIdx[dedupeKey]];
      var keptScore = kept.status && kept.status !== 'undef' ? 1 : 0;
      var curStatus = String(r[map.status] || '');
      var curScore = curStatus && curStatus !== 'undef' ? 1 : 0;
      var keptUpdated = String(kept.updated_at || '');
      var curUpdated = map.updated_at != null ? String(r[map.updated_at] || '') : '';
      if (!(curScore > keptScore || (curScore === keptScore && curUpdated >= keptUpdated))) continue;
      out.splice(seenIdx[dedupeKey], 1);
      var keys = Object.keys(seenIdx);
      for (var ki = 0; ki < keys.length; ki++) {
        if (seenIdx[keys[ki]] > seenIdx[dedupeKey]) seenIdx[keys[ki]] -= 1;
      }
      delete seenIdx[dedupeKey];
    }
    seenIdx[dedupeKey] = out.length;
    out.push({
      shift_id: String(r[map.shift_id] || ''),
      date: date,
      employee_id: rowEmpId,
      store_id: storeId,
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
    employees: empList,
    shifts: out,
    memos: listMemos_(storeId, ym, resolveEmp)
  };
}

/**
 * 月間のシフトメモ（従業員×日）
 * 旧シフト表の「名前の下のメモ行」に相当。kind=note / body を主に使う。
 */
function listMemos_(storeId, ym, resolveEmpFn) {
  var resolveEmpId = resolveEmpFn || empIdResolver_(storeId);
  var sh = ss_().getSheetByName(storeMemoSheetName_(storeId));
  if (!sh && ym) {
    try { sh = ss_().getSheetByName(memoMonthlySheetName_(ym)); } catch (eM) { sh = null; }
  }
  if (!sh) sh = ss_().getSheetByName(SHIFT_APP.SHEETS.MEMOS);
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
    var eid = resolveEmpId(r[map.employee_id]);
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

  var ymFromItems = '';
  for (var yi = 0; yi < items.length; yi++) {
    var dj = normalizeDate_(items[yi].date);
    if (dj) { ymFromItems = dj.substring(0, 7); break; }
  }
  if (!ymFromItems) throw new Error('メモの日付が必要です。');
  var sh = ensureMemoSheetForStore_(storeId);
  var ensured = ensureMemoHeaders_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, ['memo_id', 'date', 'employee_id', 'body']);

  var data = sh.getDataRange().getValues();
  var byId = {};
  var byKey = {};
  for (var r = 1; r < data.length; r++) {
    var sid = String(data[r][map.store_id] || '').trim();
    if (sid && sid !== storeId) continue;
    var id = String(data[r][map.memo_id] || '');
    var d0 = normalizeDate_(data[r][map.date]);
    var eid = empKeyOf_(data[r][map.employee_id]);
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
    var hit = memoId && byId[memoId] ? byId[memoId] : byKey[empKeyOf_(employeeId) + '__' + date];

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
      if (map.store_id != null) full[map.store_id] = storeId;
      if (map.kind != null) full[map.kind] = kind;
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
      if (map.store_id != null) row[map.store_id] = storeId;
      if (map.kind != null) row[map.kind] = kind;
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

  return {
    ok: true,
    saved: toUpdate.length + toAppend.length,
    deleted: deleted,
    partial: true
  };
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
  var onlyEmp = String(p.employee_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式です。');

  var genLock = LockService.getScriptLock();
  try { genLock.waitLock(20000); } catch (eLock) {
    throw new Error('他の処理と競合しました。少し待ってからもう一度お試しください。');
  }
  var applyOpts = { strict: true };
  if (onlyEmp) {
    // 対象スタッフだけテンプレで作り直す（他のスタッフには触らない）
    var allEmps = listEmployeesDetailed_(storeId);
    var picked = [];
    for (var ai = 0; ai < allEmps.length; ai++) {
      if (String(allEmps[ai].employee_id) === onlyEmp) picked.push(allEmps[ai]);
    }
    if (!picked.length) throw new Error('対象のスタッフが見つかりません。');
    applyOpts.employees = picked;
    overwrite = true;
  }
  var applied = applyWeeklyToMonth_(storeId, ym, email, overwrite, applyOpts);
  // 読み取りの前にロックを解放（他のユーザーを待たせない）
  try { genLock.releaseLock(); } catch (eRel) { /* ignore */ }
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
  var parts = ym.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var days = new Date(year, month, 0).getDate();
  var employees = opts.employees || listEmployeesDetailed_(storeId);
  if (!employees.length) {
    if (opts.strict) throw new Error('従業員がいません。先に従業員を登録してください。');
    return { created: 0, skipped: 0, overwrite: !!overwrite, applied: false, reason: 'no_employees' };
  }

  var expected = employees.length * days;

  // 既に全日埋まっていれば週間テンプレ読み込みをスキップ（ログイン高速化）
  if (!overwrite) {
    var dataEarly = opts.prefetchedValues;
    var mapEarly = opts.prefetchedMap;
    if (!dataEarly) {
      var shEarly = mustShiftSheetForStore_(storeId);
      mapEarly = ensureShiftHeadersLean_(shEarly).map;
      dataEarly = getDataRows_(shEarly);
    }
    var filledEarly = 0;
    for (var er = 0; er < dataEarly.length; er++) {
      if (!shiftRowMatchesStore_(dataEarly[er], mapEarly, storeId)) continue;
      var dEarly = normalizeDate_(dataEarly[er][mapEarly.date]);
      if (!dEarly || dEarly.substring(0, 7) !== ym) continue;
      var stEarly = String(dataEarly[er][mapEarly.status] || 'undef');
      if (stEarly && stEarly !== 'undef') filledEarly++;
    }
    if (filledEarly >= expected) {
      return {
        created: 0,
        skipped: expected,
        overwrite: false,
        applied: true,
        reason: 'already_filled',
        fast: true,
        sheetReload: false
      };
    }
  }

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
    var wKey = String(w.employee_id) + '__' + Number(w.weekday);
    var prevW = byEmpWd[wKey];
    if (prevW) {
      // 重複していたら入力済み（undef以外）を優先。空の重複行で消されないように
      var prevOkW = prevW.status && prevW.status !== 'undef' ? 1 : 0;
      var curOkW = w.status && w.status !== 'undef' ? 1 : 0;
      if (curOkW < prevOkW) return;
    }
    byEmpWd[wKey] = w;
  });

  var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);

  var resolveShiftEmp = empIdResolver_(storeId, opts.employees ? null : employees);
  var data = sh.getDataRange().getValues();
  var existing = {};
  var duplicateRows = [];
  var filledCount = 0;
  for (var r = 1; r < data.length; r++) {
    if (!shiftRowMatchesStore_(data[r], map, storeId)) continue;
    var d0 = normalizeDate_(data[r][map.date]);
    if (!d0 || d0.substring(0, 7) !== ym) continue;
    var eid = resolveShiftEmp(data[r][map.employee_id]);
    var st = String(data[r][map.status] || 'undef');
    var cand = {
      row: r + 1,
      status: st,
      shift_id: String(data[r][map.shift_id] || ''),
      dataIndex: r,
      updated: map.updated_at != null ? String(data[r][map.updated_at] || '') : ''
    };
    var exKey = eid + '__' + d0;
    var prevEx = existing[exKey];
    if (prevEx) {
      // 重複行は良い方を残して、もう一方は削除対象にする
      var prevScore = prevEx.status && prevEx.status !== 'undef' ? 1 : 0;
      var candScore = st && st !== 'undef' ? 1 : 0;
      if (candScore > prevScore || (candScore === prevScore && cand.updated >= prevEx.updated)) {
        duplicateRows.push(prevEx.row);
        existing[exKey] = cand;
      } else {
        duplicateRows.push(cand.row);
      }
      continue;
    }
    existing[exKey] = cand;
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
      fast: true,
      sheetReload: false
    };
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var created = 0;
  var skipped = 0;
  var filledDays = 0;   // テンプレどおり入れた日数
  var clearedDays = 0;  // テンプレ未登録で空欄に戻した日数
  var toAppend = [];
  var toUpdate = []; // { row, values }

  for (var d = 1; d <= days; d++) {
    var date = ym + '-' + pad2_(d);
    var weekday = new Date(year, month - 1, d).getDay();
    for (var ei = 0; ei < employees.length; ei++) {
      var emp = employees[ei];
      var w = byEmpWd[emp.employee_id + '__' + weekday];
      var status = 'undef';
      var start = '';
      var end = '';
      var breakMin = '';
      var leaveCode = '';
      var hasTemplate = !!(w && w.status && w.status !== 'undef');
      if (hasTemplate) {
        status = String(w.status);
        start = w.start_time || '';
        end = w.end_time || '';
        breakMin = w.break_minutes === '' || w.break_minutes == null ? '' : Number(w.break_minutes);
        leaveCode = w.leave_code === '' || w.leave_code == null ? '' : Number(w.leave_code);
      }
      // テンプレ未登録は書き込まない（空欄のまま）。上書き時は既存行を空欄化
      if (!hasTemplate && !(overwrite && existing[emp.employee_id + '__' + date])) {
        skipped++;
        continue;
      }
      if (hasTemplate) filledDays++;
      else clearedDays++;
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
        full[map.employee_id] = emp.employee_id; // 先頭ゼロ落ちの行をマスタ表記に直す
        full[map.status] = status;
        full[map.start_time] = start;
        full[map.end_time] = end;
        if (map.break_minutes != null) full[map.break_minutes] = breakMin;
        if (map.leave_code != null) full[map.leave_code] = leaveCode;
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
      if (map.leave_code != null) row[map.leave_code] = leaveCode;
      if (map.source != null) row[map.source] = 'system';
      if (map.updated_at != null) row[map.updated_at] = now;
      if (map.updated_by != null) row[map.updated_by] = email;
      toAppend.push(row);
      created++;
    }
  }

  fillHouteiOnRows_(toUpdate.map(function (u) { return u.values; }).concat(toAppend), map, ym, days);

  var width = Math.max(headers.length, (data[0] || []).length);
  function padShiftRow_(line) {
    var padded = line.slice(0, width);
    while (padded.length < width) padded.push('');
    return padded;
  }

  // 重複行がある場合は、シート本体を1回で書き直して重複・空行をまとめて掃除する
  // （deleteRows を繰り返すと数十秒かかるため使わない）
  if (duplicateRows.length) {
    var dupSet = {};
    duplicateRows.forEach(function (rowNo) { dupSet[rowNo] = true; });
    var updateByRow = {};
    toUpdate.forEach(function (u) { updateByRow[u.row] = u.values; });

    var body = [];
    for (var rr = 1; rr < data.length; rr++) {
      var rowNo2 = rr + 1;
      if (dupSet[rowNo2]) continue;
      var src = updateByRow[rowNo2] || data[rr];
      var hasEmp = String(src[map.employee_id] || '').trim();
      var hasDate = String(src[map.date] || '').trim();
      if (!hasEmp && !hasDate) continue;
      body.push(padShiftRow_(src));
    }
    toAppend.forEach(function (row) { body.push(padShiftRow_(row)); });

    var prevRows = Math.max(0, data.length - 1);
    if (body.length) writeSheetRows_(sh, 2, body);
    if (prevRows > body.length) {
      sh.getRange(body.length + 2, 1, prevRows - body.length, Math.max(width, sh.getLastColumn())).clearContent();
    }
    invalidateRequestCache_(['employees']);
    invalidateShiftMonthCache_(storeId, ym);
    return {
      created: created,
      filled: filledDays,
      cleared: clearedDays,
      skipped: skipped,
      overwrite: !!overwrite,
      applied: true,
      appended: toAppend.length,
      updated: toUpdate.length,
      compacted: duplicateRows.length,
      sheetReload: true
    };
  }

  // 書き込みは1回にまとめる（1人分の行が飛び飛びでも速い）
  if (toUpdate.length) {
    toUpdate.sort(function (a, b) { return a.row - b.row; });
    var minRow = toUpdate[0].row;
    var maxRow = toUpdate[toUpdate.length - 1].row;
    var span = maxRow - minRow + 1;
    if (span <= 600) {
      var buf = [];
      for (var br = 0; br < span; br++) {
        var line = (data[minRow - 1 + br] || []).slice(0, width);
        while (line.length < width) line.push('');
        buf.push(line);
      }
      toUpdate.forEach(function (u) {
        var uline = u.values.slice(0, width);
        while (uline.length < width) uline.push('');
        buf[u.row - minRow] = uline;
      });
      writeSheetRows_(sh, minRow, buf);
    } else {
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
  }

  if (toAppend.length) {
    var startRow = sh.getLastRow() + 1;
    writeSheetRows_(sh, startRow, toAppend);
  }

  return {
    created: created,
    filled: filledDays,
    cleared: clearedDays,
    skipped: skipped,
    overwrite: !!overwrite,
    applied: true,
    appended: toAppend.length,
    updated: toUpdate.length,
    sheetReload: toUpdate.length > 0 || toAppend.length > 0
  };
}

/** 週間固定を店舗単位で軽量取得（権限チェックなし・内部用） */
function readWeeklyForStore_(storeId) {
  ensureWeeklySheet_();
  var sh = mustSheet_(SHIFT_APP.SHEETS.WEEKLY);
  var ensured = ensureWeeklyLeaveCodeHeader_(sh);
  var map = ensured.map;
  requireHeaders_(map, ['employee_id', 'store_id', 'weekday', 'status']);
  var resolveWeeklyEmp = empIdResolver_(storeId);
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (map.is_active != null && !isTruthy_(r[map.is_active])) continue;
    out.push({
      employee_id: resolveWeeklyEmp(r[map.employee_id]),
      weekday: Number(r[map.weekday]),
      status: String(r[map.status] || 'undef'),
      start_time: formatHm_(r[map.start_time]),
      end_time: formatHm_(r[map.end_time]),
      break_minutes: r[map.break_minutes] === '' || r[map.break_minutes] == null ? '' : Number(r[map.break_minutes]),
      leave_code: map.leave_code != null && r[map.leave_code] !== '' && r[map.leave_code] != null ? Number(r[map.leave_code]) : ''
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

  var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);

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
        empKeyOf_(data[r2][map.employee_id]) === empKeyOf_(employeeId) &&
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

  invalidateShiftMonthCache_(storeId, date.substring(0, 7));

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
/**
 * 表示中の月のシフトをすべて白紙にする（メモは残す）
 * payload: { user_email, store_id, year_month }
 */
function clearMonthlyShifts(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var ym = String(p.year_month || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式です。');

  var clearedRows = 0;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (eLock) {
    throw new Error('他の処理と競合しました。少し待ってからもう一度お試しください。');
  }
  try {
    var sh = mustShiftSheetForStore_(storeId);
    var ensured = ensureShiftHeadersLean_(sh);
    var headers = ensured.headers;
    var map = ensured.map;
    requireHeaders_(map, ['date', 'employee_id']);
    var data = sh.getDataRange().getValues();
    var width = Math.max(headers.length, (data[0] || []).length);
    var body = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var d = normalizeDate_(row[map.date]);
      if (shiftRowMatchesStore_(row, map, storeId) && d && d.substring(0, 7) === ym) {
        clearedRows++;
        continue;
      }
      var line = row.slice(0, width);
      while (line.length < width) line.push('');
      var hasEmp = String(line[map.employee_id] || '').trim();
      var hasDate = String(line[map.date] || '').trim();
      if (!hasEmp && !hasDate) continue;
      body.push(line);
    }
    var prevRows = Math.max(0, data.length - 1);
    if (body.length) writeSheetRows_(sh, 2, body);
    else if (prevRows > 0) sh.getRange(2, 1, prevRows, Math.max(width, sh.getLastColumn())).clearContent();
    if (prevRows > body.length) {
      sh.getRange(body.length + 2, 1, prevRows - body.length, Math.max(width, sh.getLastColumn())).clearContent();
    }
    invalidateRequestCache_(['employees']);
    invalidateShiftMonthCache_(storeId, ym);
  } finally {
    try { lock.releaseLock(); } catch (eRel) { /* ignore */ }
  }
  var result = readShifts_(storeId, ym, email, acl);
  result.cleared = { rows: clearedRows };
  return result;
}

function upsertShiftsBatch(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return { ok: true, saved: 0 };

  var ymBatch = '';
  for (var yi = 0; yi < items.length; yi++) {
    var djb = normalizeDate_(items[yi].date);
    if (djb) { ymBatch = djb.substring(0, 7); break; }
  }
  if (!ymBatch) throw new Error('シフトの日付が必要です。');

  var sh = mustShiftSheetForStore_(storeId);
  var ensured = ensureShiftHeadersLean_(sh);
  var headers = ensured.headers;
  var map = ensured.map;
  requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);

  var data = sh.getDataRange().getValues();
  var byId = {};
  var byKey = {};
  for (var r = 1; r < data.length; r++) {
    if (!shiftRowMatchesStore_(data[r], map, storeId)) continue;
    var id = String(data[r][map.shift_id] || '');
    var d0 = normalizeDate_(data[r][map.date]);
    var eid = empKeyOf_(data[r][map.employee_id]);
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
    var hit = shiftId && byId[shiftId] ? byId[shiftId] : byKey[empKeyOf_(employeeId) + '__' + date];
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
      if (map.break_minutes != null) {
        var brU = it.break_minutes;
        if (brU === '' || brU == null) brU = inferBreakMinutes_(status, start, end);
        full[map.break_minutes] = brU;
      }
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
      if (map.break_minutes != null) {
        var brA = it.break_minutes;
        if (brA === '' || brA == null) brA = inferBreakMinutes_(status, start, end);
        row[map.break_minutes] = brA;
      }
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

  invalidateRequestCache_(['employees']);
  invalidateShiftMonthCache_(storeId, ymBatch);
  // 一覧再構築・並べ替えはメニューから実行（毎回やると保存が固まる）

  return {
    ok: true,
    saved: toUpdate.length + toAppend.length,
    partial: true,
    canEdit: canEditStore_(acl, storeId)
  };
}

function deleteShift(shiftId, storeId, userEmail) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, String(storeId || ''), true);

  var id = String(shiftId || '').trim();
  if (!id) throw new Error('shift_id が必要です。');

  var ss = ss_();
  var sheets = [];
  // まず当該店舗のシートだけを見る（多店舗で全シート走査しない）
  try {
    var own = ss.getSheetByName(storeShiftSheetName_(storeId));
    if (own) sheets.push(own);
  } catch (eOwn) { /* ignore */ }
  if (!sheets.length) {
    ss.getSheets().forEach(function (sht) {
      var sn = sht.getName();
      if (sn === 'シフト' || sn.indexOf('シフト_') === 0) sheets.push(sht);
    });
  }
  for (var si = 0; si < sheets.length; si++) {
    var sh = sheets[si];
    var map = headerIndexMap_(getHeaders_(sh));
    if (map.shift_id == null) continue;
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][map.shift_id] || '') !== id) continue;
      if (String(data[r][map.store_id] || '') !== String(storeId)) {
        throw new Error('店舗が一致しないため削除できません。');
      }
      sh.deleteRow(r + 1);
      var delDate = normalizeDate_(data[r][map.date]);
      if (delDate) invalidateShiftMonthCache_(storeId, delDate.substring(0, 7));
      else invalidateShiftMonthCache_(storeId, '');
      return { ok: true, deleted: id };
    }
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
  // 第7エリアGAS準拠: 4列目は空白1文字（勤怠未来は「 」必須）
  var headerRow = [year + '/' + month + '/1', '～', year + '/' + month + '/' + daysInMonth, ' '].concat(dateHeaders);

  var outputData = [];
  withCode.forEach(function (emp) {
    var code = String(emp.bye_code).trim();
    var outputName = formatByeByePersonName_(emp.name);
    var rowsForStaff = [];
    for (var r = 0; r < 4; r++) {
      var row = [code, outputName, BYE_BYE.ROW_TYPES[r].code, BYE_BYE.ROW_TYPES[r].name];
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
        rowsForStaff[0][4 + idx] = leaveCode;
        if (kind === 'work') {
          valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes);
          if (!valForShift) warnings.push(emp.name + ' ' + date + '：休日休暇コード' + leaveCode + 'なのに時刻不正');
        } else if (kind === 'pto') {
          valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes) || '8:30-17:30R1:00';
        }
      } else if (houtei[date]) {
        rowsForStaff[0][4 + idx] = houtei[date];
      } else if (status === 'absent') {
        rowsForStaff[0][4 + idx] = BYE_BYE.CODE.ABSENT;
      } else if (status === 'pto') {
        rowsForStaff[0][4 + idx] = BYE_BYE.CODE.PTO;
        valForShift = formatByeByeShift_(s && s.start_time, s && s.end_time, s && s.break_minutes) || '8:30-17:30R1:00';
      } else if (status === 'work') {
        valForShift = formatByeByeShift_(s.start_time, s.end_time, s.break_minutes);
        if (!valForShift) warnings.push(emp.name + ' ' + date + '：勤務なのに時刻不正');
      }

      if (valForShift) rowsForStaff[1][4 + idx] = valForShift;
    }

    // 自動展開2行は空のまま（第7エリアGASと同じ）
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
  // データ行: [code, name, typeCode, typeName, day1...] → 日列は index 4 から
  if (hasExplicitHoutei) {
    weekHolidays.forEach(function (idx) { holidayRow[4 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
  } else {
    var last = weekHolidays.pop();
    holidayRow[4 + last] = BYE_BYE.CODE.HOUTEI;
    weekHolidays.forEach(function (idx) { holidayRow[4 + idx] = BYE_BYE.CODE.HOUTEIGAI; });
  }
}

function formatByeByePersonName_(name) {
  var s = String(name || '').trim().replace(/[ 　]+/g, '　');
  if (!s) return '';
  if (s.indexOf('　') >= 0) return s;
  var three = ['長谷川', '五十嵐', '諏訪部', '小野寺', '大久保', '佐々木', '仲村渠'];
  for (var i = 0; i < three.length; i++) {
    var sur = three[i];
    if (s.length > sur.length && s.indexOf(sur) === 0) {
      return sur + '　' + s.substring(sur.length);
    }
  }
  if (s.length >= 3) return s.substring(0, 2) + '　' + s.substring(2);
  return s;
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
    breakStr = 'R' + bh + ':' + pad2_(bmm);
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
    return (row || []).map(function (cell) {
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

/** アクセス中の Google ユーザー（取れない＝デプロイ者実行の API 経由） */
function peekActiveUserEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
}

function softResolveEmail_(clientEmail) {
  var email = normalizeEmail_(clientEmail);
  assertCompanyDomain_(email);
  var active = peekActiveUserEmail_();
  // PWA／JSONP は「自分として実行」のため ActiveUser が空 → 送信メールを採用
  if (active && active !== email) {
    throw new Error('Googleアカウントとログインメールが一致しません。');
  }
  return email;
}

/** 社員登録にメール行が無ければ作る（初回＝メアドのみ） */
function ensureManagerEmailRegistered_(email) {
  var sh = ensureManagerStoresSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  var emailCol = map.email != null ? map.email : 0;
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][emailCol] || '').trim().toLowerCase() === email) return false;
  }
  var colCount = Math.max(headers.length, MANAGER_HEADERS.length, 4);
  var row = [];
  for (var i = 0; i < colCount; i++) row.push('');
  row[emailCol] = email;
  sh.appendRow(row);
  return true;
}

function resolveClientEmail_(clientEmail) {
  var email = softResolveEmail_(clientEmail);
  resolveAcl_(email); // 管轄必須
  return email;
}

function resolveAcl_(email, opt) {
  var mgr = resolveAclFromManagers_(email);
  if (!mgr) {
    if (opt && opt.allowEmpty) {
      return { email: email, isAdmin: false, stores: {}, roleMax: '', needsJurisdiction: true, displayName: '', byeCode: '' };
    }
    throw new Error('管轄店舗が未登録です。Webで管轄店舗を登録してください。(' + email + ')');
  }
  if (!Object.keys(mgr.stores || {}).length) {
    if (opt && opt.allowEmpty) {
      return {
        email: email,
        isAdmin: false,
        stores: {},
        roleMax: '',
        needsJurisdiction: true,
        displayName: mgr.displayName || '',
        byeCode: mgr.byeCode || ''
      };
    }
    throw new Error('管轄店舗（B列）が空です。Webで管轄店舗を登録してください。(' + email + ')');
  }
  return mgr;
}

/** 旧「権限」シートの admin（*）のみ引き続き有効 */
function resolveAclLegacyAdmin_(email) {
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.ACL_LEGACY);
  if (!sh || sh.getLastRow() < 2) return null;
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.email == null) return null;
  var values = getDataRows_(sh);
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[map.email] || '').trim().toLowerCase() !== email) continue;
    if (!isTruthy_(row[map.is_active])) continue;
    var role = String(row[map.role] || '').trim().toLowerCase();
    var sid = String(row[map.store_id] || '').trim();
    if (role === SHIFT_APP.ROLES.ADMIN || sid === '*') {
      return { email: email, isAdmin: true, stores: {}, roleMax: SHIFT_APP.ROLES.ADMIN };
    }
  }
  return null;
}

function resolveAclLegacy_(email) {
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.ACL_LEGACY);
  if (!sh || sh.getLastRow() < 2) return null;
  var values = getDataRows_(sh);
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.email == null || map.store_id == null) return null;

  var stores = {};
  var roleMax = '';
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[map.email] || '').trim().toLowerCase() !== email) continue;
    if (map.is_active != null && !isTruthy_(row[map.is_active])) continue;
    var role = String(row[map.role] || '').trim().toLowerCase();
    var sid = String(row[map.store_id] || '').trim();
    if (!sid || sid === '*') continue;
    stores[sid] = betterRole_(stores[sid], role);
    roleMax = betterRole_(roleMax, role);
  }
  if (!Object.keys(stores).length) return null;
  return { email: email, isAdmin: false, stores: stores, roleMax: roleMax || SHIFT_APP.ROLES.VIEWER };
}

function resolveAclFromManagers_(email) {
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.MANAGERS);
  if (!sh || sh.getLastRow() < 2) return null;
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  var emailCol = map.email != null ? map.email : 0;
  var values = getDataRows_(sh);
  var all = listAllStoresCached_();
  var normalized = String(email || '').trim().toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[emailCol] || '').trim().toLowerCase() !== normalized) continue;

    var displayName = '';
    if (map.display_name != null) {
      displayName = String(row[map.display_name] || '').trim();
    }
    if (!displayName && map.name != null) {
      displayName = String(row[map.name] || '').trim();
    }
    var byeCode = '';
    if (map.bye_code != null) {
      byeCode = normalizeByeCode_(row[map.bye_code]);
    }

    var storeIds = readManagerStoresFromRow_(row, headers, map, all);
    if (!storeIds.length) {
      return {
        email: normalized,
        isAdmin: false,
        stores: {},
        roleMax: '',
        needsJurisdiction: true,
        displayName: displayName,
        byeCode: byeCode
      };
    }
    var stores = {};
    storeIds.forEach(function (sid) { stores[sid] = SHIFT_APP.ROLES.EDITOR; });
    return {
      email: normalized,
      isAdmin: false,
      stores: stores,
      roleMax: SHIFT_APP.ROLES.EDITOR,
      displayName: displayName,
      byeCode: byeCode
    };
  }
  return null;
}

function readManagerStoresFromRow_(row, headers, map, allStores) {
  var tokens = [];
  var startCol = map.managed_stores != null ? map.managed_stores : 1;
  var endCol = headers.length;
  if (map.display_name != null) endCol = map.display_name;
  else if (map.note != null) endCol = map.note;

  for (var c = startCol; c < endCol; c++) {
    var hdr = String(headers[c] || '').trim();
    if (hdr === '表示名' || hdr === '備考') break;
    var v = String(row[c] || '').trim();
    if (!v) continue;
    v.split(/[,、，\n\r]+/).forEach(function (part) {
      var t = part.trim();
      if (t) tokens.push(t);
    });
  }
  return resolveStoreIdsFromTokens_(tokens, allStores);
}

function resolveStoreIdsFromTokens_(tokens, allStores) {
  var byId = {};
  var byName = {};
  (allStores || []).forEach(function (s) {
    byId[String(s.store_id)] = s;
    var nm = String(s.store_name || '').trim();
    if (nm) {
      byName[nm] = s;
      byName[nm.replace(/[\s　]/g, '')] = s;
    }
  });
  var out = [];
  var seen = {};
  tokens.forEach(function (t) {
    t = String(t || '').trim();
    if (!t) return;
    var sid = '';
    if (byId[t]) sid = t;
    else if (byName[t]) sid = byName[t].store_id;
    else {
      var knownId = lookupKnownStoreId_(t, buildKnownStoreIdMap_());
      if (knownId) sid = knownId;
      else if (/^S\d{3}$/i.test(t)) sid = t.toUpperCase();
      else if (/^ST_/.test(t)) sid = t;
    }
    if (sid && !seen[sid]) {
      seen[sid] = true;
      out.push(sid);
    }
  });
  return out;
}

function ensureManagerStoresSheet_() {
  var ss = ss_();
  var name = SHIFT_APP.SHEETS.MANAGERS;
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.getSheetByName('管理店舗');
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getName() !== name) {
    try { sh.setName(name); } catch (e) { /* 同名あり */ }
  }
  repairManagerHeaders_(sh);
  return sh;
}

/** 社員登録ヘッダを正位置に直す（管轄店舗列欠け・列ずれ対策） */
function repairManagerHeaders_(sh) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  var needRepair = false;
  if (!String(headers[0] || '').trim()) needRepair = true;
  if (map.email == null) needRepair = true;
  if (map.managed_stores == null) needRepair = true;
  if (map.display_name == null) needRepair = true;
  if (map.bye_code == null) needRepair = true;
  // B列が空なのに C が表示名 → 管轄店舗が消えている
  if (!String(headers[1] || '').trim() && /表示名/.test(String(headers[2] || ''))) needRepair = true;

  if (needRepair || sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, MANAGER_HEADERS.length).setValues([MANAGER_HEADERS]);
    return;
  }
  if (String(headers[map.managed_stores] || '') === '管理店舗') {
    sh.getRange(1, map.managed_stores + 1).setValue('管轄店舗');
  }
  ['bye_code', 'name', 'display_name', 'note'].forEach(function (key) {
    map = ensureHeaderColumn_(sh, key);
  });
}

function ensureManagerStoresLayout_() {
  var sh = ensureManagerStoresSheet_();
  applyManagerSheetLayout_(sh);
  return '✓ 社員登録シートを整備';
}

function applyManagerSheetLayout_(sh) {
  var cols = Math.max(sh.getLastColumn(), MANAGER_HEADERS.length);
  var last = Math.max(sh.getLastRow(), 2);
  sh.setTabColor('#1abc9c');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 28);
  sh.getRange(1, 1, 1, cols)
    .setBackground('#0e6655')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  [260, 360, 140, 110, 140, 160].forEach(function (w, i) {
    if (i < cols) sh.setColumnWidth(i + 1, w);
  });
  sh.getRange(1, 1, last, cols).setFontFamily('Meiryo').setFontSize(10);
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, cols).setVerticalAlignment('middle');
    try {
      sh.getRange(2, 2, last - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    } catch (e) { /* ignore */ }
  }
  try {
    var existing = sh.getFilter();
    if (existing) existing.remove();
    sh.getRange(1, 1, last, cols).createFilter();
  } catch (e2) { /* ignore */ }
  sh.getRange(1, 1).setNote('社員＝メールでログインする人。管轄店舗は「、」区切りで複数可。');
}

function upsertManagerStores_(email, storeIds, displayName, byeCode) {
  var sh = ensureManagerStoresSheet_();
  // 保存のたびに全行レイアウトしない（タイムアウトの原因になる）
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  if (map.email == null || map.managed_stores == null) {
    sh.getRange(1, 1, 1, MANAGER_HEADERS.length).setValues([MANAGER_HEADERS]);
    headers = getHeaders_(sh);
    map = headerIndexMap_(headers);
  }
  ['bye_code', 'name', 'display_name'].forEach(function (key) {
    if (map[key] == null) map = ensureHeaderColumn_(sh, key);
  });
  headers = getHeaders_(sh);
  map = headerIndexMap_(headers);

  var all = listAllStores_();
  var idToName = {};
  all.forEach(function (s) { idToName[s.store_id] = s.store_name || s.store_id; });

  var names = (storeIds || []).map(function (id) { return idToName[id] || id; });
  var storeText = names.join('、');

  var emailCol = map.email != null ? map.email : 0;
  var storesCol = map.managed_stores != null ? map.managed_stores : 1;
  var nameCol = map.display_name != null ? map.display_name : 2;
  var codeCol = map.bye_code != null ? map.bye_code : 3;
  var fullNameCol = map.name != null ? map.name : 4;
  var colCount = Math.max(headers.length, MANAGER_HEADERS.length, fullNameCol + 1, codeCol + 1, 6);

  var data = sh.getDataRange().getValues();
  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][emailCol] || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) {
      rowIndex = r + 1;
      break;
    }
  }

  var row = rowIndex > 0 ? data[rowIndex - 1].slice() : [];
  while (row.length < colCount) row.push('');

  row[emailCol] = email;
  row[storesCol] = storeText;
  if (displayName) {
    row[nameCol] = displayName;
    if (fullNameCol != null && fullNameCol !== nameCol) row[fullNameCol] = displayName;
  } else if (!row[nameCol]) {
    row[nameCol] = '';
  }
  var code = normalizeByeCode_(byeCode);
  if (code) row[codeCol] = code;

  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, colCount).setValues([row]);
    if (code) sh.getRange(rowIndex, codeCol + 1).setNumberFormat('@').setValue(code);
  } else {
    sh.appendRow(row);
    var last = sh.getLastRow();
    if (code) sh.getRange(last, codeCol + 1).setNumberFormat('@').setValue(code);
  }

  return { email: email, stores: storeText, displayName: row[nameCol], bye_code: code };
}

/** 旧「権限」シートの有効行 →「管理店舗」へ移行（1メール1行） */
function migrateLegacyAclToManagerSheet_() {
  var legacy = ss_().getSheetByName(SHIFT_APP.SHEETS.ACL_LEGACY);
  if (!legacy || legacy.getLastRow() < 2) return '✓ 管理店舗（移行元なし）';
  var map = headerIndexMap_(getHeaders_(legacy));
  if (map.email == null || map.store_id == null) return '✓ 管理店舗（権限シート形式不一致）';

  var byEmail = {};
  getDataRows_(legacy).forEach(function (row) {
    if (map.is_active != null && !isTruthy_(row[map.is_active])) return;
    var em = String(row[map.email] || '').trim().toLowerCase();
    if (!em) return;
    var sid = String(row[map.store_id] || '').trim();
    if (!sid || sid === '*') return;
    if (!byEmail[em]) byEmail[em] = [];
    if (byEmail[em].indexOf(sid) < 0) byEmail[em].push(sid);
  });

  var count = 0;
  Object.keys(byEmail).forEach(function (em) {
    upsertManagerStores_(em, byEmail[em], '');
    count++;
  });
  return '✓ 管理店舗へ移行 ' + count + '名';
}

function findEmployeesSheet_() {
  var ss = ss_();
  var names = ['アルバイト登録', '従業員一覧', 'マスターデータ', '従業員マスタ'];
  var best = null;
  var bestCount = 0;
  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var count = sh.getLastRow() - 1;
    if (count > bestCount) {
      bestCount = count;
      best = sh;
    }
  });
  if (best) return best;
  return ss.getSheetByName('アルバイト登録') || ss.getSheetByName('従業員一覧') || ss.getSheetByName('店舗マスタ');
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
var __REQ_CACHE__ = null;

function ensureRequestCache_() {
  if (!__REQ_CACHE__) {
    __REQ_CACHE_ = { stores: null, knownStoreMap: null, employees: {} };
  }
  return __REQ_CACHE_;
}

function invalidateRequestCache_(keys) {
  var cache = ensureRequestCache_();
  (keys || []).forEach(function (k) {
    if (k === 'stores') {
      cache.stores = null;
      try { CacheService.getScriptCache().remove('allStores:v1'); } catch (eRm) { /* ignore */ }
    } else if (k === 'knownStoreMap') cache.knownStoreMap = null;
    else if (k === 'employees') {
      cache.employees = {};
      try {
        // 店舗キーが不明なため近傍は残るが、リクエスト内は空に。全削除はしない。
        var sc = CacheService.getScriptCache();
        // よく使うパイロット店を中心に消す（残っても最大3分）
        ['S001', 'S002'].forEach(function (sid) {
          try { sc.remove('emp:v1:' + sid); } catch (e1) { /* ignore */ }
        });
      } catch (eEmpRm) { /* ignore */ }
    }
  });
}

/** 店舗カタログ（リクエスト内＋ScriptCache 5分） */
function listAllStoresCached_() {
  var mem = ensureRequestCache_();
  if (mem.stores && mem.stores.length) return mem.stores;
  try {
    var raw = CacheService.getScriptCache().get('allStores:v1');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        mem.stores = parsed;
        return parsed;
      }
    }
  } catch (eRead) { /* ignore */ }
  var stores = listAllStores_() || [];
  try {
    var text = JSON.stringify(stores);
    if (text.length > 0 && text.length < 90000) {
      CacheService.getScriptCache().put('allStores:v1', text, 300);
    }
  } catch (eWrite) { /* ignore */ }
  return stores;
}
function findStoreCatalogSheet_() {
  var ss = ss_();
  var prefer = [SHIFT_APP.SHEETS.STORE_CATALOG, '店舗データ'];
  for (var i = 0; i < prefer.length; i++) {
    var sh = ss.getSheetByName(prefer[i]);
    // フィルタ表示中でも lastRow が取れるようにする
    if (sh && Math.max(sh.getLastRow(), sh.getDataRange().getNumRows()) >= 2) return sh;
  }
  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var n = sheets[j].getName();
    if (/店舗データ/.test(n) && sheets[j].getLastRow() >= 2) return sheets[j];
  }
  return null;
}

function buildKnownStoreIdMap_() {
  var cache = ensureRequestCache_();
  if (cache.knownStoreMap) return cache.knownStoreMap;
  var map = { '経堂': 'S001', 'ひばりが丘': 'S002' };
  try {
    var sh = findEmployeesSheet_();
    if (!sh) {
      cache.knownStoreMap = map;
      return map;
    }
    var hdr = headerIndexMap_(getHeaders_(sh));
    if (hdr.store_id == null || hdr.store_name == null) {
      cache.knownStoreMap = map;
      return map;
    }
    getDataRows_(sh).forEach(function (row) {
      var id = String(row[hdr.store_id] || '').trim();
      var nm = String(row[hdr.store_name] || '').trim();
      if (id && nm) map[nm] = id;
    });
  } catch (e) { /* ignore */ }
  cache.knownStoreMap = map;
  return map;
}

function slugStoreId_(storeName, storeEmail) {
  var email = String(storeEmail || '').trim().toLowerCase();
  if (email && email.indexOf('@') > 0) {
    var local = email.split('@')[0].replace(/[^a-z0-9_-]+/gi, '-');
    if (local) return 'ST_' + local;
  }
  var nm = String(storeName || '').trim().replace(/[\s　]+/g, '');
  return 'ST_' + (nm || 'store');
}

function resolveStoreIdForCatalog_(storeName, storeEmail, knownMap, usedIds) {
  var nm = String(storeName || '').trim();
  var knownId = lookupKnownStoreId_(nm, knownMap);
  if (knownId && !usedIds[knownId]) {
    usedIds[knownId] = true;
    return knownId;
  }
  var base = slugStoreId_(nm, storeEmail);
  var id = base;
  var n = 2;
  while (usedIds[id]) {
    id = base + '_' + n;
    n++;
  }
  usedIds[id] = true;
  return id;
}

/** 店舗データシートのヘッダ行を探す（1行目がタイトルの場合に対応） */
function findCatalogHeaderRow_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var maxRow = Math.min(5, sh.getLastRow());
  for (var r = 1; r <= maxRow; r++) {
    var headers = sh.getRange(r, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h || '').trim();
    });
    var hasName = false;
    for (var i = 0; i < headers.length; i++) {
      var t = headers[i];
      if (/^店舗名/.test(t) || t === '店舗名') { hasName = true; break; }
    }
    if (hasName) return { headerRow: r, headers: headers };
  }
  return { headerRow: 1, headers: getHeaders_(sh) };
}

/** 行・列の「開始〜終了」で確実に読む（A1表記。numRows 混同を避ける） */
function colLetter_(col) {
  var n = Number(col) || 1;
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

function readSheetBlock_(sh, startRow, startCol, endRow, endCol) {
  startRow = Number(startRow) || 1;
  startCol = Number(startCol) || 1;
  endRow = Number(endRow) || startRow;
  endCol = Number(endCol) || startCol;
  if (endRow < startRow || endCol < startCol) return [];
  var a1 = colLetter_(startCol) + startRow + ':' + colLetter_(endCol) + endRow;
  return sh.getRange(a1).getValues();
}

/** TODOリスト同型の「店舗データ」シート（エリア・テリトリー・店舗名） */
function listStoreCatalog_() {
  var sh = findStoreCatalogSheet_();
  if (!sh || sh.getLastRow() < 2) return null;
  var lastRow = sh.getLastRow();
  var lastCol = Math.max(sh.getLastColumn(), 4);
  var found = findCatalogHeaderRow_(sh);
  var headers = found.headers;
  var headerRow = found.headerRow;
  var map = headerIndexMap_(headers);
  var areaCol = map.area;
  var territoryCol = map.territory;
  var nameCol = map.store_name;
  var emailCol = map.store_email != null ? map.store_email : map.email;
  var idCol = map.store_id;

  headers.forEach(function (h, i) {
    var t = String(h || '').trim();
    if (nameCol == null && (/^店舗名/.test(t) || t === '店舗')) nameCol = i;
    if (areaCol == null && /^エリア/.test(t)) areaCol = i;
    if (territoryCol == null && /テリトリー|テリトリ/.test(t)) territoryCol = i;
    if (emailCol == null && /メール|mail/i.test(t)) emailCol = i;
    if (idCol == null && (/^店舗ID/i.test(t) || t === 'ID')) idCol = i;
  });

  // 標準レイアウト: A=エリア, B=テリトリー, C=店舗名, D=メール
  if (nameCol == null && lastCol >= 3) {
    areaCol = 0;
    territoryCol = 1;
    nameCol = 2;
    if (emailCol == null && lastCol >= 4) emailCol = 3;
  }
  if (nameCol == null) return null;

  var known = buildKnownStoreIdMap_();
  var usedIds = {};
  var list = [];
  if (lastRow <= headerRow) return null;
  var rows = readSheetBlock_(sh, headerRow + 1, 1, lastRow, lastCol);
  rows.forEach(function (row, i) {
    var storeName = String(row[nameCol] || '').trim();
    if (!storeName || isKeyValue_(storeName)) return;
    if (/運営本部/.test(storeName)) return;
    if (/^(エリア|テリトリー|店舗名)$/.test(storeName)) return;
    var area = areaCol != null ? String(row[areaCol] || '').trim() : '';
    var territory = territoryCol != null ? String(row[territoryCol] || '').trim() : '';
    var storeEmail = emailCol != null ? String(row[emailCol] || '').trim() : '';
    var explicitId = idCol != null ? String(row[idCol] || '').trim() : '';
    if (explicitId && isKeyValue_(explicitId)) explicitId = '';
    var storeId = explicitId || resolveStoreIdForCatalog_(storeName, storeEmail, known, usedIds);
    usedIds[storeId] = true;
    list.push({
      store_id: storeId,
      store_name: storeName,
      area: area,
      territory: territory,
      sort_order: i,
      active: true,
      store_email: storeEmail
    });
  });

  if (!list.length) return null;
  list.sort(function (a, b) {
    if (a.area !== b.area) return a.area.localeCompare(b.area, 'ja');
    if (a.territory !== b.territory) return a.territory.localeCompare(b.territory, 'ja');
    return a.store_name.localeCompare(b.store_name, 'ja');
  });
  return list;
}

function listStoresFromEmployees_() {
  try {
    var sh = findEmployeesSheet_();
    if (!sh || sh.getLastRow() < 2) return [];
    var map = headerIndexMap_(getHeaders_(sh));
    var values = getDataRows_(sh);
    var byId = {};
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var id = '';
      var name = '';
      var area = '';
      if (map.store_id != null) id = String(row[map.store_id] || row[map.primary_store_id] || '').trim();
      if (map.store_name != null) name = String(row[map.store_name] || '').trim();
      if (map.area != null) area = String(row[map.area] || '').trim();
      if (!id && !name) continue;
      if (!id) id = slugStoreId_(name, '');
      if (!name) name = id;
      if (/運営本部/.test(name)) continue;
      if (!byId[id]) {
        byId[id] = {
          store_id: id,
          store_name: name,
          area: area,
          territory: '',
          sort_order: Object.keys(byId).length,
          active: true
        };
      }
    }
    var list = Object.keys(byId).map(function (k) { return byId[k]; });
    list.sort(function (a, b) {
      if (a.area !== b.area) return a.area.localeCompare(b.area, 'ja');
      return a.store_name.localeCompare(b.store_name, 'ja');
    });
    return list;
  } catch (e) {
    return [];
  }
}

function listAllStores_() {
  var cache = ensureRequestCache_();
  if (cache.stores && cache.stores.length) return cache.stores;

  var catalog = null;
  try {
    catalog = listStoreCatalog_();
  } catch (e) {
    catalog = null;
  }
  if (catalog && catalog.length) {
    cache.stores = catalog;
    return catalog;
  }

  var fromEmp = [];
  try {
    fromEmp = listStoresFromEmployees_();
  } catch (e2) {
    fromEmp = [];
  }
  if (fromEmp.length) {
    cache.stores = fromEmp;
    return fromEmp;
  }

  // 最終フォールバック（パイロット2店）
  var fallback = [
    { store_id: 'S001', store_name: '経堂', area: '第7エリア', territory: '', sort_order: 0, active: true },
    { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア', territory: '', sort_order: 1, active: true }
  ];
  cache.stores = fallback;
  return fallback;
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

function uniqueTerritories_(stores, areaFilter) {
  var seen = {};
  var out = [];
  (stores || []).forEach(function (s) {
    if (areaFilter && String(s.area || '').trim() !== areaFilter) return;
    var t = String(s.territory || '').trim();
    if (!t || seen[t]) return;
    seen[t] = true;
    out.push(t);
  });
  return out.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
}

function listStoresForUser_(acl) {
  var all = listAllStoresCached_();
  if (acl.isAdmin) {
    return all.map(function (s) {
      return {
        store_id: s.store_id,
        store_name: s.store_name,
        area: s.area,
        territory: s.territory || '',
        sort_order: s.sort_order,
        role: SHIFT_APP.ROLES.ADMIN
      };
    });
  }
  return all.filter(function (s) { return !!acl.stores[s.store_id]; }).map(function (s) {
    return {
      store_id: s.store_id,
      store_name: s.store_name,
      area: s.area,
      territory: s.territory || '',
      sort_order: s.sort_order,
      role: acl.stores[s.store_id]
    };
  });
}

var EMP_ORDER_PROP = 'EMP_DISPLAY_ORDER_V1';

function readEmployeeOrder_(storeId) {
  try {
    var raw = PropertiesService.getDocumentProperties().getProperty(EMP_ORDER_PROP);
    if (!raw) return [];
    var all = JSON.parse(raw);
    var arr = all && all[String(storeId)];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (e) {
    return [];
  }
}

function writeEmployeeOrder_(storeId, ids) {
  var props = PropertiesService.getDocumentProperties();
  var all = {};
  try {
    all = JSON.parse(props.getProperty(EMP_ORDER_PROP) || '{}') || {};
  } catch (e) {
    all = {};
  }
  all[String(storeId)] = (ids || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  props.setProperty(EMP_ORDER_PROP, JSON.stringify(all));
}

function clearEmpScriptCache_(storeId) {
  try {
    CacheService.getScriptCache().remove('emp:v1:' + String(storeId || ''));
  } catch (e) { /* ignore */ }
}

function applyEmployeeDisplayOrder_(list, storeId) {
  var order = readEmployeeOrder_(storeId);
  if (!order.length) {
    list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ja'); });
    return list;
  }
  var rank = {};
  order.forEach(function (id, i) { rank[empKeyOf_(id)] = i; });
  list.sort(function (a, b) {
    var ra = rank[empKeyOf_(a.employee_id)];
    var rb = rank[empKeyOf_(b.employee_id)];
    var ha = ra != null;
    var hb = rb != null;
    if (ha && hb) return ra - rb;
    if (ha) return -1;
    if (hb) return 1;
    return a.name.localeCompare(b.name, 'ja');
  });
  return list;
}

/**
 * payload: { user_email, store_id, employee_ids: string[] }
 * 月間表の表示順を店舗ごとに保存
 */
function saveEmployeeOrder(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var storeId = String(p.store_id || '').trim();
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, true);
  var ids = Array.isArray(p.employee_ids)
    ? p.employee_ids.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
    : [];
  writeEmployeeOrder_(storeId, ids);
  invalidateRequestCache_(['employees']);
  return { ok: true, employees: listEmployeesDetailed_(storeId) };
}

/**
 * 従業員IDの照合キー。
 * スプレッドシートは "030400" のような値を数値 30400 として保存してしまうため、
 * 先頭ゼロの有無が違っても同じスタッフとして扱う。
 */
function empKeyOf_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    var t = s.replace(/^0+/, '');
    return t || '0';
  }
  return s.toLowerCase();
}

/** シート上の従業員IDを従業員マスタの表記へ揃える関数を返す */
function empIdResolver_(storeId, employees) {
  var list = employees || listEmployeesDetailed_(storeId);
  var byKey = {};
  for (var ri = 0; ri < list.length; ri++) {
    byKey[empKeyOf_(list[ri].employee_id)] = String(list[ri].employee_id);
  }
  return function (raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    var hit = byKey[empKeyOf_(s)];
    return hit || s;
  };
}

/** 社員番号の先頭ゼロが消えないよう、従業員ID列を書式「テキスト」にする */
function forceTextEmployeeIdColumn_(sh, map) {
  ensureEmployeeIdTextFormatOnce_(sh, map);
}

/** 社員コード列のテキスト書式（シートごと1回・最終行まで） */
function ensureEmployeeIdTextFormatOnce_(sh, map) {
  if (!sh || !map || map.employee_id == null) return;
  var props = PropertiesService.getDocumentProperties();
  var key = 'EMP_TEXT_V2_' + sh.getSheetId();
  if (props.getProperty(key) === '1') return;
  try {
    var lastData = Math.max(sh.getLastRow() - 1, 1);
    var col = map.employee_id + 1;
    sh.getRange(2, col, lastData, 1).setNumberFormat('@');
    props.setProperty(key, '1');
  } catch (eFmt) { /* ignore */ }
}

function listEmployeesDetailed_(storeId) {
  var cache = ensureRequestCache_();
  var key = String(storeId || '');
  if (cache.employees[key]) return cache.employees[key];

  try {
    var rawEmp = CacheService.getScriptCache().get('emp:v1:' + key);
    if (rawEmp) {
      var parsedEmp = JSON.parse(rawEmp);
      if (Array.isArray(parsedEmp)) {
        cache.employees[key] = parsedEmp;
        return parsedEmp;
      }
    }
  } catch (eEmpCache) { /* ignore */ }

  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.work_hours == null) map = ensureHeaderColumn_(sh, 'work_hours');
  requireHeaders_(map, ['name', 'primary_store_id']);
  var values = getDataRows_(sh);
  var allStores = listAllStoresCached_();
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isEmployeeActive_(row, map)) continue;
    var id = String((map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || '').trim();
    if (!id || isKeyValue_(id)) continue;
    var primary = String(row[map.primary_store_id] || row[map.store_id] || '');
    var storeNameOnRow = map.store_name != null ? String(row[map.store_name] || '').trim() : '';
    if (!employeeBelongsToStore_(primary, storeId, allStores, storeNameOnRow)) continue;
    var empType = map.employment_type != null ? String(row[map.employment_type] || '') : '';
    if (empType === 'パート' || empType === 'アルバイト') empType = 'アルバイト';
    else if (!empType) empType = 'アルバイト';
    var workHours = '';
    if (map.work_hours != null && row[map.work_hours] !== '' && row[map.work_hours] != null) {
      var whn = Number(row[map.work_hours]);
      if (!isNaN(whn) && whn > 0) workHours = whn;
    }
    list.push({
      employee_id: id,
      name: String(row[map.name] || ''),
      bye_code: id,
      email: map.email != null ? String(row[map.email] || '').trim() : '',
      calendar_sync: map.calendar_sync == null
        ? true
        : (row[map.calendar_sync] === '' || row[map.calendar_sync] == null
          ? true
          : isTruthy_(row[map.calendar_sync])),
      primary_store_id: primary,
      employment_type: empType,
      work_hours: workHours,
      is_primary: primary === storeId
    });
  }
  applyEmployeeDisplayOrder_(list, storeId);
  cache.employees[key] = list;
  try {
    var empText = JSON.stringify(list);
    if (empText.length > 0 && empText.length < 90000) {
      CacheService.getScriptCache().put('emp:v1:' + key, empText, 180);
    }
  } catch (eEmpWrite) { /* ignore */ }
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
  var d0 = normalizeDate_(date);
  if (!d0) return null;
  var sh = ss_().getSheetByName(shiftMonthlySheetName_(d0.substring(0, 7)));
  if (!sh) sh = mustSheet_(SHIFT_APP.SHEETS.SHIFTS);
  var map = headerIndexMap_(getHeaders_(sh));
  var values = getDataRows_(sh);
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '') !== storeId) continue;
    if (String(r[map.employee_id] || '') !== employeeId) continue;
    if (normalizeDate_(r[map.date]) !== d0) continue;
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
    'start_time', 'end_time', 'break_minutes', 'leave_code', 'is_active', 'updated_at', 'updated_by'
  ].map(function (k) { return HEADER_JA[k] || k; });
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.setTabColor('#3d85c6');
}

function ensureWeeklyLeaveCodeHeader_(sh) {
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  if (map.leave_code == null) {
    map = ensureHeaderColumn_(sh, 'leave_code');
    headers = getHeaders_(sh);
  }
  forceTextEmployeeIdColumn_(sh, map);
  return { headers: headers, map: map };
}

/** leaveCodes.js と同系統（週間テンプレ保存用） */
function leaveStatusFromCode_(code) {
  var n = Number(code);
  if (!n || n === 999) return 'undef';
  var work = { 11: 1, 12: 1, 21: 1, 22: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1 };
  var pto = { 61: 1, 62: 1, 63: 1, 64: 1, 65: 1, 71: 1, 73: 1, 74: 1, 75: 1, 76: 1, 77: 1, 78: 1 };
  var absent = { 80: 1, 90: 1 };
  if (work[n]) return 'work';
  if (pto[n]) return 'pto';
  if (absent[n]) return 'absent';
  return 'off';
}

/* ============================================================
 * ユーティリティ
 * ============================================================ */
function ss_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) { /* Webアプリ単体起動時 */ }
  return SpreadsheetApp.openById('1mPb5xUeoDoT5--yEXqUw5bY0PBpQ2AWSo17zkWML4ww');
}

function mustSheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」が見つかりません。セットアップを実行してください。');
  return sh;
}

function mustStoresSheet_() {
  var sh = findEmployeesSheet_();
  if (!sh) throw new Error('シート「アルバイト登録」が見つかりません。メニュー「シート改名・レイアウト整備」を実行してください。');
  return sh;
}

function mustEmployeesSheet_() {
  var sh = findEmployeesSheet_();
  if (!sh) throw new Error('シート「アルバイト登録」が見つかりません。メニュー「シート改名・レイアウト整備」を実行してください。');
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
  if (map.kind == null && map.type != null) map.kind = map.type;
  if (map.type == null && map.kind != null) map.type = map.kind;
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
  var rows = readSheetBlock_(sh, 2, 1, lastRow, lastCol);
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

/** 有効列が空欄の従業員は「有効」扱い（未入力＝退職ではない） */
function isEmployeeActive_(row, map) {
  if (map.is_active == null) return true;
  var v = row[map.is_active];
  if (v === '' || v == null) return true;
  return isTruthy_(v);
}

/** 店舗ID（S001）と店舗名（経堂）の両方で所属判定 */
function storeNamesMatch_(a, b) {
  var x = String(a || '').trim().replace(/[\s　]/g, '');
  var y = String(b || '').trim().replace(/[\s　]/g, '');
  return !!(x && y && x === y);
}

function lookupKnownStoreId_(storeName, knownMap) {
  var nm = String(storeName || '').trim();
  if (!nm) return '';
  if (knownMap[nm]) return knownMap[nm];
  var compact = nm.replace(/[\s　]/g, '');
  if (knownMap[compact]) return knownMap[compact];
  var keys = Object.keys(knownMap || {});
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var keyC = key.replace(/[\s　]/g, '');
    if (nm.indexOf(key) === 0 || key.indexOf(nm) === 0) return knownMap[key];
    if (compact.indexOf(keyC) === 0 || keyC.indexOf(compact) === 0) return knownMap[key];
    // 屋号付きへの改称（例: ひばりが丘 → YOGAフレスポひばりが丘）を救済
    if (keyC.length >= 4 && compact.indexOf(keyC) > 0) return knownMap[key];
    if (compact.length >= 4 && keyC.indexOf(compact) > 0) return knownMap[key];
  }
  return '';
}

function lookupStoreByToken_(token, allStores) {
  var t = String(token || '').trim();
  if (!t) return null;
  var tCompact = t.replace(/[\s　]/g, '');
  for (var i = 0; i < (allStores || []).length; i++) {
    var s = allStores[i];
    var sid = String(s.store_id || '').trim();
    var snm = String(s.store_name || '').trim();
    var snmC = snm.replace(/[\s　]/g, '');
    if (sid === t || snm === t || snmC === tCompact) return s;
  }
  return null;
}

function resolveStoreIdToken_(token, allStores) {
  var t = String(token || '').trim();
  if (!t) return '';
  var byId = {};
  var byName = {};
  (allStores || []).forEach(function (s) {
    byId[String(s.store_id || '').trim()] = String(s.store_id || '').trim();
    var nm = String(s.store_name || '').trim();
    if (nm) {
      byName[nm] = String(s.store_id || '').trim();
      byName[nm.replace(/[\s　]/g, '')] = String(s.store_id || '').trim();
    }
  });
  if (byId[t]) return byId[t];
  if (byName[t]) return byName[t];
  if (byName[t.replace(/[\s　]/g, '')]) return byName[t.replace(/[\s　]/g, '')];
  if (/^S\d{3}$/i.test(t)) return t.toUpperCase();
  return t;
}

function employeeBelongsToStore_(primaryRaw, storeId, allStores, storeNameOnRow) {
  if (!String(primaryRaw || '').trim() && !String(storeNameOnRow || '').trim()) return true;
  var target = lookupStoreByToken_(storeId, allStores);
  if (!target) {
    return resolveStoreIdToken_(primaryRaw, allStores) === resolveStoreIdToken_(storeId, allStores);
  }
  var primaryStore = lookupStoreByToken_(primaryRaw, allStores);
  if (primaryStore && primaryStore.store_id === target.store_id) return true;
  if (primaryStore && storeNamesMatch_(primaryStore.store_name, target.store_name)) return true;
  if (storeNameOnRow && storeNamesMatch_(storeNameOnRow, target.store_name)) return true;
  return resolveStoreIdToken_(primaryRaw, allStores) === resolveStoreIdToken_(storeId, allStores);
}

function normalizePersonName_(name) {
  return String(name || '').normalize('NFKC').replace(/[\s\u3000]+/g, ' ').trim();
}

function compactPersonName_(name) {
  return String(name || '').normalize('NFKC').replace(/[\s\u3000]+/g, '');
}

function normalizeByeCode_(code) {
  if (code == null || code === '') return '';
  if (typeof code === 'number' && !isNaN(code)) return String(Math.floor(code));
  var s = String(code).trim();
  if (/^\d+\.0+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

function byeCodesMatch_(a, b) {
  var na = normalizeByeCode_(a);
  var nb = normalizeByeCode_(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) {
    return parseInt(na, 10) === parseInt(nb, 10);
  }
  return false;
}

function familyNameOf_(name) {
  var n = normalizePersonName_(name);
  var parts = n.split(' ');
  return compactPersonName_(parts[0] || n);
}

function namesMatch_(a, b, nameKey) {
  var na = compactPersonName_(a);
  if (!na || na.length < 2) return false;
  var nb = compactPersonName_(b);
  var nk = compactPersonName_(nameKey || '');
  if (na === nb) return true;
  if (nk && na === nk) return true;
  if (na === familyNameOf_(b)) return true;
  if (nk && na === familyNameOf_(nameKey)) return true;
  return false;
}

function assertStaffPassword_(password, byeCode) {
  var p = String(password || '');
  if (p.length < 4) throw new Error('パスワードは4文字以上にしてください');
  if (byeCode && p === String(byeCode)) throw new Error('社員コードと同じパスワードは使えません');
}

function hashStaffPassword_(password, salt) {
  var raw = String(salt) + ':' + String(password);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function verifyStaffPassword_(password, hash, salt) {
  if (!hash || !salt) return false;
  return hashStaffPassword_(password, salt) === String(hash);
}

function writeStaffPassword_(rowIndex, password) {
  var empSh = mustEmployeesSheet_();
  var empMap = headerIndexMap_(getHeaders_(empSh));
  var code = '';
  var name = '';
  if (rowIndex > 0) {
    var row = empSh.getRange(rowIndex, 1, 1, Math.max(empSh.getLastColumn(), 8)).getValues()[0];
    code = normalizeByeCode_(
      (empMap.bye_code != null ? row[empMap.bye_code] : '') || row[empMap.employee_id] || ''
    );
    name = String(row[empMap.name] || '').trim();
  }
  if (!code) throw new Error('社員コードが取得できません。');
  var salt = Utilities.getUuid();
  var hash = hashStaffPassword_(password, salt);
  upsertStaffAuthRow_(code, name, hash, salt, true);
}

function ensureStaffAuthSheet_() {
  var ss = ss_();
  var name = SHIFT_APP.SHEETS.STAFF_AUTH;
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1 || !String(sh.getRange(1, 1).getValue() || '').trim()) {
    sh.getRange(1, 1, 1, 5).setValues([['社員コード', '氏名', '認証ハッシュ', '認証ソルト', 'スタッフ登録済']]);
  }
  sh.getRange(1, 1, 1, 5)
    .setBackground('#5d6d7e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 280);
  sh.setColumnWidth(4, 280);
  sh.setColumnWidth(5, 120);
  if (!sh.isSheetHidden()) sh.hideSheet();
  return sh;
}

function upsertStaffAuthRow_(byeCode, name, hash, salt, registered) {
  var sh = ensureStaffAuthSheet_();
  var code = normalizeByeCode_(byeCode);
  var data = sh.getDataRange().getValues();
  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (byeCodesMatch_(normalizeByeCode_(data[r][0]), code)) {
      rowIndex = r + 1;
      break;
    }
  }
  var row = [code, name || '', hash || '', salt || '', registered ? true : false];
  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, 5).setValues([row]);
    sh.getRange(rowIndex, 1).setNumberFormat('@');
  } else {
    sh.appendRow(row);
    var last = sh.getLastRow();
    sh.getRange(last, 1).setNumberFormat('@').setValue(code);
  }
}

function readStaffAuthByCode_(byeCode) {
  var code = normalizeByeCode_(byeCode);
  if (!code) return null;
  var sh = ss_().getSheetByName(SHIFT_APP.SHEETS.STAFF_AUTH);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!byeCodesMatch_(normalizeByeCode_(data[r][0]), code)) continue;
    return {
      bye_code: normalizeByeCode_(data[r][0]),
      name: String(data[r][1] || ''),
      password_hash: String(data[r][2] || ''),
      password_salt: String(data[r][3] || ''),
      staff_registered: isTruthy_(data[r][4])
    };
  }
  return null;
}

function findEmployeeRowByCode_(byeCode) {
  var code = normalizeByeCode_(byeCode);
  if (!code) return null;
  var sh = mustEmployeesSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  if (map.work_hours == null) map = ensureHeaderColumn_(sh, 'work_hours');
  var values = getDataRows_(sh);
  var allStores = listAllStores_();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!isEmployeeActive_(row, map)) continue;
    var rawId = (map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || '';
    var id = normalizeByeCode_(rawId);
    if (!id || isKeyValue_(id)) continue;
    if (!byeCodesMatch_(id, code)) continue;
    var primary = String(row[map.primary_store_id] || row[map.store_id] || '').trim();
    var storeId = resolveStoreIdToken_(primary, allStores) || primary;
    var auth = readStaffAuthByCode_(id);
    // 移行前の旧列（従業員一覧の認証列）も読む
    if (!auth || !auth.staff_registered) {
      var legacyHash = map.staff_password_hash != null ? String(row[map.staff_password_hash] || '') : '';
      var legacySalt = map.staff_password_salt != null ? String(row[map.staff_password_salt] || '') : '';
      var legacyReg = map.staff_registered != null && isTruthy_(row[map.staff_registered]);
      if (legacyReg && legacyHash && legacySalt) {
        auth = {
          bye_code: id,
          name: String(row[map.name] || ''),
          password_hash: legacyHash,
          password_salt: legacySalt,
          staff_registered: true
        };
      }
    }
    return {
      rowIndex: i + 2,
      bye_code: id,
      name: String(row[map.name] || ''),
      name_key: map.name_key != null ? String(row[map.name_key] || '') : '',
      store_id: storeId,
      password_hash: auth ? auth.password_hash : '',
      password_salt: auth ? auth.password_salt : '',
      staff_registered: !!(auth && auth.staff_registered)
    };
  }
  return null;
}

function polishEmployeesSheet_() {
  var sh = mustEmployeesSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['name', 'bye_code']);

  // 既存の認証列をスタッフログインへ移行
  var migrated = 0;
  if (map.staff_password_hash != null || map.staff_registered != null) {
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var code = normalizeByeCode_(
        (map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || ''
      );
      if (!code) continue;
      var hash = map.staff_password_hash != null ? String(row[map.staff_password_hash] || '') : '';
      var salt = map.staff_password_salt != null ? String(row[map.staff_password_salt] || '') : '';
      var reg = map.staff_registered != null && isTruthy_(row[map.staff_registered]);
      if (reg && hash && salt) {
        upsertStaffAuthRow_(code, String(row[map.name] || ''), hash, salt, true);
        migrated++;
      }
    }
  }

  // A〜Hに再構成（表示用）
  var values = getDataRows_(sh);
  var out = [];
  var seen = {};
  values.forEach(function (row) {
    var code = normalizeByeCode_(
      (map.bye_code != null ? row[map.bye_code] : '') || row[map.employee_id] || ''
    );
    var name = String(row[map.name] || '').trim();
    if (!code || !name || isKeyValue_(code)) return;
    if (seen[code]) return;
    seen[code] = true;
    out.push([
      String(row[map.store_id] || row[map.primary_store_id] || ''),
      map.store_name != null ? String(row[map.store_name] || '') : '',
      map.area != null ? String(row[map.area] || '') : '',
      code,
      name,
      map.email != null ? String(row[map.email] || '') : '',
      map.employment_type != null ? String(row[map.employment_type] || '社員') : '社員',
      map.work_hours != null && row[map.work_hours] !== '' && row[map.work_hours] != null
        ? row[map.work_hours]
        : ''
    ]);
  });
  out.sort(function (a, b) {
    var c = String(a[2]).localeCompare(String(b[2]), 'ja');
    if (c) return c;
    c = String(a[1]).localeCompare(String(b[1]), 'ja');
    if (c) return c;
    return String(a[4]).localeCompare(String(b[4]), 'ja');
  });

  resetMasterSheet_(sh);
  sh.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  if (out.length) {
    sh.getRange(2, 4, out.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, out.length, MASTER_HEADERS.length).setValues(out);
  }
  applyMasterLayout_(sh);
  ensureStaffAuthSheet_();
  hideSystemSheets_();
  ss_().setActiveSheet(sh);
  return (
    '✓ アルバイト登録 ' + out.length + '行（A〜Hのみ）\n' +
    '✓ 認証情報をスタッフログインへ移行 ' + migrated + '件\n' +
    '✓ スタッフログインシートは非表示（システム用）'
  );
}

function createStaffSession_(emp) {
  var token = Utilities.getUuid();
  var payload = JSON.stringify({
    bye_code: emp.bye_code,
    store_id: emp.store_id,
    name: emp.name
  });
  CacheService.getScriptCache().put('staff:' + token, payload, 21600);
  return token;
}

function resolveStaffSession_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('staff:' + String(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
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


/* ============================================================
 * 店舗チャット（管理者同士の簡単な連絡）
 * ============================================================ */
var STORE_CHAT_HEADERS = [
  'メッセージID', '店舗ID', '送信者メール', '送信者名', '内容', '作成日時',
  'リンク従業員ID', 'リンク日付', 'リンクラベル'
];

function ensureStoreChatSheet_() {
  var ss = ss_();
  var name = SHIFT_APP.SHEETS.STORE_CHAT;
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, STORE_CHAT_HEADERS.length).setValues([STORE_CHAT_HEADERS]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (eHide) { /* ignore */ }
    return sh;
  }
  var headers = getHeaders_(sh);
  if (!headers.length) {
    sh.getRange(1, 1, 1, STORE_CHAT_HEADERS.length).setValues([STORE_CHAT_HEADERS]);
  }
  return sh;
}

function listStoreChat(storeId, userEmail, limit) {
  var email = resolveClientEmail_(userEmail);
  var acl = resolveAcl_(email);
  assertStoreAccess_(acl, storeId, false);
  var lim = Math.max(1, Math.min(200, Number(limit) || 80));
  var sh = ensureStoreChatSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['message_id', 'store_id', 'body', 'created_at']);
  var values = getDataRows_(sh);
  var sid = String(storeId || '').trim();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '').trim() !== sid) continue;
    out.push({
      message_id: String(r[map.message_id] || ''),
      store_id: sid,
      user_email: map.user_email != null ? String(r[map.user_email] || '') : '',
      user_name: map.user_name != null ? String(r[map.user_name] || '') : '',
      body: String(r[map.body] || ''),
      created_at: String(r[map.created_at] || ''),
      link_employee_id: map.link_employee_id != null ? String(r[map.link_employee_id] || '') : '',
      link_date: map.link_date != null ? String(r[map.link_date] || '') : '',
      link_label: map.link_label != null ? String(r[map.link_label] || '') : ''
    });
  }
  if (out.length > lim) out = out.slice(out.length - lim);
  return { ok: true, messages: out };
}

function postStoreChat(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var acl = resolveAcl_(email);
  var storeId = String(p.store_id || '').trim();
  assertStoreAccess_(acl, storeId, true);
  var body = String(p.body || '').trim();
  if (!body) throw new Error('メッセージを入力してください。');
  if (body.length > 500) body = body.slice(0, 500);

  var sh = ensureStoreChatSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['message_id', 'store_id', 'body', 'created_at']);

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var id = 'CH' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  var row = new Array(headers.length).fill('');
  row[map.message_id] = id;
  row[map.store_id] = storeId;
  if (map.user_email != null) row[map.user_email] = email;
  var uname = String(p.user_name || acl.displayName || email.split('@')[0] || '').trim();
  if (map.user_name != null) row[map.user_name] = uname;
  row[map.body] = body;
  row[map.created_at] = now;
  if (map.link_employee_id != null) row[map.link_employee_id] = String(p.link_employee_id || '').trim();
  if (map.link_date != null) row[map.link_date] = String(p.link_date || '').trim();
  if (map.link_label != null) row[map.link_label] = String(p.link_label || '').trim();
  sh.appendRow(row);

  return {
    ok: true,
    message: {
      message_id: id,
      store_id: storeId,
      user_email: email,
      user_name: uname,
      body: body,
      created_at: now,
      link_employee_id: String(p.link_employee_id || '').trim(),
      link_date: String(p.link_date || '').trim(),
      link_label: String(p.link_label || '').trim()
    }
  };
}

function deleteStoreChat(payload) {
  var p = payload || {};
  var email = resolveClientEmail_(p.user_email);
  var acl = resolveAcl_(email);
  var storeId = String(p.store_id || '').trim();
  var messageId = String(p.message_id || '').trim();
  assertStoreAccess_(acl, storeId, true);
  if (!messageId) throw new Error('message_id が必要です。');

  var sh = ensureStoreChatSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['message_id', 'store_id']);
  var data = sh.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[map.message_id] || '').trim() !== messageId) continue;
    if (String(r[map.store_id] || '').trim() !== storeId) continue;
    var owner = map.user_email != null ? String(r[map.user_email] || '').trim().toLowerCase() : '';
    if (owner && owner !== String(email || '').toLowerCase()) {
      throw new Error('自分のメッセージだけ削除できます。');
    }
    targetRow = i + 1;
    break;
  }
  if (targetRow < 0) throw new Error('メッセージが見つかりません。');
  sh.deleteRow(targetRow);
  return { ok: true, deleted: messageId };
}

/* ============================================================
 * アルバイト PWA 専用 API（セッション・メール不要）
 * ============================================================ */

function staffRequireSession_(token) {
  var sess = resolveStaffSession_(token);
  if (!sess || !sess.bye_code) {
    throw new Error('セッションの有効期限が切れました。再度ログインしてください。');
  }
  return sess;
}

function staffAssertStoreAccess_(sess, storeId) {
  var sid = String(storeId || '').trim();
  if (!sid) throw new Error('店舗が必要です。');
  var allowed = String(sess.store_id || '').trim();
  if (!allowed) throw new Error('所属店舗が見つかりません。');
  if (allowed === sid) return sid;
  var all = listAllStores_();
  var a = null;
  var b = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].store_id === allowed || storeNamesMatch_(all[i].store_name, allowed)) a = all[i];
    if (all[i].store_id === sid || storeNamesMatch_(all[i].store_name, sid)) b = all[i];
  }
  if (a && b && a.store_id === b.store_id) return b.store_id;
  throw new Error('この店舗を見る権限がありません。');
}

function staffViewerAcl_(sess, storeId) {
  var stores = {};
  stores[storeId] = SHIFT_APP.ROLES.VIEWER;
  return {
    email: 'staff:' + sess.bye_code,
    displayName: sess.name || '',
    isAdmin: false,
    roleMax: SHIFT_APP.ROLES.VIEWER,
    stores: stores
  };
}

function staffGetMonth(token, storeId, yearMonth) {
  var sess = staffRequireSession_(token);
  var sid = staffAssertStoreAccess_(sess, storeId || sess.store_id);
  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');
  var acl = staffViewerAcl_(sess, sid);
  var result = readShifts_(sid, ym, acl.email, acl, {});
  result.me = {
    bye_code: sess.bye_code,
    employee_id: sess.bye_code,
    name: sess.name || ''
  };
  result.canEdit = false;
  result.ok = true;
  return result;
}

var STAFF_HOPE_HEADERS = [
  '希望ID', '店舗ID', '従業員ID', '氏名', '日付', '希望区分', '開始', '終了', 'メモ', '申請状態', '作成日時', '更新日時'
];

function ensureStaffHopeSheet_() {
  var ss = ss_();
  var name = SHIFT_APP.SHEETS.STAFF_HOPE;
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, STAFF_HOPE_HEADERS.length).setValues([STAFF_HOPE_HEADERS]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (eHide) { /* ignore */ }
    return sh;
  }
  var headers = getHeaders_(sh);
  if (!headers.length) {
    sh.getRange(1, 1, 1, STAFF_HOPE_HEADERS.length).setValues([STAFF_HOPE_HEADERS]);
  }
  return sh;
}

function staffListHopes(token, storeId, yearMonth) {
  var sess = staffRequireSession_(token);
  var sid = staffAssertStoreAccess_(sess, storeId || sess.store_id);
  var ym = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('年月は yyyy-MM 形式で指定してください。');
  var sh = ensureStaffHopeSheet_();
  var values = getDataRows_(sh);
  var out = [];
  var myCode = normalizeByeCode_(sess.bye_code);
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[1] || '').trim() !== sid) continue;
    var date = normalizeDate_(row[4]);
    if (!date || date.substring(0, 7) !== ym) continue;
    if (!byeCodesMatch_(normalizeByeCode_(row[2]), myCode)) continue;
    var state = String(row[9] || 'pending');
    if (state === 'cancelled') continue;
    var kind = String(row[5] || 'work');
    if (kind !== 'work' && kind !== 'off') kind = (kind === '休み' ? 'off' : 'work');
    out.push({
      hope_id: String(row[0] || ''),
      store_id: sid,
      employee_id: String(row[2] || ''),
      name: String(row[3] || ''),
      date: date,
      kind: kind,
      start_time: formatHm_(row[6]),
      end_time: formatHm_(row[7]),
      memo: String(row[8] || ''),
      status: state,
      created_at: String(row[10] || '')
    });
  }
  out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  return { ok: true, storeId: sid, yearMonth: ym, hopes: out };
}

function staffSubmitHope(payload) {
  var p = payload || {};
  var sess = staffRequireSession_(p.token);
  var sid = staffAssertStoreAccess_(sess, p.store_id || sess.store_id);
  var date = normalizeDate_(p.date);
  if (!date) throw new Error('日付を選んでください。');
  var kind = String(p.kind || 'work').trim();
  if (kind !== 'work' && kind !== 'off') kind = 'work';
  var start = formatHm_(p.start_time);
  var end = formatHm_(p.end_time);
  if (kind === 'work') {
    if (!isHm_(start) || !isHm_(end)) throw new Error('出勤希望は開始・終了時刻が必要です。');
  } else {
    start = '';
    end = '';
  }
  var memo = String(p.memo || '').trim();
  if (memo.length > 200) memo = memo.slice(0, 200);

  var sh = ensureStaffHopeSheet_();
  var headers = getHeaders_(sh);
  if (!headers.length) {
    sh.getRange(1, 1, 1, STAFF_HOPE_HEADERS.length).setValues([STAFF_HOPE_HEADERS]);
  }
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var id = 'HP' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  sh.appendRow([
    id,
    sid,
    sess.bye_code,
    sess.name || '',
    date,
    kind,
    start,
    end,
    memo,
    'pending',
    now,
    now
  ]);

  var hope = {
    hope_id: id,
    store_id: sid,
    employee_id: sess.bye_code,
    name: sess.name || '',
    date: date,
    kind: kind,
    start_time: start,
    end_time: end,
    memo: memo,
    status: 'pending',
    created_at: now
  };

  try {
    var label = kind === 'off'
      ? ((sess.name || '') + ' · 休み希望')
      : ((sess.name || '') + ' · ' + start + '-' + end + ' 希望');
    var body = kind === 'off'
      ? ((sess.name || '') + ' が ' + date + ' の休みを申請しました')
      : ((sess.name || '') + ' が ' + date + ' の ' + start + '-' + end + ' 出勤を申請しました');
    if (memo) body += '（' + memo + '）';
    staffPostStoreChat({
      token: p.token,
      store_id: sid,
      body: body,
      link_employee_id: sess.bye_code,
      link_date: date,
      link_label: label
    });
  } catch (eChat) { /* ignore */ }

  return { ok: true, hope: hope };
}

function staffCancelHope(payload) {
  var p = payload || {};
  var sess = staffRequireSession_(p.token);
  var sid = staffAssertStoreAccess_(sess, p.store_id || sess.store_id);
  var hopeId = String(p.hope_id || '').trim();
  if (!hopeId) throw new Error('hope_id が必要です。');
  var sh = ensureStaffHopeSheet_();
  var data = sh.getDataRange().getValues();
  var target = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== hopeId) continue;
    if (String(data[i][1] || '').trim() !== sid) continue;
    if (!byeCodesMatch_(normalizeByeCode_(data[i][2]), normalizeByeCode_(sess.bye_code))) {
      throw new Error('自分の申請だけ取り消せます。');
    }
    target = i + 1;
    break;
  }
  if (target < 0) throw new Error('申請が見つかりません。');
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  sh.getRange(target, 10).setValue('cancelled');
  sh.getRange(target, 12).setValue(now);
  return { ok: true, cancelled: hopeId };
}

function staffListStoreChat(token, storeId, limit) {
  var sess = staffRequireSession_(token);
  var sid = staffAssertStoreAccess_(sess, storeId || sess.store_id);
  var lim = Math.max(1, Math.min(200, Number(limit) || 80));
  var sh = ensureStoreChatSheet_();
  var map = headerIndexMap_(getHeaders_(sh));
  requireHeaders_(map, ['message_id', 'store_id', 'body', 'created_at']);
  var values = getDataRows_(sh);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[map.store_id] || '').trim() !== sid) continue;
    out.push({
      message_id: String(r[map.message_id] || ''),
      store_id: sid,
      user_email: map.user_email != null ? String(r[map.user_email] || '') : '',
      user_name: map.user_name != null ? String(r[map.user_name] || '') : '',
      body: String(r[map.body] || ''),
      created_at: String(r[map.created_at] || ''),
      link_employee_id: map.link_employee_id != null ? String(r[map.link_employee_id] || '') : '',
      link_date: map.link_date != null ? String(r[map.link_date] || '') : '',
      link_label: map.link_label != null ? String(r[map.link_label] || '') : ''
    });
  }
  if (out.length > lim) out = out.slice(out.length - lim);
  return { ok: true, messages: out };
}

function staffPostStoreChat(payload) {
  var p = payload || {};
  var sess = staffRequireSession_(p.token);
  var sid = staffAssertStoreAccess_(sess, p.store_id || sess.store_id);
  var body = String(p.body || '').trim();
  if (!body) throw new Error('メッセージを入力してください。');
  if (body.length > 500) body = body.slice(0, 500);

  var sh = ensureStoreChatSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['message_id', 'store_id', 'body', 'created_at']);

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  var id = 'CH' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  var emailKey = 'staff:' + sess.bye_code;
  var uname = String(p.user_name || sess.name || '').trim();
  var row = new Array(headers.length).fill('');
  row[map.message_id] = id;
  row[map.store_id] = sid;
  if (map.user_email != null) row[map.user_email] = emailKey;
  if (map.user_name != null) row[map.user_name] = uname;
  row[map.body] = body;
  row[map.created_at] = now;
  if (map.link_employee_id != null) row[map.link_employee_id] = String(p.link_employee_id || '').trim();
  if (map.link_date != null) row[map.link_date] = String(p.link_date || '').trim();
  if (map.link_label != null) row[map.link_label] = String(p.link_label || '').trim();
  sh.appendRow(row);

  return {
    ok: true,
    message: {
      message_id: id,
      store_id: sid,
      user_email: emailKey,
      user_name: uname,
      body: body,
      created_at: now,
      link_employee_id: String(p.link_employee_id || '').trim(),
      link_date: String(p.link_date || '').trim(),
      link_label: String(p.link_label || '').trim()
    }
  };
}

function staffDeleteStoreChat(payload) {
  var p = payload || {};
  var sess = staffRequireSession_(p.token);
  var sid = staffAssertStoreAccess_(sess, p.store_id || sess.store_id);
  var messageId = String(p.message_id || '').trim();
  if (!messageId) throw new Error('message_id が必要です。');
  var emailKey = ('staff:' + sess.bye_code).toLowerCase();

  var sh = ensureStoreChatSheet_();
  var headers = getHeaders_(sh);
  var map = headerIndexMap_(headers);
  requireHeaders_(map, ['message_id', 'store_id']);
  var data = sh.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[map.message_id] || '').trim() !== messageId) continue;
    if (String(r[map.store_id] || '').trim() !== sid) continue;
    var owner = map.user_email != null ? String(r[map.user_email] || '').trim().toLowerCase() : '';
    if (owner && owner !== emailKey) {
      throw new Error('自分のメッセージだけ削除できます。');
    }
    targetRow = i + 1;
    break;
  }
  if (targetRow < 0) throw new Error('メッセージが見つかりません。');
  sh.deleteRow(targetRow);
  return { ok: true, deleted: messageId };
}

