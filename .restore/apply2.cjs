/** 前後1文字を含むパターンのうち、ファイル内で「一意に一度だけ」出現するものだけを安全に置換 */
const fs = require('fs');

let text = fs.readFileSync('.restore/App.fixed.jsx', 'utf8');
const lines = fs.readFileSync('.restore/patterns2.txt', 'utf8').split('\n');

const entries = [];
for (const line of lines) {
  if (!line) continue;
  const [o, d] = line.split('\t');
  const orig = Buffer.from(o, 'base64').toString('utf8');
  const pat = Buffer.from(d, 'base64').toString('latin1');
  if (!/\?/.test(pat)) continue;
  entries.push([orig, pat]);
}
entries.sort((a, b) => b[1].length - a[1].length);
console.log('patterns', entries.length);

let applied = 0;
for (const [orig, pat] of entries) {
  if (!text.includes('?')) break;
  let idx = text.indexOf(pat);
  if (idx < 0) continue;
  if (text.indexOf(pat, idx + 1) >= 0) continue; // 一意でないものは触らない
  text = text.slice(0, idx) + orig + text.slice(idx + pat.length);
  applied++;
}
fs.writeFileSync('.restore/App.fixed2.jsx', text, 'utf8');
console.log('applied', applied, 'remaining ?', (text.match(/\?/g) || []).length);
