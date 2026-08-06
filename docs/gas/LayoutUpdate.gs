/**
 * ============================================================
 * レイアウト更新専用（データは消さない）
 * ============================================================
 *
 * 【使い方】
 * 1. 対象スプレッドシート → 拡張機能 → Apps Script
 * 2. ファイル追加 → スクリプト → 名前を LayoutUpdate
 * 3. このファイルを全部貼り付けて保存
 * 4. スプシを再読み込み
 * 5. メニュー「シフト基盤」→ 下記いずれか
 *    - 不足シートを追加（データ保持）
 *    - レイアウト再適用（データ保持）
 *    - 従業員マスタに店舗フィルタを付ける
 *
 * ※ SetupSheets の「初期セットアップ」は中身を消すので、既存データがある場合は使わない
 * ※ このファイルはレイアウト／不足シート追加専用
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('シフト基盤')
    .addItem('不足シートを追加（データ保持）', 'menuEnsureMissingSheets')
    .addItem('レイアウト再適用（データ保持）', 'menuRestyleKeepData')
    .addItem('従業員マスタに店舗フィルタを付ける', 'menuEmployeeStoreFilter')
    .addSeparator()
    .addItem('（危険）初期セットアップは SetupSheets.gs を使う', 'menuWarnSetup')
    .addToUi();
}

function menuWarnSetup() {
  SpreadsheetApp.getUi().alert(
    '注意',
    'データの初期作成・全消し再作成は SetupSheets.gs のメニューを使ってください。\n' +
      'この LayoutUpdate は「足りないシート追加」と「見た目の再適用」だけです。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuEnsureMissingSheets() {
  const ui = SpreadsheetApp.getUi();
  const summary = ensureMissingSheets_();
  ui.alert('不足シートの追加', summary, ui.ButtonSet.OK);
}

function menuRestyleKeepData() {
  const ui = SpreadsheetApp.getUi();
  const summary = restyleAllKeepData_();
  ui.alert('レイアウト再適用', summary, ui.ButtonSet.OK);
}

function menuEmployeeStoreFilter() {
  const ui = SpreadsheetApp.getUi();
  const summary = setupEmployeeStoreFilter_();
  ui.alert('店舗フィルタ', summary, ui.ButtonSet.OK);
}

/* ============================================================
 * 定義（不足追加・レイアウト用）
 * ============================================================ */
var LAYOUT_SHEET_DEFS = [
  {
    name: '店舗マスタ',
    tabColor: '#4a86e8',
    headers: ['store_id', 'store_name', 'area', 'is_active', 'sort_order', 'note'],
    widths: [100, 140, 120, 90, 100, 220],
    boolCols: [4],
    numberCols: [5]
  },
  {
    name: '従業員マスタ',
    tabColor: '#6aa84f',
    headers: [
      'employee_id', 'name', 'name_key', 'email', 'bye_code',
      'primary_store_id', 'employment_type', 'is_active', 'calendar_sync', 'memo_offset', 'note'
    ],
    widths: [110, 120, 110, 220, 100, 120, 120, 90, 110, 100, 180],
    boolCols: [8, 9],
    numberCols: [10],
    listValidations: { 7: ['社員', 'パート', 'その他'] },
    note: '店舗で絞るときは primary_store_id 列でフィルタ（経堂=S001 など）'
  },
  {
    name: 'シフト',
    tabColor: '#e69138',
    headers: [
      'shift_id', 'date', 'employee_id', 'store_id', 'status',
      'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'
    ],
    widths: [150, 110, 110, 100, 90, 90, 90, 110, 90, 150, 200],
    numberCols: [8],
    dateCols: [2],
    listValidations: {
      5: ['work', 'off', 'pto', 'absent', 'undef'],
      9: ['web', 'import', 'system']
    }
  },
  {
    name: 'シフトメモ',
    tabColor: '#f6b26b',
    headers: [
      'memo_id', 'date', 'employee_id', 'store_id', 'kind',
      'title', 'start_time', 'end_time', 'body', 'updated_at', 'updated_by'
    ],
    widths: [100, 110, 110, 100, 90, 140, 90, 90, 260, 150, 200],
    dateCols: [2],
    listValidations: { 5: ['meeting', 'task', 'note'] }
  },
  {
    name: '週間固定',
    tabColor: '#3d85c6',
    headers: [
      'weekly_id', 'employee_id', 'store_id', 'weekday', 'status',
      'start_time', 'end_time', 'break_minutes', 'is_active', 'updated_at', 'updated_by'
    ],
    widths: [140, 110, 100, 90, 90, 90, 90, 110, 90, 150, 200],
    boolCols: [9],
    numberCols: [4, 8],
    listValidations: { 5: ['work', 'off', 'pto', 'absent', 'undef'] }
  },
  {
    name: '権限',
    tabColor: '#8e7cc3',
    headers: ['email', 'store_id', 'role', 'is_active'],
    widths: [240, 100, 90, 90],
    boolCols: [4],
    listValidations: { 3: ['viewer', 'editor', 'admin'] }
  },
  {
    name: '設定',
    tabColor: '#76a5af',
    headers: ['key', 'value', 'note'],
    widths: [200, 280, 320]
  },
  {
    name: '同期ログ',
    tabColor: '#999999',
    headers: ['logged_at', 'type', 'target', 'range', 'result', 'message'],
    widths: [150, 100, 120, 100, 80, 360],
    listValidations: {
      2: ['calendar', 'bye_bye', 'labor'],
      5: ['ok', 'error']
    }
  }
];

var HEADER_BG = '#1f4e79';
var HEADER_FG = '#ffffff';
var ZEBRA = '#f3f6fa';

/* ============================================================
 * 不足シート追加（既存は触らない）
 * ============================================================ */
function ensureMissingSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lines = [];
  LAYOUT_SHEET_DEFS.forEach(function (def) {
    var sh = ss.getSheetByName(def.name);
    if (sh) {
      lines.push('既存: ' + def.name + '（スキップ）');
      return;
    }
    sh = ss.insertSheet(def.name);
    sh.setTabColor(def.tabColor);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    applyLayoutKeepData_(sh, def);
    lines.push('追加: ' + def.name);
  });

  // 店舗名が分かる補助列メモを従業員マスタA1ノートに
  var emp = ss.getSheetByName('従業員マスタ');
  if (emp) {
    emp.getRange(1, 1).setNote(
      '【相互編集】Webアプリとこのシートは同じデータを見ます。\n' +
        '店舗で絞る: データ → フィルタ → primary_store_id（例: S001=経堂）\n' +
        'またはメニュー「従業員マスタに店舗フィルタを付ける」'
    );
  }

  ensureStoreLookupSheet_(ss, lines);
  ss.toast('不足シートの確認が完了しました', 'シフト基盤', 5);
  return lines.join('\n');
}

function restyleAllKeepData_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lines = [];
  LAYOUT_SHEET_DEFS.forEach(function (def) {
    var sh = ss.getSheetByName(def.name);
    if (!sh) {
      lines.push('未作成: ' + def.name);
      return;
    }
    // ヘッダが空ならだけ書く（データ行は触らない）
    var first = String(sh.getRange(1, 1).getValue() || '').trim();
    if (!first) {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      lines.push('ヘッダ補完: ' + def.name);
    }
    applyLayoutKeepData_(sh, def);
    lines.push('レイアウト再適用: ' + def.name);
  });
  ensureStoreLookupSheet_(ss, lines);
  ss.toast('レイアウトを再適用しました', 'シフト基盤', 5);
  return lines.join('\n');
}

/**
 * 従業員を店舗名で見やすくするビューシート
 * A2 で店舗を選ぶと、その店舗の従業員だけ表示
 */
function setupEmployeeStoreFilter_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var emp = ss.getSheetByName('従業員マスタ');
  var stores = ss.getSheetByName('店舗マスタ');
  if (!emp || !stores) {
    return '従業員マスタ / 店舗マスタ が必要です。先に「不足シートを追加」を実行してください。';
  }

  // 本体にもフィルタを付ける
  var lastRow = Math.max(emp.getLastRow(), 2);
  var lastCol = Math.max(emp.getLastColumn(), 1);
  var filter = emp.getFilter();
  if (filter) filter.remove();
  emp.getRange(1, 1, lastRow, lastCol).createFilter();
  emp.setFrozenRows(1);

  var viewName = '従業員_店舗別ビュー';
  var view = ss.getSheetByName(viewName);
  if (!view) view = ss.insertSheet(viewName);
  view.clear();
  view.setTabColor('#93c47d');
  view.setColumnWidth(1, 160);
  view.setColumnWidth(2, 140);
  view.setColumnWidth(3, 120);
  view.setColumnWidth(4, 220);
  view.setColumnWidth(5, 120);

  view.getRange('A1').setValue('店舗を選択 →');
  view.getRange('A1').setFontWeight('bold');
  view.getRange('B1').setValue('経堂'); // 初期例
  view.getRange('B1').setBackground('#fff2cc');
  view.getRange('B1').setNote('ここを店舗名に変えると下の一覧が切り替わります（店舗マスタの store_name）');

  // 店舗名の入力規則
  var storeLast = Math.max(stores.getLastRow(), 2);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(stores.getRange(2, 2, storeLast - 1, 1), true)
    .setAllowInvalid(false)
    .build();
  // requireValueInRange(range) - fix: getRange(2,2,storeLast,2)
  rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(stores.getRange(2, 2, Math.max(storeLast, 2), 2), true)
    .setAllowInvalid(true)
    .build();
  view.getRange('B1').setDataValidation(rule);

  view.getRange(3, 1, 1, 5).setValues([['employee_id', 'name', 'bye_code', 'email', 'primary_store_id']]);
  view.getRange(3, 1, 1, 5)
    .setBackground(HEADER_BG)
    .setFontColor(HEADER_FG)
    .setFontWeight('bold');

  // FILTER: 店舗名 → store_id → 従業員
  // 店舗マスタ!B:B = store_name, A:A = store_id
  // 従業員マスタ F列 = primary_store_id
  view.getRange('A4').setFormula(
    '=IFERROR(FILTER(' +
      "'従業員マスタ'!A:E," +
      "'従業員マスタ'!F:F=IFERROR(INDEX('店舗マスタ'!A:A,MATCH(B1,'店舗マスタ'!B:B,0)),\"\")," +
      "'従業員マスタ'!H:H=TRUE" +
      '),\"該当なし\")'
  );

  view.getRange('A2').setValue('下の表は B1 の店舗だけ表示（Webと相互同期の元データは「従業員マスタ」）');
  view.getRange('A2').setFontColor('#666666');

  return (
    '完了しました。\n\n' +
      '1) 「従業員マスタ」本体にフィルタを付けました（primary_store_id で絞れます）\n' +
      '2) 「' + viewName + '」シートを作りました。B1 で店舗名を選ぶとその店の人だけ出ます\n\n' +
      '編集の正本は「従業員マスタ」です。ビューは見やすくするための画面です。'
  );
}

function ensureStoreLookupSheet_(ss, lines) {
  // 店舗ID早見（編集補助）
  var name = '店舗ID早見';
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    lines.push('追加: ' + name);
  } else {
    lines.push('既存: ' + name);
  }
  sh.clear();
  sh.setTabColor('#cfe2f3');
  sh.getRange(1, 1, 1, 3).setValues([['store_id', 'store_name', 'area']]);
  sh.getRange(1, 1, 1, 3).setBackground(HEADER_BG).setFontColor(HEADER_FG).setFontWeight('bold');
  sh.getRange('A2').setFormula("=IFERROR(FILTER({'店舗マスタ'!A:A,'店舗マスタ'!B:B,'店舗マスタ'!C:C},'店舗マスタ'!D:D=TRUE),\"\")");
  sh.setFrozenRows(1);
  sh.getRange('A1').setNote('従業員マスタの primary_store_id にはここの store_id を入れます（例: 経堂=S001）');
}

/* ============================================================
 * レイアウト適用（データ行の値は消さない）
 * ============================================================ */
function applyLayoutKeepData_(sh, def) {
  var cols = def.headers.length;
  var header = sh.getRange(1, 1, 1, cols);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 50), cols).setFontFamily('Meiryo');
  header
    .setBackground(HEADER_BG)
    .setFontColor(HEADER_FG)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 28);

  (def.widths || []).forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  var dataRows = Math.max(sh.getLastRow(), 200);
  if (dataRows > 1) {
    for (var r = 2; r <= Math.min(dataRows, 120); r++) {
      sh.getRange(r, 1, 1, cols).setBackground(r % 2 === 0 ? ZEBRA : '#ffffff');
    }
  }

  (def.boolCols || []).forEach(function (c) {
    var rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
    sh.getRange(2, c, 500, 1).setDataValidation(rule);
  });

  var lists = def.listValidations || {};
  Object.keys(lists).forEach(function (key) {
    var c = Number(key);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(lists[key], true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, c, 500, 1).setDataValidation(rule);
  });

  (def.dateCols || []).forEach(function (c) {
    sh.getRange(2, c, 500, 1).setNumberFormat('yyyy-mm-dd');
  });
  (def.numberCols || []).forEach(function (c) {
    sh.getRange(2, c, 500, 1).setNumberFormat('0');
  });

  var lastRow = Math.max(sh.getLastRow(), 2);
  var filter = sh.getFilter();
  if (filter) filter.remove();
  sh.getRange(1, 1, lastRow, cols).createFilter();

  if (def.note) header.setNote(def.note);
}
