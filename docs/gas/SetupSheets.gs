/**
 * ============================================================
 * 新 シフト『キンタイ・カレンダー』管理 — シート初期セットアップ
 * ============================================================
 *
 * 【使い方】
 * 1. 対象スプレッドシートを開く
 * 2. 拡張機能 → Apps Script
 * 3. このファイルの内容をすべて貼り付けて保存
 * 4. スプレッドシートを再読み込み
 * 5. メニュー「シフト基盤」→「シート構成を初期セットアップ」
 *
 * ※ 既存の同名シートがある場合は中身を消して作り直します（要確認ダイアログ）
 * ※ 他リポジトリの GAS には入れないでください（このブック専用）
 */

/* ============================================================
 * メニュー
 * ============================================================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('シフト基盤')
    .addItem('シート構成を初期セットアップ', 'menuSetupSheets')
    .addItem('レイアウトだけ再適用（データは残す）', 'menuRestyleOnly')
    .addToUi();
}

function menuSetupSheets() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    'シート構成の初期セットアップ',
    '次のシートを作成／再作成します。\n\n' +
      '・使い方（規則）\n・店舗マスタ\n・従業員マスタ\n・シフト\n・シフトメモ\n・週間固定\n・権限\n・設定\n・同期ログ\n\n' +
      '同名シートがある場合は中身を消して作り直します。よろしいですか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  const summary = setupAllSheets({ wipeExisting: true, insertSamples: true });
  ui.alert('完了', summary, ui.ButtonSet.OK);
}

function menuRestyleOnly() {
  const ui = SpreadsheetApp.getUi();
  const summary = setupAllSheets({ wipeExisting: false, insertSamples: false, restyleOnly: true });
  ui.alert('レイアウト再適用', summary, ui.ButtonSet.OK);
}

/* ============================================================
 * 定義（規則のソース・オブ・トゥルース）
 * ============================================================ */
const SHEET_DEFS = [
  {
    name: '使い方',
    tabColor: '#666666',
    kind: 'guide'
  },
  {
    name: '店舗マスタ',
    tabColor: '#4a86e8',
    headers: ['store_id', 'store_name', 'area', 'is_active', 'sort_order', 'note'],
    widths: [100, 140, 120, 90, 100, 220],
    boolCols: [4], // 1-based
    numberCols: [5],
    samples: [
      ['S001', '経堂', '第7エリア', true, 10, '試験店舗'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '試験店舗']
    ],
    rules: [
      'store_id は一度決めたら変更しない（Web・シフトが参照する）',
      'is_active=FALSE の店舗は Web の候補から外す',
      'sort_order は小さい順に表示'
    ]
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
    listValidations: {
      7: ['社員', 'パート', 'その他'] // employment_type
    },
    samples: [
      [
        'E001', '日下 竜汰', '日下竜汰', 'r-kusaka@okamoto-group.co.jp', '303879',
        'S001', '社員', true, true, 1, 'サンプル行（必要なら削除）'
      ]
    ],
    rules: [
      'employee_id は一意。変更しない',
      'email は Google カレンダー同期先',
      'bye_code はバイバイ（勤怠）社員コード',
      '主所属は primary_store_id。ヘルプ勤務はシフト行の store_id で表現'
    ]
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
    },
    samples: [],
    rules: [
      '1行 = ある人の、ある日の、ある店舗の予定',
      'status: work=勤務 / off=公休など / pto=有休 / absent=欠勤 / undef=未定',
      'work のとき start_time・end_time 必須（HH:mm）',
      '現場は Web のみ編集。このシートを一般に共有しない'
    ]
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
    listValidations: {
      5: ['meeting', 'task', 'note']
    },
    samples: [],
    rules: [
      '会議・タスク・備考用（旧シフト表のメモ行に相当）',
      '時間が空なら終日／時間未定として扱ってよい'
    ]
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
    listValidations: {
      5: ['work', 'off', 'pto', 'absent', 'undef']
    },
    samples: [],
    rules: [
      '1行 = 従業員×店舗×曜日（0=日 … 6=土）の固定パターン',
      '月間シフト作成はこの表を展開して作る',
      '後から変更可（次回の月間作成から反映）'
    ]
  },
  {
    name: '権限',
    tabColor: '#8e7cc3',
    headers: ['email', 'store_id', 'role', 'is_active'],
    widths: [240, 100, 90, 90],
    boolCols: [4],
    listValidations: {
      3: ['viewer', 'editor', 'admin']
    },
    samples: [
      ['r-kusaka@okamoto-group.co.jp', '*', 'admin', true]
    ],
    rules: [
      'Web ログインメール × store_id で見える店舗を決める',
      'admin は store_id=* で全店',
      'editor=編集 / viewer=閲覧のみ',
      '店舗名の手入力だけに頼らない（他店閲覧リスク防止）'
    ]
  },
  {
    name: '設定',
    tabColor: '#76a5af',
    headers: ['key', 'value', 'note'],
    widths: [200, 280, 320],
    samples: [
      ['app_title', 'シフト・キンタイ・カレンダー', 'Web 上のタイトル'],
      ['company_domain', 'okamoto-group.co.jp', 'ログイン許可ドメイン'],
      ['calendar_shift_style', 'location_bar', 'location_bar または block'],
      ['default_break_minutes', '60', '休憩の目安（分）'],
      ['attendance_dest_sheet', 'バイバイ貼り付け', '勤怠出力先シート名（将来）']
    ],
    rules: [
      'アプリ／GAS が読む定数。key は重複させない'
    ]
  },
  {
    name: '同期ログ',
    tabColor: '#999999',
    headers: ['logged_at', 'type', 'target', 'range', 'result', 'message'],
    widths: [150, 100, 120, 100, 80, 360],
    listValidations: {
      2: ['calendar', 'bye_bye', 'labor'],
      5: ['ok', 'error']
    },
    samples: [],
    rules: [
      'カレンダー／勤怠／レイバー出力の履歴。手編集しない（システムが追記）'
    ]
  }
];

const HEADER_BG = '#1f4e79';
const HEADER_FG = '#ffffff';
const GUIDE_TITLE_BG = '#1f4e79';
const ZEBRA = '#f3f6fa';

/* ============================================================
 * メイン
 * ============================================================ */
function setupAllSheets(options) {
  const opts = options || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];

  SHEET_DEFS.forEach(function (def) {
    if (def.kind === 'guide') {
      const sh = ensureSheet_(ss, def.name, opts.wipeExisting && !opts.restyleOnly);
      sh.setTabColor(def.tabColor);
      buildGuideSheet_(sh);
      lines.push('✓ ' + def.name);
      return;
    }

    if (opts.restyleOnly) {
      const existing = ss.getSheetByName(def.name);
      if (!existing) {
        lines.push('スキップ（未作成）: ' + def.name);
        return;
      }
      applyLayout_(existing, def);
      lines.push('✓ レイアウト再適用: ' + def.name);
      return;
    }

    const sh = ensureSheet_(ss, def.name, opts.wipeExisting);
    sh.setTabColor(def.tabColor);
    writeHeaders_(sh, def.headers);
    if (opts.insertSamples && def.samples && def.samples.length) {
      sh.getRange(2, 1, def.samples.length, def.headers.length).setValues(def.samples);
    }
    applyLayout_(sh, def);
    lines.push('✓ ' + def.name + (opts.insertSamples && def.samples.length ? '（サンプル込）' : ''));
  });

  // 初期の「シート1」など空シートを片付ける
  cleanupDefaultSheets_(ss);
  orderSheets_(ss);

  ss.toast('シート構成のセットアップが完了しました', 'シフト基盤', 5);
  return lines.join('\n');
}

/* ============================================================
 * シート作成・配置
 * ============================================================ */
function ensureSheet_(ss, name, wipe) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    return sh;
  }
  if (wipe) {
    sh.clear();
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    const filter = sh.getFilter();
    if (filter) filter.remove();
  }
  return sh;
}

function orderSheets_(ss) {
  SHEET_DEFS.forEach(function (def, i) {
    const sh = ss.getSheetByName(def.name);
    if (sh) ss.setActiveSheet(sh);
    if (sh) ss.moveActiveSheet(i + 1);
  });
}

function cleanupDefaultSheets_(ss) {
  const keep = {};
  SHEET_DEFS.forEach(function (d) { keep[d.name] = true; });
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (keep[n]) return;
    // 空のデフォルト名だけ削除（データがあるシートは残す）
    if (/^シート\d+$/.test(n) || /^Sheet\d+$/i.test(n)) {
      if (sh.getLastRow() === 0 && sh.getLastColumn() === 0) {
        if (ss.getSheets().length > 1) ss.deleteSheet(sh);
      } else if (sh.getLastRow() <= 1 && sh.getLastColumn() <= 1) {
        const v = String(sh.getRange(1, 1).getValue() || '');
        if (!v && ss.getSheets().length > 1) ss.deleteSheet(sh);
      }
    }
  });
}

/* ============================================================
 * ヘッダ・レイアウト
 * ============================================================ */
function writeHeaders_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function applyLayout_(sh, def) {
  const cols = def.headers.length;
  const header = sh.getRange(1, 1, 1, cols);

  // 表示
  sh.setFrozenRows(1);
  sh.setHiddenGridlines(false);
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 100), cols).setFontFamily('Meiryo');

  header
    .setBackground(HEADER_BG)
    .setFontColor(HEADER_FG)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 28);

  // 列幅
  (def.widths || []).forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  // データ行の書式
  const dataRows = Math.max(sh.getLastRow(), 200);
  if (dataRows > 1) {
    const body = sh.getRange(2, 1, dataRows - 1, cols);
    body.setVerticalAlignment('middle');
    body.setFontSize(10);

    // ゼブラ（薄い行）
    for (var r = 2; r <= Math.min(dataRows, 100); r++) {
      if (r % 2 === 0) {
        sh.getRange(r, 1, 1, cols).setBackground(ZEBRA);
      } else {
        sh.getRange(r, 1, 1, cols).setBackground('#ffffff');
      }
    }
  }

  // 真偽値
  (def.boolCols || []).forEach(function (c) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, c, 500, 1).setDataValidation(rule);
  });

  // リスト
  const lists = def.listValidations || {};
  Object.keys(lists).forEach(function (key) {
    const c = Number(key);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(lists[key], true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, c, 500, 1).setDataValidation(rule);
  });

  // 日付表示
  (def.dateCols || []).forEach(function (c) {
    sh.getRange(2, c, 500, 1).setNumberFormat('yyyy-mm-dd');
  });

  // 数値
  (def.numberCols || []).forEach(function (c) {
    sh.getRange(2, c, 500, 1).setNumberFormat('0');
  });

  // フィルタ
  const lastRow = Math.max(sh.getLastRow(), 2);
  const filter = sh.getFilter();
  if (filter) filter.remove();
  sh.getRange(1, 1, lastRow, cols).createFilter();

  // メモ（規則）をヘッダ行にノートとして添付
  if (def.rules && def.rules.length) {
    header.setNote('【規則】\n・' + def.rules.join('\n・'));
  }
}

/* ============================================================
 * 使い方シート
 * ============================================================ */
function buildGuideSheet_(sh) {
  sh.clear();
  const filter = sh.getFilter();
  if (filter) filter.remove();

  sh.setColumnWidth(1, 920);
  sh.setHiddenGridlines(true);

  const lines = [
    ['新 シフト『キンタイ・カレンダー』管理 — 使い方・規則'],
    [''],
    ['■ このブックの役割'],
    ['DXチーム専用のデータ置き場です。一般従業員にはこのURLを渡さないでください。'],
    ['現場の閲覧・編集は、これから作る Webアプリ（1URL）からのみ行います。'],
    [''],
    ['■ シートの役割'],
    ['・店舗マスタ … 全店一覧（ID・表示名・エリア・有効フラグ）'],
    ['・従業員マスタ … 氏名・メール・勤怠コード・主所属店舗'],
    ['・シフト … 中核。1行＝人×日×店舗の予定'],
    ['・シフトメモ … 会議・タスク・備考'],
    ['・権限 … 誰がどの店舗を Web で見られるか'],
    ['・設定 … アプリ／GAS 用の定数'],
    ['・同期ログ … カレンダー／勤怠出力の履歴（システム追記）'],
    [''],
    ['■ データの規則'],
    ['1. ID列（store_id / employee_id / shift_id など）は一度決めたら変えない'],
    ['2. シフトは行列レイアウトではなく、正規化表（縦持ち）を正とする'],
    ['3. status は work / off / pto / absent / undef のみ'],
    ['4. work のとき start_time・end_time は HH:mm'],
    ['5. 権限の admin は store_id=* で全店'],
    ['6. ヘッダ行（1行目）は消さない・列順を勝手に入れ替えない'],
    [''],
    ['■ 運用の流れ（予定）'],
    ['従業員 → Web（ログイン）→ 権限で店舗だけ表示 → シフト／メモを編集'],
    ['　　　　↓'],
    ['このスプレッドシート（DXのみ）'],
    ['　　　　↓'],
    ['GAS … Googleカレンダー反映／バイバイ貼り付け／（必要なら）レイバー'],
    [''],
    ['■ メニュー'],
    ['「シフト基盤」→「シート構成を初期セットアップ」で再構築できます。'],
    ['「レイアウトだけ再適用」はデータはそのまま、見た目と入力規則だけ直します。'],
    [''],
    ['■ 注意'],
    ['サンプル行（店舗・従業員・権限）は試験用です。本番前に見直してください。'],
    ['共有設定は DXチームのみ（編集者）。リンクを知っている全員にはしない。']
  ];

  sh.getRange(1, 1, lines.length, 1).setValues(lines);
  sh.getRange(1, 1)
    .setBackground(GUIDE_TITLE_BG)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(14);
  sh.setRowHeight(1, 36);

  for (var i = 1; i <= lines.length; i++) {
    const t = String(lines[i - 1][0] || '');
    if (t.indexOf('■') === 0) {
      sh.getRange(i, 1)
        .setFontWeight('bold')
        .setFontSize(11)
        .setBackground('#d9e2f3');
    } else if (i > 1) {
      sh.getRange(i, 1).setFontSize(10);
    }
    sh.setRowHeight(i, i === 1 ? 36 : 22);
  }

  sh.setFrozenRows(1);
}
