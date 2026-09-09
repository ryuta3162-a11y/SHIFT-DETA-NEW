const fs = require('fs');
const b = fs.readFileSync('.restore/App.damaged.jsx');
let nonAscii = 0, q = 0;
for (const x of b) { if (x > 127) nonAscii++; if (x === 0x3f) q++; }
// UTF-8 として妥当かどうか
const t = b.toString('utf8');
const bad = (t.match(/\uFFFD/g) || []).length;
const jp = (t.match(/[\u3000-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g) || []).length;
const lines = [];
lines.push(`bytes=${b.length} nonAscii=${nonAscii} '?'=${q} U+FFFD=${bad} jpChars=${jp}`);
// 破損箇所（U+FFFD の周辺）を最大 40 件
let idx = -1, n = 0;
while ((idx = t.indexOf('\uFFFD', idx + 1)) >= 0 && n < 40) {
  lines.push(`--- FFFD@${idx}: ${JSON.stringify(t.slice(Math.max(0, idx - 45), idx + 25))}`);
  n++;
}
fs.writeFileSync('.restore/bytes.txt', lines.join('\n'), 'utf8');
console.log(lines[0]);
