/** 破損直前ビルドから復元候補（日本語を含む文字列）を抽出 */
const fs = require('fs');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');

const isNonAscii = (ch) => ch.charCodeAt(0) > 127;
const STOP = new Set(['`', "'", '"', '<', '>', '$', '{', '}', '\\', '\n', '\r']);

const set = new Set();
for (let i = 0; i < bundle.length; i++) {
  if (!isNonAscii(bundle[i])) continue;
  // 1) 非ASCIIの極大連続
  let j = i;
  while (j < bundle.length && isNonAscii(bundle[j])) j++;
  set.add(bundle.slice(i, j));
  // 2) そこから ASCII を挟んで次の日本語まで伸ばした区間（複数長で登録）
  let k = j;
  let guard = 0;
  while (k < bundle.length && guard < 6) {
    let a = k;
    while (a < bundle.length && !isNonAscii(bundle[a]) && !STOP.has(bundle[a])) a++;
    if (a >= bundle.length || !isNonAscii(bundle[a])) break;
    let b = a;
    while (b < bundle.length && isNonAscii(bundle[b])) b++;
    set.add(bundle.slice(i, b));
    k = b;
    guard++;
  }
  i = j - 1;
}

const cands = [...set].filter((s) => s.length <= 200);
cands.sort((a, b) => b.length - a.length);
fs.writeFileSync('.restore/cands.json', JSON.stringify(cands), 'utf8');
console.log('candidates', cands.length);
