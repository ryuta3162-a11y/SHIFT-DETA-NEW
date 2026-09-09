/**
 * 破損 App.jsx の日本語を、破損直前ビルド（bundle.html）から復元する。
 *
 * 破損の性質（実測）:
 *  - 日本語1文字 -> '?' 1文字
 *  - 日本語の直後の ASCII 1文字が食われて別の英字（多くは 'E'）になることがある
 * これを利用し、「?の連続の長さ = 元の日本語の文字数」として
 * バンドル側の非ASCII連続（出現順）と DP で対応付ける。
 */
const fs = require('fs');

const SRC = '.restore/App.damaged.jsx';
const src = fs.readFileSync(SRC, 'utf8');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');
const APP_START = Number(process.env.APP_START || 208270);

// ---------- バンドル側 ----------
const runs = [];
{
  const re = /[^\x00-\x7F]+/g;
  re.lastIndex = APP_START;
  let m;
  while ((m = re.exec(bundle))) runs.push(m[0]);
}

// ---------- 破損側: 状態解析 ----------
function scanStates(text) {
  const state = new Array(text.length).fill('code');
  let st = 'code';
  const tpl = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    state[i] = st;
    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; state[i] = state[i + 1] = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { st = 'block'; state[i] = state[i + 1] = 'block'; i += 2; continue; }
      if (c === "'") { st = 'sq'; i++; continue; }
      if (c === '"') { st = 'dq'; i++; continue; }
      if (c === '`') { st = 'tpl'; i++; continue; }
      if (c === '}' && tpl.length) { st = 'tpl'; tpl.pop(); i++; continue; }
    } else if (st === 'line') {
      if (c === '\n') { st = 'code'; i++; continue; }
    } else if (st === 'block') {
      if (c === '*' && n === '/') { state[i + 1] = 'block'; st = 'code'; i += 2; continue; }
    } else if (st === 'sq' || st === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((st === 'sq' && c === "'") || (st === 'dq' && c === '"')) { st = 'code'; i++; continue; }
      if (c === '\n') { st = 'code'; i++; continue; } // 閉じ引用符が食われた場合の保険
    } else if (st === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { st = 'code'; i++; continue; }
      if (c === '$' && n === '{') { tpl.push(1); st = 'code'; i += 2; continue; }
    }
    i++;
  }
  return state;
}

const state = scanStates(src);

// ---------- 破損側: クラスタ抽出 ----------
const clusters = [];
{
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '?') { i++; continue; }
    let j = i;
    while (src[j] === '?') j++;
    const len = j - i;
    const st = state[i];
    const before = src[i - 1];
    const after = src[j];
    let keep = true;
    if (st === 'code' || st === 'line' || st === 'block') {
      // JS の演算子を除外: ?. / ?? / 三項
      if (st === 'code') {
        if (len === 1 && (after === '.' || after === ' ' || after === '\n')) keep = false;
        if (len === 2 && (after === ' ' || before === ' ')) keep = false; // ?? 演算子
        if (len === 1 && before === ' ' && (after === ' ' || after === '\n')) keep = false;
      }
    }
    if (keep) clusters.push({ start: i, end: j, len, state: st, comment: st === 'line' || st === 'block' });
    i = j;
  }
}

const targets = clusters.filter((c) => !c.comment);
console.log('bundle runs', runs.length, 'clusters', clusters.length, 'targets', targets.length);

// ---------- DP: 長さ一致で対応付け（両側スキップ可） ----------
const N = targets.length;
const M = runs.length;
const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
for (let a = N - 1; a >= 0; a--) {
  for (let b = M - 1; b >= 0; b--) {
    const match = targets[a].len === runs[b].length ? dp[a + 1][b + 1] + 1 : -1;
    dp[a][b] = Math.max(match, dp[a + 1][b], dp[a][b + 1]);
  }
}
const map = new Array(N).fill(null);
{
  let a = 0, b = 0;
  while (a < N && b < M) {
    if (targets[a].len === runs[b].length && dp[a][b] === dp[a + 1][b + 1] + 1) {
      map[a] = runs[b];
      a++; b++;
    } else if (dp[a + 1][b] >= dp[a][b + 1]) a++;
    else b++;
  }
}
const matched = map.filter(Boolean).length;
console.log('matched', matched, '/', N, ' (未対応', N - matched, ')');

// ---------- 置換 ----------
let out = '';
let cursor = 0;
const report = [];
for (let k = 0; k < N; k++) {
  const c = targets[k];
  const text = map[k];
  out += src.slice(cursor, c.start);
  if (!text) {
    out += c.len === 1 ? '?' : '?'.repeat(c.len);
    report.push({ pos: c.start, len: c.len, state: c.state, ctx: src.slice(Math.max(0, c.start - 50), c.end + 20) });
  } else {
    out += text;
    // 直後の英字1文字が引用符を食っている場合を戻す
    const nxt = src[c.end];
    if ((c.state === 'sq' || c.state === 'dq') && /[A-Za-z]/.test(nxt || '')) {
      const rest = src.slice(c.end + 1, src.indexOf('\n', c.end) < 0 ? undefined : src.indexOf('\n', c.end));
      const q = c.state === 'sq' ? "'" : '"';
      if (!rest.includes(q)) {
        out += q;
        cursor = c.end + 1;
        continue;
      }
    }
  }
  cursor = c.end;
}
out += src.slice(cursor);

fs.writeFileSync('.restore/App.runs.jsx', out);
fs.writeFileSync('.restore/report.txt', report.map((r) => `pos=${r.pos} len=${r.len} state=${r.state}\n  ${r.ctx.replace(/\n/g, '\\n')}`).join('\n'));
console.log('wrote .restore/App.runs.jsx / report.txt (未対応 ' + report.length + ' 件)');
