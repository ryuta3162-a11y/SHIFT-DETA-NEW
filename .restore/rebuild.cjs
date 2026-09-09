/**
 * 破損した App.jsx の日本語を、ビルド済みバンドル（破損直前のビルド）から順番に復元する。
 * - バンドル内の App.jsx 区間の「非ASCII連続」を正解列として使う
 * - 破損側は '?' を含むクラスタを順番に置き換える
 * - コメント内のクラスタはバンドルに存在しないので飛ばす
 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'utf8');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');

// ---- バンドル側: App.jsx 区間の非ASCII連続を取り出す ----
const appStartAnchor = 208270; // WEEKDAY_LABELS 付近から App.jsx 区間
const bundleRuns = [];
{
  const re = /[^\x00-\x7F]+/g;
  re.lastIndex = appStartAnchor;
  let m;
  while ((m = re.exec(bundle))) bundleRuns.push({ index: m.index, text: m[0] });
}

// ---- 破損側: クラスタを列挙（状態付き） ----
const CLUSTER = /\?+(?:[A-Za-z0-9]\?+)*/g;

function scan(text) {
  // 位置 -> 状態（code/sq/dq/tpl/line/block）のマップを作る
  const state = new Array(text.length).fill('code');
  let st = 'code';
  const tplStack = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    state[i] = st;
    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; state[i] = 'line'; state[i + 1] = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { st = 'block'; state[i] = 'block'; state[i + 1] = 'block'; i += 2; continue; }
      if (c === "'") { st = 'sq'; i++; continue; }
      if (c === '"') { st = 'dq'; i++; continue; }
      if (c === '`') { st = 'tpl'; i++; continue; }
      if (c === '}' && tplStack.length) { st = 'tpl'; tplStack.pop(); i++; continue; }
    } else if (st === 'line') {
      if (c === '\n') { st = 'code'; i++; continue; }
    } else if (st === 'block') {
      if (c === '*' && n === '/') { state[i + 1] = 'block'; st = 'code'; i += 2; continue; }
    } else if (st === 'sq' || st === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((st === 'sq' && c === "'") || (st === 'dq' && c === '"')) { st = 'code'; i++; continue; }
    } else if (st === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { st = 'code'; i++; continue; }
      if (c === '$' && n === '{') { tplStack.push(1); st = 'code'; i += 2; continue; }
    }
    i++;
  }
  return state;
}

const state = scan(src);
const clusters = [];
let m;
while ((m = CLUSTER.exec(src))) {
  const start = m.index;
  const text = m[0];
  // 三項演算子など、単独の ? は対象外（前後に空白がある 1 文字）
  if (text === '?' && (src[start - 1] === ' ' || src[start - 1] === '\n') && src[start + 1] === ' ') continue;
  clusters.push({ start, end: start + text.length, text, state: state[start] });
}

const comment = (s) => s === 'line' || s === 'block';
const target = clusters.filter((c) => !comment(c.state));

console.log('bundle runs (App区間)', bundleRuns.length);
console.log('clusters total', clusters.length, ' 対象', target.length, ' コメント', clusters.length - target.length);

// ---- 先頭 30 件を並べて突き合わせ確認 ----
const preview = Number(process.argv[2] || 30);
for (let k = 0; k < preview; k++) {
  const c = target[k];
  const b = bundleRuns[k];
  if (!c || !b) break;
  const ctx = src.slice(Math.max(0, c.start - 45), c.start).replace(/\n/g, '\\n');
  const after = src.slice(c.end, c.end + 18).replace(/\n/g, '\\n');
  console.log(`${String(k).padStart(4)} [${c.state}] ...${ctx}«${c.text}»${after}  =>  ${JSON.stringify(b.text)}`);
}
