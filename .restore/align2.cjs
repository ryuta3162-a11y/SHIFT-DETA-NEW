/**
 * 破損パターン一致 + 周辺コード文脈スコアで復元する。
 * - コメント内は対象外（バンドルに無いため）
 * - 一意に決まらない場合は、バンドル側の同じ文字列の周辺に
 *   ソース側と同じ識別子・プロパティ名が出るかで判定する
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

const byPrefix = new Map();
for (const [orig, pat] of pats) {
  const k = pat.slice(0, 3);
  if (!byPrefix.has(k)) byPrefix.set(k, []);
  byPrefix.get(k).push([orig, pat]);
}
for (const l of byPrefix.values()) l.sort((a, b) => b[1].length - a[1].length);

// コメント判定
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

// バンドル内トークン頻度
const tokenFreq = new Map();
for (const m of bundle.matchAll(/[A-Za-z_][A-Za-z0-9_-]{3,}/g)) {
  tokenFreq.set(m[0], (tokenFreq.get(m[0]) || 0) + 1);
}
// 候補テキストのバンドル内出現位置
const occCache = new Map();
function occurrences(text) {
  if (occCache.has(text)) return occCache.get(text);
  const list = [];
  let idx = -1;
  while ((idx = bundle.indexOf(text, idx + 1)) >= 0) { list.push(idx); if (list.length > 40) break; }
  occCache.set(text, list);
  return list;
}

function srcTokens(pos) {
  const win = src.slice(Math.max(0, pos - 260), pos + 260);
  const set = new Map();
  for (const m of win.matchAll(/[A-Za-z_][A-Za-z0-9_-]{3,}/g)) {
    const f = tokenFreq.get(m[0]) || 0;
    if (!f || f > 400) continue;
    set.set(m[0], 1 / Math.log2(2 + f));
  }
  return set;
}

function scoreCandidate(text, tokens) {
  let best = 0;
  for (const p of occurrences(text)) {
    const win = bundle.slice(Math.max(0, p - 500), p + 500);
    let s = 0;
    for (const [tok, w] of tokens) if (win.includes(tok)) s += w;
    if (s > best) best = s;
  }
  return best;
}

let out = '';
let i = 0;
const stats = { unique: 0, ctx: 0, pending: 0, comment: 0 };
const pending = [];
const decisions = [];
while (i < src.length) {
  if (src[i] !== '?') { out += src[i]; i++; continue; }
  let j = i;
  while (src[j] === '?') j++;
  const clen = j - i;
  if (isComment[i]) { stats.comment++; out += src.slice(i, j); i = j; continue; }

  const list = byPrefix.get(src.substr(i, 3)) || [];
  const ms = list.filter(([, p]) => p.length >= clen && src.startsWith(p, i));
  if (!ms.length) {
    // 演算子など
    out += src.slice(i, j);
    i = j;
    continue;
  }
  // 長さで足切りせず、全一致候補を文脈スコアで比較する
  const uniqMap = new Map();
  for (const [orig, pat] of ms) {
    const prev = uniqMap.get(orig);
    if (!prev || pat.length > prev.length) uniqMap.set(orig, pat);
  }
  const uniq = [...uniqMap.keys()];
  if (uniq.length === 1) {
    stats.unique++;
    decisions.push({ pos: i, text: uniq[0], how: 'unique' });
    out += uniq[0];
    i += uniqMap.get(uniq[0]).length;
    continue;
  }
  const tokens = srcTokens(i);
  const base = (t) => t.replace(/[\x00-\x7F]+$/, '');
  const scored = uniq
    .map((t) => [t, scoreCandidate(base(t), tokens)])
    .sort((a, b) => (b[1] - a[1]) || (uniqMap.get(b[0]).length - uniqMap.get(a[0]).length));
  const bestScore = scored[0][1];
  const sameTop = scored.filter((s) => s[1] === bestScore);
  const distinctBase = new Set(sameTop.map((s) => base(s[0])));
  if (bestScore >= 1.0 && (distinctBase.size === 1 || bestScore >= scored.find((s) => base(s[0]) !== base(scored[0][0]))?.[1] * 1.4)) {
    const pick = sameTop.sort((a, b) => uniqMap.get(b[0]).length - uniqMap.get(a[0]).length)[0][0];
    stats.ctx++;
    decisions.push({ pos: i, text: pick, how: 'ctx', score: Number(bestScore.toFixed(2)) });
    out += pick;
    i += uniqMap.get(pick).length;
    continue;
  }
  stats.pending++;
  pending.push({
    pos: i,
    len: clen,
    cands: scored.slice(0, 8).map(([t, s]) => `${t}(${s.toFixed(1)})`),
    ctx: src.slice(Math.max(0, i - 80), j + 50).replace(/\n/g, '\\n'),
  });
  out += src.slice(i, j);
  i = j;
}

fs.writeFileSync('.restore/App.ctx.jsx', out, 'utf8');
fs.writeFileSync('.restore/pending2.txt', pending.map((p) => `pos=${p.pos} len=${p.len}\n  cands: ${p.cands.join(' | ')}\n  ctx: ${p.ctx}`).join('\n'), 'utf8');
fs.writeFileSync('.restore/decisions.json', JSON.stringify(decisions, null, 1), 'utf8');
console.log(JSON.stringify(stats), 'remaining ?', (out.match(/\?/g) || []).length);
