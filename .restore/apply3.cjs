/**
 * 安全版の復元:
 *  - コメント内は自動置換しない（バンドルに存在しないため必ず誤る）
 *  - クラスタ全体を覆う最長一致のみ採用
 *  - 同じ長さで別解が存在する（曖昧な）箇所は置換せず保留
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

// ---- コメント範囲を求める ----
const isComment = new Uint8Array(src.length);
{
  let st = 'code';
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; isComment[i] = isComment[i + 1] = 1; i += 2; continue; }
      if (c === '/' && n === '*') { st = 'block'; isComment[i] = isComment[i + 1] = 1; i += 2; continue; }
      if (c === "'") { st = 'sq'; i++; continue; }
      if (c === '"') { st = 'dq'; i++; continue; }
      if (c === '`') { st = 'tpl'; i++; continue; }
    } else if (st === 'line') {
      if (c === '\n') { st = 'code'; i++; continue; }
      isComment[i] = 1;
    } else if (st === 'block') {
      isComment[i] = 1;
      if (c === '*' && n === '/') { isComment[i + 1] = 1; st = 'code'; i += 2; continue; }
    } else if (st === 'sq' || st === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((st === 'sq' && c === "'") || (st === 'dq' && c === '"') || c === '\n') { st = 'code'; i++; continue; }
    } else if (st === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { st = 'code'; i++; continue; }
    }
    i++;
  }
}

const byPrefix = new Map();
for (const [orig, pat] of pats) {
  const key = pat.slice(0, 3);
  if (!byPrefix.has(key)) byPrefix.set(key, []);
  byPrefix.get(key).push([orig, pat]);
}
for (const list of byPrefix.values()) list.sort((a, b) => b[1].length - a[1].length);

let out = '';
let i = 0;
let hits = 0;
const pending = [];
while (i < src.length) {
  if (src[i] !== '?') { out += src[i]; i++; continue; }
  let j = i;
  while (src[j] === '?') j++;
  const clusterLen = j - i;

  if (isComment[i]) {
    pending.push({ pos: i, len: clusterLen, kind: 'comment' });
    out += src.slice(i, j);
    i = j;
    continue;
  }

  const list = byPrefix.get(src.substr(i, 3)) || [];
  const matches = [];
  for (const [orig, pat] of list) {
    if (!src.startsWith(pat, i)) continue;
    // クラスタ全体を覆っているか
    if (pat.length < clusterLen) continue;
    matches.push([orig, pat]);
  }
  if (matches.length) {
    const maxLen = matches[0][1].length;
    const top = matches.filter((m) => m[1].length === maxLen);
    const uniq = new Set(top.map((m) => m[0]));
    if (uniq.size === 1) {
      out += top[0][0];
      i += maxLen;
      hits++;
      continue;
    }
    pending.push({ pos: i, len: clusterLen, kind: 'ambiguous', cands: [...uniq].slice(0, 6) });
  } else {
    pending.push({ pos: i, len: clusterLen, kind: 'nomatch' });
  }
  out += src.slice(i, j);
  i = j;
}

fs.writeFileSync('.restore/App.safe.jsx', out, 'utf8');
const kinds = pending.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});
fs.writeFileSync(
  '.restore/pending.json',
  JSON.stringify(pending.map((p) => ({ ...p, ctx: src.slice(Math.max(0, p.pos - 70), p.pos + p.len + 40) })), null, 1),
  'utf8'
);
console.log('replaced', hits, 'pending', pending.length, JSON.stringify(kinds));
