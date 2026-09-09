import fs from 'fs';

const p = 'docs/gas/deployed/Code.gs';
let s = fs.readFileSync(p, 'utf8');

const reps = [
  [
    /var sh = mustShiftSheetForMonth_\(ymBatch\);\s*\r?\n\s*var ensured = ensureLeaveCodeHeader_\(sh\);/g,
    'var sh = mustShiftSheetForStore_(storeId);\n  var ensured = ensureShiftHeadersLean_(sh);',
  ],
  [
    /var sh = mustShiftSheetForMonth_\(date\.substring\(0, 7\)\);\s*\r?\n\s*var ensured = ensureLeaveCodeHeader_\(sh\);/g,
    'var sh = mustShiftSheetForStore_(storeId);\n  var ensured = ensureShiftHeadersLean_(sh);',
  ],
  [
    /var shEarly = mustShiftSheetForMonth_\(ym\);\s*\r?\n\s*mapEarly = ensureLeaveCodeHeader_\(shEarly\)\.map;/g,
    'var shEarly = mustShiftSheetForStore_(storeId);\n      mapEarly = ensureShiftHeadersLean_(shEarly).map;',
  ],
  [
    /var sh = mustShiftSheetForMonth_\(ym\);\s*\r?\n\s*var ensured = ensureLeaveCodeHeader_\(sh\);/g,
    'var sh = mustShiftSheetForStore_(storeId);\n  var ensured = ensureShiftHeadersLean_(sh);',
  ],
  [
    /var sh = ensureMemoSheetForMonth_\(ymFromItems\);/g,
    'var sh = ensureMemoSheetForStore_(storeId);',
  ],
  [
    /requireHeaders_\(map, \[\s*\r?\n\s*'shift_id', 'date', 'employee_id', 'store_id', 'status',\s*\r?\n\s*'start_time', 'end_time', 'break_minutes', 'source', 'updated_at', 'updated_by'\s*\r?\n\s*\]\);/g,
    "requireHeaders_(map, ['shift_id', 'date', 'employee_id', 'store_id', 'status', 'start_time', 'end_time']);",
  ],
];

for (const [re, to] of reps) {
  const before = s.length;
  s = s.replace(re, to);
  console.log(String(re).slice(0, 60), 'changed', before !== s.length);
}

// listMemos_ open store sheet first
s = s.replace(
  /function listMemos_\(storeId, ym\) \{\r?\n  var sh = ss_\(\)\.getSheetByName\(memoMonthlySheetName_\(ym\)\);\r?\n  if \(!sh\) sh = ss_\(\)\.getSheetByName\(SHIFT_APP\.SHEETS\.MEMOS\);/,
  `function listMemos_(storeId, ym) {\n  var sh = ss_().getSheetByName(storeMemoSheetName_(storeId));\n  if (!sh && ym) {\n    try { sh = ss_().getSheetByName(memoMonthlySheetName_(ym)); } catch (eM) { sh = null; }\n  }\n  if (!sh) sh = ss_().getSheetByName(SHIFT_APP.SHEETS.MEMOS);`
);

// upsert memos requireHeaders - kind optional
s = s.replace(
  /requireHeaders_\(map, \['memo_id', 'date', 'employee_id', 'store_id', 'kind', 'body', 'updated_at', 'updated_by'\]\);/g,
  "requireHeaders_(map, ['memo_id', 'date', 'employee_id', 'body']);"
);

fs.writeFileSync(p, s);
console.log('remaining mustShiftSheetForMonth_', (s.match(/mustShiftSheetForMonth_/g) || []).length);
console.log('mustShiftSheetForStore_', (s.match(/mustShiftSheetForStore_/g) || []).length);
