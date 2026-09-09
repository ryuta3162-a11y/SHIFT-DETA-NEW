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
    .addItem('ヘッダを日本語に変換', 'menuMigrateHeadersJa')
    .addToUi();
}

function menuSetupSheets() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    'シート構成の初期セットアップ',
    '次のシートを作成／再作成します。\n\n' +
      '・マスターデータ\n・シフト\n・シフトメモ\n・週間固定\n・権限\n・設定\n・同期ログ\n\n' +
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
    name: 'マスターデータ',
    tabColor: '#4a86e8',
    headers: [
      '店舗ID', '店舗名', 'エリア', '店舗有効', '表示順',
      '従業員ID', '氏名', '氏名キー', 'メール', '社員コード',
      '雇用区分', '有効', 'カレンダー同期', '勤務時間', '備考'
    ],
    widths: [90, 120, 110, 80, 70, 110, 120, 110, 220, 100, 90, 70, 110, 80, 200],
    boolCols: [4, 12, 13],
    numberCols: [5, 14],
    listValidations: {
      11: ['社員', 'パート', 'その他']
    },
    samples: [
      ['S001', '経堂', '第7エリア', true, 10, 'EK003', '日下 竜汰', '日下竜汰', 'r-kusaka@okamoto-group.co.jp', '303879', '社員', true, true, '', ''],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '030396', '津田 加奈', '津田加奈', '', '030396', '社員', true, false, '', 'ひばり／旧SHOPS'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '030400', '吉田 薫理', '吉田薫理', '', '030400', '社員', true, false, '', 'ひばり／旧SHOPS'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '30204', '黒川 沙由美', '黒川沙由美', '', '30204', 'パート', true, false, 4, 'ひばり／パート・時間は日ごと'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '30331', '徳重 翠', '徳重翠', '', '30331', '社員', true, false, '', 'ひばり／旧SHOPS'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '303523', '大野 雅代', '大野雅代', '', '303523', '社員', true, false, '', 'ひばり／旧SHOPS'],
      ['S002', 'ひばりが丘', '第7エリア', true, 20, '30469', '手塚 柚衣', '手塚柚衣', '', '30469', '社員', true, false, '', 'ひばり／旧SHOPS']
    ],
    rules: [
      '1行＝1人。左が店舗、右が従業員',
      '店舗ID は一度決めたら変更しない',
      '店舗だけの行は従業員IDを空にする',
      '店舗有効＝オフの店は Web の候補から外す'
    ]
  },
  {
    name: 'シフト',
    tabColor: '#e69138',
    headers: [
      'シフトID', '日付', '従業員ID', '店舗ID', '区分', '休日休暇コード',
      '開始', '終了', '休憩分', '入力元', '更新日時', '更新者'
    ],
    widths: [150, 110, 110, 100, 90, 110, 90, 90, 90, 110, 150, 200],
    numberCols: [6, 9],
    dateCols: [2],
    listValidations: {
      5: ['work', 'off', 'pto', 'absent', 'undef'],
      10: ['web', 'import', 'system']
    },
    samples: [],
    rules: [
      '1行 = ある人の、ある日の、ある店舗の予定',
      '区分: work=勤務 / off=公休など / pto=有休 / absent=欠勤 / undef=未定（値の日本語化は次工程）',
      '勤務のとき開始・終了必須（HH:mm）',
      '現場は Web のみ編集。このシートを一般に共有しない'
    ]
  },
  {
    name: 'シフトメモ',
    tabColor: '#f6b26b',
    headers: [
      'メモID', '日付', '従業員ID', '店舗ID', '種類',
      '件名', '開始', '終了', '内容', '更新日時', '更新者'
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
      '週間ID', '従業員ID', '店舗ID', '曜日', '区分',
      '開始', '終了', '休憩分', '有効', '更新日時', '更新者'
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
    headers: ['メール', '店舗ID', '役割', '有効'],
    widths: [240, 100, 90, 90],
    boolCols: [4],
    listValidations: {
      3: ['viewer', 'editor', 'admin']
    },
    samples: [
      ['r-kusaka@okamoto-group.co.jp', '*', 'admin', true]
    ],
    rules: [
      'Web ログインメール × 店舗ID で見える店舗を決める',
      '管理（admin）は 店舗ID=* で全店',
      '編集（editor）／閲覧（viewer）',
      '店舗名の手入力だけに頼らない（他店閲覧リスク防止）'
    ]
  },
  {
    name: '設定',
    tabColor: '#76a5af',
    headers: ['キー', '値', '備考'],
    widths: [200, 280, 320],
    samples: [
      ['app_title', 'シフト・キンタイ・カレンダー', 'Web 上のタイトル'],
      ['company_domain', 'okamoto-group.co.jp', 'ログイン許可ドメイン'],
      ['calendar_shift_style', 'location_bar', 'location_bar または block'],
      ['default_break_minutes', '60', '休憩の目安（分）'],
      ['attendance_dest_sheet', 'バイバイ貼り付け', '勤怠出力先シート名（将来）']
    ],
    rules: [
      'アプリ／GAS が読む定数。キーは重複させない'
    ]
  },
  {
    name: '同期ログ',
    tabColor: '#999999',
    headers: ['記録日時', '種類', '対象', '範囲', '結果', 'メッセージ'],
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
    ['1. ID列（店舗ID／従業員ID／シフトID など）は一度決めたら変えない'],
    ['2. シフトは行列レイアウトではなく、正規化表（縦持ち）を正とする'],
    ['3. 区分は work / off / pto / absent / undef（値の日本語化は別途）'],
    ['4. 勤務のとき開始・終了は HH:mm'],
    ['5. 権限の管理は 店舗ID=* で全店'],
    ['6. ヘッダ行（1行目）は消さない・列順を勝手に入れ替えない'],
    ['7. ヘッダは日本語。メニュー「ヘッダを日本語に変換」で既存英語ヘッダを置換できる'],
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
