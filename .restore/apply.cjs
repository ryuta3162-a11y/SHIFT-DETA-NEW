/** 破損パターン辞書で App.jsx を復元する */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'latin1');
const pats = JSON.parse(fs.readFileSync('.restore/patterns.json', 'utf8'));

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
const leftovers = [];
while (i < src.length) {
  if (src[i] !== '?') { out += src[i]; i++; continue; }
  const list = byPrefix.get(src.substr(i, 3)) || [];
  let best = null;
  for (const [orig, pat] of list) {
    if (src.startsWith(pat, i)) { best = [orig, pat]; break; }
  }
  if (best) {
    out += best[0];
    i += best[1].length;
    hits++;
    continue;
  }
  // 未復元
  let j = i;
  while (src[j] === '?') j++;
  leftovers.push({ pos: i, len: j - i, ctx: src.slice(Math.max(0, i - 60), j + 30) });
  out += src.slice(i, j);
  i = j;
}

fs.writeFileSync('.restore/App.fixed.jsx', out, 'utf8');
const remaining = (out.match(/\?/g) || []).length;
fs.writeFileSync(
  '.restore/leftovers.txt',
  leftovers.map((l) => `pos=${l.pos} len=${l.len}\n  ${l.ctx.replace(/\n/g, '\\n')}`).join('\n'),
  'utf8'
);
console.log('replaced', hits, 'leftover clusters', leftovers.length, 'remaining ? chars', remaining);
