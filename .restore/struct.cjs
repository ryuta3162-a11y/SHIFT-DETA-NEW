/**
 * 繧ｽ繝ｼ繧ｹ(遐ｴ謳・縺ｨ繝舌Φ繝峨Ν(豁｣蟶ｸ)繧偵ヨ繝ｼ繧ｯ繝ｳ蛻励↓縺励※讒矩逧・↓謨ｴ蛻励＠縲・
 * 譌･譛ｬ隱槭せ繝ｭ繝・ヨ繧貞ｯｾ蠢懊☆繧九ヰ繝ｳ繝峨Ν縺ｮ譌･譛ｬ隱槭↓謌ｻ縺吶・
 * 鄂ｮ謠帙・蠢・★縲檎ｴ謳阪ヱ繧ｿ繝ｼ繝ｳ荳閾ｴ縲阪〒讀懆ｨｼ縺励※縺九ｉ陦後≧縲・
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const rawBundle = fs.readFileSync('.restore/bundle.html', 'utf8');
// HTML 縺九ｉ <script> 縺ｮ荳ｭ霄ｫ・・S・峨□縺代ｒ蜿悶ｊ蜃ｺ縺・
const bundle = (() => {
  const parts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(rawBundle))) parts.push(m[1]);
  const js = parts.sort((a, b) => b.length - a.length)[0] || rawBundle;
  return js;
})();
console.log('bundle js chars', bundle.length, '/ html', rawBundle.length);
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

const patsOf = new Map();
for (const [orig, pat] of pats) {
  if (!patsOf.has(orig)) patsOf.set(orig, []);
  patsOf.get(orig).push(pat);
}
for (const l of patsOf.values()) l.sort((a, b) => b.length - a.length);

// ---------- 蜊倡ｴ斐ヨ繝ｼ繧ｯ繝翫う繧ｺ・郁ｭ伜挨蟄舌→譌･譛ｬ隱槭せ繝ｭ繝・ヨ縺ｮ縺ｿ・・---------
function commentMask(text) {
  const mask = new Uint8Array(text.length);
  let st = 'code', i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; mask[i] = mask[i + 1] = 1; i += 2; continue; }
      if (c === '/' && n === '*') { st = 'block'; mask[i] = mask[i + 1] = 1; i += 2; continue; }
      if (c === "'") { st = 'sq'; i++; continue; }
      if (c === '"') { st = 'dq'; i++; continue; }
      if (c === '`') { st = 'tpl'; i++; continue; }
    } else if (st === 'line') { if (c === '\n') { st = 'code'; i++; continue; } mask[i] = 1; }
    else if (st === 'block') { mask[i] = 1; if (c === '*' && n === '/') { mask[i + 1] = 1; st = 'code'; i += 2; continue; } }
    else if (st === 'sq' || st === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((st === 'sq' && c === "'") || (st === 'dq' && c === '"') || c === '\n') { st = 'code'; i++; continue; }
    } else if (st === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`' || c === '\n') { st = 'code'; i++; continue; }
    }
    i++;
  }
  return mask;
}

function simpleTokens(text, { damaged }) {
  const mask = damaged ? commentMask(text) : null;
  const toks = [];
  const re = damaged
    ? /[A-Za-z_$][A-Za-z0-9_$]{3,}|\?+/g
    : /[A-Za-z_$][A-Za-z0-9_$]{3,}|[^\x00-\x7F]+/g;
  let m;
  while ((m = re.exec(text))) {
    const s = m[0];
    if (damaged && s[0] === '?') {
      if (mask[m.index]) continue;
      toks.push({ key: 'JP', pos: m.index, len: s.length });
    } else if (!damaged && s.charCodeAt(0) > 127) {
      toks.push({ key: 'JP', pos: m.index, text: s });
    } else {
      if (damaged && mask[m.index]) continue;
      toks.push({ key: 'I:' + s, pos: m.index });
    }
  }
  return toks;
}

function tokenizeOld(text, { damaged }) {
  const toks = [];
  let i = 0;
  let st = 'code';
  const push = (key, extra) => toks.push({ key, ...extra });
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (st === 'code') {
      if (c === '/' && n === '/') { const e = text.indexOf('\n', i); i = e < 0 ? text.length : e; continue; }
      if (c === '/' && n === '*') { const e = text.indexOf('*/', i); i = e < 0 ? text.length : e + 2; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j++;
        const w = text.slice(i, j);
        if (w.length >= 4) push('I:' + w);
        i = j;
        continue;
      }
      if (c === '?' && damaged) {
        // 繧ｳ繝ｼ繝臥峩荳具ｼ・SX繝・く繧ｹ繝育ｭ会ｼ峨・遐ｴ謳・
        let j = i;
        while (text[j] === '?') j++;
        push('JP', { pos: i, len: j - i });
        i = j;
        continue;
      }
      if (!damaged && c.charCodeAt(0) > 127) {
        let j = i;
        while (j < text.length && text[j].charCodeAt(0) > 127) j++;
        push('JP', { pos: i, text: text.slice(i, j) });
        i = j;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { st = c; i++; push('Q'); continue; }
      i++;
      continue;
    }
    // 譁・ｭ怜・蜀・
    const quote = st;
    let buf = '';
    let jp = null;
    while (i < text.length) {
      const c2 = text[i];
      if (c2 === '\\') { buf += text.substr(i, 2); i += 2; continue; }
      if (c2 === quote) { i++; st = 'code'; break; }
      if (quote !== '`' && c2 === '\n') { st = 'code'; break; }
      if (quote === '`' && c2 === '$' && text[i + 1] === '{') {
        if (buf.trim()) push('S:' + buf.trim());
        buf = '';
        // ${...} 蜀・・繧ｳ繝ｼ繝峨→縺励※謇ｱ縺・ｼ育ｰ｡譏・ 蟇ｾ蠢懊☆繧・} 縺ｾ縺ｧ蜀榊ｸｰ縺帙★繝医・繧ｯ繝ｳ蛹厄ｼ・
        let depth = 1, j = i + 2;
        const start = j;
        while (j < text.length && depth > 0) {
          const cj = text[j];
          if (cj === '{') depth++;
          else if (cj === '}') depth--;
          j++;
        }
        const inner = text.slice(start, j - 1);
        for (const t of tokenize(inner, { damaged })) {
          if (t.pos != null) t.pos += start;
          push(t.key, t);
        }
        i = j;
        continue;
      }
      if (damaged && c2 === '?') {
        if (buf.trim()) push('S:' + buf.trim());
        buf = '';
        let j = i;
        while (text[j] === '?') j++;
        push('JP', { pos: i, len: j - i });
        i = j;
        continue;
      }
      if (!damaged && c2.charCodeAt(0) > 127) {
        if (buf.trim()) push('S:' + buf.trim());
        buf = '';
        let j = i;
        while (j < text.length && text[j].charCodeAt(0) > 127) j++;
        push('JP', { pos: i, text: text.slice(i, j) });
        i = j;
        continue;
      }
      buf += c2;
      i++;
    }
    if (buf.trim()) push('S:' + buf.trim());
  }
  return toks;
}

const st1 = simpleTokens(src, { damaged: true });
const st2 = simpleTokens(bundle, { damaged: false });
console.log('src tokens', st1.length, 'bundle tokens', st2.length);

// ---------- 蜈ｨ菴・LCS 縺ｧ謨ｴ蛻・----------
function lcsAlign(A, B) {
  const N = A.length, M = B.length;
  const choice = new Int8Array((N + 1) * (M + 1));
  let prev = new Int32Array(M + 1);
  let cur = new Int32Array(M + 1);
  for (let a = N - 1; a >= 0; a--) {
    const ka = A[a].key;
    const isJPa = ka === 'JP';
    for (let b = M - 1; b >= 0; b--) {
      const kb = B[b].key;
      let best, ch;
      const w = ka === kb ? (isJPa ? 1 : 3) : 0;
      if (w) { best = prev[b + 1] + w; ch = 3; }
      else { best = -1; ch = 0; }
      if (prev[b] >= best) { best = prev[b]; ch = 1; }
      if (cur[b + 1] > best) { best = cur[b + 1]; ch = 2; }
      cur[b] = best;
      choice[a * (M + 1) + b] = ch;
    }
    const t = prev; prev = cur; cur = t;
  }
  const out = [];
  let a = 0, b = 0;
  while (a < N && b < M) {
    const ch = choice[a * (M + 1) + b];
    if (ch === 3) { out.push([a, b]); a++; b++; }
    else if (ch === 1) a++;
    else b++;
  }
  return out;
}

function countKeys(toks) {
  const m = new Map();
  for (const t of toks) if (t.key !== 'JP' && t.key !== 'Q') m.set(t.key, (m.get(t.key) || 0) + 1);
  return m;
}
const c1 = countKeys(st1), c2 = countKeys(st2);
const pos2 = new Map();
st2.forEach((t, idx) => { if (c2.get(t.key) === 1) pos2.set(t.key, idx); });

const pairs = [];
st1.forEach((t, idx) => {
  if (t.key === 'JP' || t.key === 'Q') return;
  if (c1.get(t.key) !== 1) return;
  if (!pos2.has(t.key)) return;
  pairs.push([idx, pos2.get(t.key)]);
});
// 繝舌Φ繝峨Ν蛛ｴ繧ょ腰隱ｿ蠅怜刈縺ｫ縺ｪ繧九ｈ縺・↓ LIS
pairs.sort((a, b) => a[0] - b[0]);
const anchors = [];
{
  const tails = [], idxOfTail = [], prev = new Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    const v = pairs[i][1];
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < v) lo = mid + 1; else hi = mid; }
    tails[lo] = v; idxOfTail[lo] = i; prev[i] = lo > 0 ? idxOfTail[lo - 1] : -1;
  }
  let cur = idxOfTail.length ? idxOfTail[tails.length - 1] : -1;
  while (cur !== -1 && cur !== undefined) { anchors.push(pairs[cur]); cur = prev[cur]; }
  anchors.reverse();
}
console.log('unique pairs', pairs.length, 'monotone anchors', anchors.length);

// ---------- 繧｢繝ｳ繧ｫ繝ｼ蛹ｺ髢薙＃縺ｨ縺ｫ JP 繧ｹ繝ｭ繝・ヨ繧貞ｯｾ蠢應ｻ倥￠ ----------
const decisions = [];
let skipped = 0;
function tryAssign(slot, text) {
  const list = patsOf.get(text) || [];
  for (const p of list) {
    if (p.length < slot.len) continue;
    if (src.startsWith(p, slot.pos)) return { pos: slot.pos, patLen: p.length, text };
  }
  // 譛ｫ蟆ｾ縺ｫ ASCII 繧剃ｼｴ縺・呵｣懶ｼ・ext + tail・峨ｂ隧ｦ縺・
  for (const [orig, pat] of pats) {
    if (!orig.startsWith(text)) continue;
    if (orig.length > text.length + 1) continue;
    if (pat.length < slot.len) continue;
    if (src.startsWith(pat, slot.pos)) return { pos: slot.pos, patLen: pat.length, text: orig };
  }
  return null;
}

const aligned = lcsAlign(st1, st2).filter(([ai, bi]) => st1[ai].key !== 'JP' && st2[bi].key !== 'JP');
console.log('identifier anchors', aligned.length);

// アンカーから推定したバンドル位置の周辺で候補を探す
const SLACK = Number(process.env.SLACK || 60);
const anchorA = aligned.map((p) => p[0]);
const anchorB = aligned.map((p) => p[1]);
const jpIdx = [];
st2.forEach((t, idx) => { if (t.key === 'JP') jpIdx.push(idx); });
const used = new Set();

function expectedB(srcTokIdx) {
  let lo = 0, hi = anchorA.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (anchorA[mid] < srcTokIdx) lo = mid + 1; else hi = mid; }
  const before = lo > 0 ? anchorB[lo - 1] : 0;
  const after = lo < anchorB.length ? anchorB[lo] : st2.length;
  return [before, after];
}

st1.forEach((s, idx) => {
  if (s.key !== 'JP') return;
  const [b0, b1] = expectedB(idx);
  const lo = Math.max(0, b0 - SLACK);
  const hi = Math.min(st2.length, b1 + SLACK);
  let hit = null;
  for (const bi of jpIdx) {
    if (bi < lo) continue;
    if (bi > hi) break;
    if (used.has(bi)) continue;
    const r = tryAssign(s, st2[bi].text);
    if (r && (!hit || r.patLen > hit.r.patLen)) hit = { r, bi };
  }
  if (hit) { used.add(hit.bi); decisions.push(hit.r); }
  else skipped++;
});

// ---------- 驕ｩ逕ｨ ----------
decisions.sort((x, y) => x.pos - y.pos);
let out = '';
let cursor = 0;
let applied = 0;
for (const d of decisions) {
  if (d.pos < cursor) continue;
  out += src.slice(cursor, d.pos) + d.text;
  cursor = d.pos + d.patLen;
  applied++;
}
out += src.slice(cursor);
fs.writeFileSync('.restore/App.struct.jsx', out, 'utf8');
console.log('applied', applied, 'skipped slots', skipped, 'remaining ?', (out.match(/\?/g) || []).length);

