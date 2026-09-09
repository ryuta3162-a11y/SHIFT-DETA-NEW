/**
 * 出現順（バンドル）× 破損パターン一致 の DP で復元する。
 * コメント内は対象外。
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

const patsOf = new Map();
for (const [orig, pat] of pats) {
  if (!patsOf.has(orig)) patsOf.set(orig, []);
  patsOf.get(orig).push(pat);
}
for (const list of patsOf.values()) list.sort((a, b) => b.length - a.length);

// ---- コメント判定 ----
const isComment = new Uint8Array(src.length);
{
  let st = 'code', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; isComment[i] = isComment[i + 1] = 1; i += 2; continue; }
      if (c === '/' && n === '*') { st = 'block'; isComment[i] = isComment[i + 1] = 1; i += 2; continue; }
      if (c === "'") { st = 'sq'; i++; continue; }
      if (c === '"') { st = 'dq'; i++; continue; }
      if (c === '`') { st = 'tpl'; i++; continue; }
    } else if (st === 'line') { if (c === '\n') { st = 'code'; i++; continue; } isComment[i] = 1; }
    else if (st === 'block') { isComment[i] = 1; if (c === '*' && n === '/') { isComment[i + 1] = 1; st = 'code'; i += 2; continue; } }
    else if (st === 'sq' || st === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((st === 'sq' && c === "'") || (st === 'dq' && c === '"') || c === '\n') { st = 'code'; i++; continue; }
    } else if (st === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { st = 'code'; i++; continue; }
    }
    i++;
  }
}

// ---- 破損スロット（コメント外の ? クラスタ）----
const slots = [];
for (let i = 0; i < src.length; i++) {
  if (src[i] !== '?') continue;
  let j = i;
  while (src[j] === '?') j++;
  if (!isComment[i]) slots.push({ start: i, end: j, len: j - i });
  i = j - 1;
}

// ---- バンドル側: 非ASCII連続の出現（順番）と候補テキスト ----
const isNonAscii = (ch) => ch.charCodeAt(0) > 127;
const STOP = new Set(['`', "'", '"', '<', '>', '$', '{', '}', '\\', '\n', '\r']);
const occ = [];
for (let i = 0; i < bundle.length; i++) {
  if (!isNonAscii(bundle[i])) continue;
  let j = i;
  while (j < bundle.length && isNonAscii(bundle[j])) j++;
  const texts = [bundle.slice(i, j)];
  let k = j, guard = 0;
  while (k < bundle.length && guard < 6) {
    let a = k;
    while (a < bundle.length && !isNonAscii(bundle[a]) && !STOP.has(bundle[a])) a++;
    if (a >= bundle.length || !isNonAscii(bundle[a])) break;
    let b = a;
    while (b < bundle.length && isNonAscii(bundle[b])) b++;
    texts.push(bundle.slice(i, b));
    k = b; guard++;
  }
  occ.push({ pos: i, texts: texts.filter((t) => t.length <= 200) });
  i = j - 1;
}

console.log('slots', slots.length, 'bundle occurrences', occ.length);

// ---- 互換表: slot × occ -> 最長一致パターン ----
const slotIndexByStart = new Map();
slots.forEach((s, idx) => slotIndexByStart.set(s.start, idx));

function bestMatch(slotIdx, occIdx) {
  const s = slots[slotIdx];
  let best = null;
  for (const t of occ[occIdx].texts) {
    const list = patsOf.get(t);
    if (!list) continue;
    for (const p of list) {
      if (p.length < s.len) continue;
      if (!src.startsWith(p, s.start)) continue;
      if (!best || p.length > best.pat.length) best = { text: t, pat: p };
      break; // list は長い順
    }
  }
  return best;
}

const N = slots.length, M = occ.length;
const cache = new Map();
function mk(a, b) { return a * (M + 1) + b; }
function getBest(a, b) {
  const k = mk(a, b);
  if (cache.has(k)) return cache.get(k);
  const v = bestMatch(a, b);
  cache.set(k, v);
  return v;
}

// 次スロット計算
function nextSlotAfter(a, endPos) {
  let x = a;
  while (x < N && slots[x].start < endPos) x++;
  return x;
}

const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
const choice = Array.from({ length: N + 1 }, () => new Int8Array(M + 1));
for (let a = N - 1; a >= 0; a--) {
  for (let b = M - 1; b >= 0; b--) {
    let best = dp[a + 1][b];
    let ch = 1; // slot をスキップ
    if (dp[a][b + 1] > best) { best = dp[a][b + 1]; ch = 2; }
    const m = getBest(a, b);
    if (m) {
      const na = nextSlotAfter(a, slots[a].start + m.pat.length);
      const val = (na - a) * 10 + dp[na][b + 1];
      if (val > best) { best = val; ch = 3; }
    }
    dp[a][b] = best;
    choice[a][b] = ch;
  }
}

// ---- 復元 ----
const applied = [];
{
  let a = 0, b = 0;
  while (a < N && b < M) {
    const ch = choice[a][b];
    if (ch === 3) {
      const m = getBest(a, b);
      applied.push({ start: slots[a].start, pat: m.pat, text: m.text });
      a = nextSlotAfter(a, slots[a].start + m.pat.length);
      b++;
    } else if (ch === 1) a++;
    else b++;
  }
}

let out = '';
let cursor = 0;
for (const ap of applied) {
  out += src.slice(cursor, ap.start) + ap.text;
  cursor = ap.start + ap.pat.length;
}
out += src.slice(cursor);

fs.writeFileSync('.restore/App.aligned.jsx', out, 'utf8');
const rest = (out.match(/\?/g) || []).length;
console.log('applied', applied.length, 'remaining ?', rest);
