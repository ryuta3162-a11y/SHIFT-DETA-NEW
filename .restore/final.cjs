/**
 * 最終復元: 構造整列 → 一意一致 → 文脈スコア の優先順で適用し、
 * 残りは remaining.txt に候補付きで書き出す。
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const rawBundle = fs.readFileSync('.restore/bundle.html', 'utf8');
const bundleJs = [...rawBundle.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .sort((a, b) => b.length - a.length)[0];
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

const patsOf = new Map();
const byPrefix = new Map();
for (const [orig, pat] of pats) {
  if (!patsOf.has(orig)) patsOf.set(orig, []);
  patsOf.get(orig).push(pat);
  const k = pat.slice(0, 3);
  if (!byPrefix.has(k)) byPrefix.set(k, []);
  byPrefix.get(k).push([orig, pat]);
}
for (const l of patsOf.values()) l.sort((a, b) => b.length - a.length);
for (const l of byPrefix.values()) l.sort((a, b) => b[1].length - a[1].length);

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
const mask = commentMask(src);

function simpleTokens(text, damaged) {
  const m2 = damaged ? mask : null;
  const toks = [];
  const re = damaged ? /[A-Za-z_$][A-Za-z0-9_$]{3,}|\?+/g : /[A-Za-z_$][A-Za-z0-9_$]{3,}|[^\x00-\x7F]+/g;
  let m;
  while ((m = re.exec(text))) {
    const s = m[0];
    const isJp = damaged ? s[0] === '?' : s.charCodeAt(0) > 127;
    if (damaged && m2[m.index]) continue;
    toks.push(isJp ? { key: 'JP', pos: m.index, len: s.length, text: damaged ? null : s } : { key: 'I:' + s, pos: m.index });
  }
  return toks;
}
const st1 = simpleTokens(src, true);
const st2 = simpleTokens(bundleJs, false);

function lcsAlign(A, B) {
  const N = A.length, M = B.length;
  const choice = new Int8Array((N + 1) * (M + 1));
  let prev = new Int32Array(M + 1), cur = new Int32Array(M + 1);
  for (let a = N - 1; a >= 0; a--) {
    const ka = A[a].key;
    for (let b = M - 1; b >= 0; b--) {
      const w = ka === B[b].key && ka !== 'JP' ? 3 : 0;
      let best = w ? prev[b + 1] + w : -1;
      let ch = w ? 3 : 0;
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
const anchors = lcsAlign(st1, st2);
const anchorA = anchors.map((p) => p[0]);
const anchorB = anchors.map((p) => p[1]);
const jpIdx = [];
st2.forEach((t, i) => { if (t.key === 'JP') jpIdx.push(i); });

function tryAssign(slotPos, slotLen, text) {
  const list = patsOf.get(text) || [];
  for (const p of list) {
    if (p.length < slotLen) continue;
    if (src.startsWith(p, slotPos)) return { patLen: p.length, text };
  }
  return null;
}

function expectedB(srcTokIdx) {
  let lo = 0, hi = anchorA.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (anchorA[mid] < srcTokIdx) lo = mid + 1; else hi = mid; }
  const before = lo > 0 ? anchorB[lo - 1] : 0;
  const after = lo < anchorB.length ? anchorB[lo] : st2.length;
  return [before, after];
}

// トークン位置 -> ソース位置の索引
const structPick = new Map();
const SLACK = 150;
st1.forEach((s, idx) => {
  if (s.key !== 'JP') return;
  const [b0, b1] = expectedB(idx);
  const lo = Math.max(0, b0 - SLACK), hi = Math.min(st2.length, b1 + SLACK);
  let hit = null;
  for (const bi of jpIdx) {
    if (bi < lo) continue;
    if (bi > hi) break;
    const r = tryAssign(s.pos, s.len, st2[bi].text);
    if (r && (!hit || r.patLen > hit.patLen)) hit = r;
  }
  if (hit) structPick.set(s.pos, hit);
});

// バンドル内トークン頻度（文脈スコア用）
const tokenFreq = new Map();
for (const m of bundleJs.matchAll(/[A-Za-z_][A-Za-z0-9_-]{3,}/g)) tokenFreq.set(m[0], (tokenFreq.get(m[0]) || 0) + 1);
const occCache = new Map();
function occurrences(text) {
  if (occCache.has(text)) return occCache.get(text);
  const list = [];
  let idx = -1;
  while ((idx = bundleJs.indexOf(text, idx + 1)) >= 0) { list.push(idx); if (list.length > 30) break; }
  occCache.set(text, list);
  return list;
}
function srcTokens(pos) {
  const win = src.slice(Math.max(0, pos - 240), pos + 240);
  const set = new Map();
  for (const m of win.matchAll(/[A-Za-z_][A-Za-z0-9_-]{3,}/g)) {
    const f = tokenFreq.get(m[0]) || 0;
    if (!f || f > 300) continue;
    set.set(m[0], 1 / Math.log2(2 + f));
  }
  return set;
}
function scoreCandidate(text, tokens) {
  let best = 0;
  for (const p of occurrences(text)) {
    const win = bundleJs.slice(Math.max(0, p - 450), p + 450);
    let s = 0;
    for (const [tok, w] of tokens) if (win.includes(tok)) s += w;
    if (s > best) best = s;
  }
  return best;
}

let out = '';
let i = 0;
const stats = { struct: 0, unique: 0, ctx: 0, manual: 0, comment: 0, operator: 0 };
const remaining = [];
while (i < src.length) {
  if (src[i] !== '?') { out += src[i]; i++; continue; }
  let j = i;
  while (src[j] === '?') j++;
  const clen = j - i;
  if (mask[i]) { stats.comment++; out += src.slice(i, j); i = j; continue; }

  const sp = structPick.get(i);
  if (sp) { stats.struct++; out += sp.text; i += sp.patLen; continue; }

  const list = byPrefix.get(src.substr(i, 3)) || [];
  const ms = list.filter(([, p]) => p.length >= clen && src.startsWith(p, i));
  if (!ms.length) { stats.operator++; out += src.slice(i, j); i = j; continue; }
  const uniqMap = new Map();
  for (const [orig, pat] of ms) {
    const prev = uniqMap.get(orig);
    if (!prev || pat.length > prev.length) uniqMap.set(orig, pat);
  }
  const base = (t) => t.replace(/[\x00-\x7F]+$/, '');
  const bases = new Set([...uniqMap.keys()].map(base));
  if (bases.size === 1) {
    const pick = [...uniqMap.keys()].sort((a, b) => uniqMap.get(b).length - uniqMap.get(a).length)[0];
    stats.unique++;
    out += pick;
    i += uniqMap.get(pick).length;
    continue;
  }
  const tokens = srcTokens(i);
  const scored = [...uniqMap.keys()].map((t) => [t, scoreCandidate(base(t), tokens)]).sort((a, b) => b[1] - a[1]);
  const top = scored[0];
  const runner = scored.find((s) => base(s[0]) !== base(top[0]));
  if (top[1] >= 1.5 && (!runner || top[1] >= runner[1] * 1.6)) {
    stats.ctx++;
    out += top[0];
    i += uniqMap.get(top[0]).length;
    continue;
  }
  // 5文字以上の長い日本語は、パターン一致だけでほぼ一意に決まるので採用する
  const longHit = [...uniqMap.keys()]
    .filter((t) => base(t).replace(/[\x00-\x7F]/g, '').length >= 5)
    .sort((a, b) => uniqMap.get(b).length - uniqMap.get(a).length)[0];
  if (longHit && new Set([...uniqMap.keys()].filter((t) => base(t).replace(/[\x00-\x7F]/g, '').length >= 5).map(base)).size === 1) {
    stats.long = (stats.long || 0) + 1;
    out += longHit;
    i += uniqMap.get(longHit).length;
    continue;
  }
  stats.manual++;
  remaining.push({
    pos: i,
    len: clen,
    cands: scored.slice(0, 6).map(([t, s]) => `${JSON.stringify(t)}(${s.toFixed(1)})`),
    ctx: src.slice(Math.max(0, i - 90), j + 60).replace(/\n/g, '\\n'),
  });
  out += src.slice(i, j);
  i = j;
}

fs.writeFileSync('.restore/App.final.jsx', out, 'utf8');
fs.writeFileSync('.restore/remaining.txt', remaining.map((r) => `pos=${r.pos} len=${r.len}\n  cands: ${r.cands.join(' | ')}\n  ctx: ${r.ctx}`).join('\n'), 'utf8');
console.log(JSON.stringify(stats), 'remaining ?', (out.match(/\?/g) || []).length);
