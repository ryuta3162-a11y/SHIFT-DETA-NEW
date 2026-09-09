/** 確実な一致（曖昧でないもの）を使って、ソース順とバンドル順が一致するか検証 */
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

const anchors = [];
for (let i = 0; i < src.length; i++) {
  if (src[i] !== '?') continue;
  let j = i;
  while (src[j] === '?') j++;
  const list = byPrefix.get(src.substr(i, 3)) || [];
  const ms = list.filter(([, p]) => p.length >= j - i && src.startsWith(p, i));
  if (ms.length) {
    const maxLen = ms[0][1].length;
    const top = ms.filter((m) => m[1].length === maxLen);
    const uniq = [...new Set(top.map((m) => m[0]))];
    if (uniq.length === 1 && uniq[0].replace(/[\x00-\x7F]/g, '').length >= 4) {
      const bpos = bundle.indexOf(uniq[0].replace(/[\x00-\x7F]*$/, ''));
      const cnt = uniq[0].length;
      anchors.push({ srcPos: i, bundlePos: bpos, text: uniq[0], len: cnt });
    }
  }
  i = j - 1;
}
let inc = 0, dec = 0;
for (let k = 1; k < anchors.length; k++) {
  if (anchors[k].bundlePos > anchors[k - 1].bundlePos) inc++;
  else dec++;
}
console.log('anchors', anchors.length, 'increasing', inc, 'decreasing', dec);
console.log('first', anchors.slice(0, 3).map((a) => `${a.srcPos}->${a.bundlePos}`).join(' '));
console.log('last', anchors.slice(-3).map((a) => `${a.srcPos}->${a.bundlePos}`).join(' '));
fs.writeFileSync('.restore/anchors.json', JSON.stringify(anchors, null, 1), 'utf8');
