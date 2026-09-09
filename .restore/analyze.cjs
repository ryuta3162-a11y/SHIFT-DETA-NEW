/* 破損した App.jsx の '?' 連続と、ビルド済みバンドルの非ASCII連続を突き合わせる下準備 */
const fs = require('fs');

const src = fs.readFileSync('.restore/App.damaged.jsx', 'utf8');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');

function classifySource(text) {
  const runs = [];
  let state = 'code';
  const tplStack = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'sq'; i++; continue; }
      if (c === '"') { state = 'dq'; i++; continue; }
      if (c === '`') { state = 'tpl'; i++; continue; }
      if (c === '}' && tplStack.length) { state = 'tpl'; tplStack.pop(); i++; continue; }
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue; }
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
    } else if (state === 'sq' || state === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) { state = 'code'; i++; continue; }
    } else if (state === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { state = 'code'; i++; continue; }
      if (c === '$' && n === '{') { tplStack.push(1); state = 'code'; i += 2; continue; }
    }

    if (c === '?') {
      let j = i;
      while (j < text.length && text[j] === '?') j++;
      // 三項演算子の ? は 1 文字で前後に空白がある事が多い。破損は連続 or 日本語位置
      runs.push({ start: i, len: j - i, state });
      i = j;
      continue;
    }
    i++;
  }
  return runs;
}

const runs = classifySource(src);
const byState = {};
runs.forEach((r) => {
  byState[r.state] = byState[r.state] || { count: 0, chars: 0 };
  byState[r.state].count++;
  byState[r.state].chars += r.len;
});
console.log('runs by state:', JSON.stringify(byState, null, 1));

const bundleRuns = [];
{
  const re = /[^\x00-\x7F]+/g;
  let m;
  while ((m = re.exec(bundle))) bundleRuns.push({ start: m.index, text: m[0], len: m[0].length });
}
console.log('bundle runs:', bundleRuns.length);
fs.writeFileSync('.restore/source-runs.json', JSON.stringify(runs));
fs.writeFileSync('.restore/bundle-runs.json', JSON.stringify(bundleRuns));

// 参考: 状態ごとのサンプル
['code', 'sq', 'dq', 'tpl', 'line', 'block'].forEach((st) => {
  const sample = runs.filter((r) => r.state === st).slice(0, 3);
  sample.forEach((r) => {
    const line = src.slice(Math.max(0, r.start - 60), r.start + r.len + 30).replace(/\n/g, '\\n');
    console.log(`[${st}] len=${r.len} ...${line}...`);
  });
});
