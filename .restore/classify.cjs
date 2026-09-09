const fs = require('fs');
const t = fs.readFileSync('.restore/App.fixed.jsx', 'utf8');
let op = 0;
const real = [];
for (let i = 0; i < t.length; i++) {
  if (t[i] !== '?') continue;
  let j = i;
  while (t[j] === '?') j++;
  const len = j - i;
  const before = t[i - 1];
  const after = t[j];
  const isOptional = len === 1 && after === '.';
  const isTernary = len === 1 && before === ' ' && (after === ' ' || after === '\n');
  const isNullish = len === 2 && (before === ' ' || after === ' ');
  if (isOptional || isTernary || isNullish) op++;
  else real.push({ pos: i, len, ctx: t.slice(Math.max(0, i - 70), j + 40).replace(/\n/g, '\\n') });
  i = j - 1;
}
fs.writeFileSync('.restore/real.txt', real.map((r) => `pos=${r.pos} len=${r.len}\n  ${r.ctx}`).join('\n'), 'utf8');
console.log('operator-like', op, 'real damage clusters', real.length);
