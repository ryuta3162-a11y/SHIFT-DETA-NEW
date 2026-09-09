/**
 * 破損した App.jsx を、8/6 コミット版（日本語が生きている）と行単位で突き合わせて復元する。
 * - アンカー（破損していない一致行）で位置を合わせ、
 *   その間の行は「ASCII骨格が一致するか」で判定して 8/6 版の行を採用する。
 * - 残った破損行は report に書き出して後で個別対応する。
 */
const fs = require('fs');

const damaged = fs.readFileSync('.restore/App.damaged.jsx', 'utf8').split('\n');
const old = fs.readFileSync('.restore/App.aug06.jsx', 'utf8').split('\n');

const stripNonAscii = (s) => s.replace(/[^\x00-\x7F]/g, '');
const stripQ = (s) => s.replace(/\?/g, '');
const hasQ = (s) => s.includes('?');

const oldKey = old.map((l) => stripNonAscii(l).trim());
const dmgKey = damaged.map((l) => stripQ(l).trim());

function isSubsequence(a, b) {
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j++) if (a[i] === b[j]) i++;
  return i === a.length;
}

function compatible(oi, di) {
  const o = old[oi];
  const d = damaged[di];
  if (!hasQ(d) && !/[^\x00-\x7F]/.test(o)) return o === d;
  const ok = oldKey[oi];
  const dk = dmgKey[di];
  if (!ok && !dk) return true;
  if (!isSubsequence(ok, dk)) return false;
  const extra = dk.length - ok.length;
  return extra <= Math.max(8, Math.ceil(dk.length * 0.35));
}

// ---- アンカー抽出: 両方で一意、破損なし、十分な長さ ----
const countOld = new Map();
const countDmg = new Map();
old.forEach((l, i) => {
  const k = oldKey[i];
  if (k.length < 18) return;
  countOld.set(k, (countOld.get(k) || 0) + 1);
});
damaged.forEach((l, i) => {
  if (hasQ(l)) return;
  const k = dmgKey[i];
  if (k.length < 18) return;
  countDmg.set(k, (countDmg.get(k) || 0) + 1);
});
const oldPos = new Map();
old.forEach((l, i) => { const k = oldKey[i]; if (countOld.get(k) === 1) oldPos.set(k, i); });

const pairs = [];
damaged.forEach((l, i) => {
  if (hasQ(l)) return;
  const k = dmgKey[i];
  if (countDmg.get(k) !== 1) return;
  if (!oldPos.has(k)) return;
  if (/[^\x00-\x7F]/.test(old[oldPos.get(k)])) return; // 旧側に日本語がある行はアンカーにしない
  pairs.push([oldPos.get(k), i]);
});

// 破損側の行番号順に、旧側も単調増加になる最長部分列（LIS）を取る
pairs.sort((a, b) => a[1] - b[1]);
const lis = [];
{
  const tails = [];
  const prev = new Array(pairs.length).fill(-1);
  const idxOfTail = [];
  for (let i = 0; i < pairs.length; i++) {
    const v = pairs[i][0];
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < v) lo = mid + 1; else hi = mid; }
    tails[lo] = v;
    idxOfTail[lo] = i;
    prev[i] = lo > 0 ? idxOfTail[lo - 1] : -1;
  }
  let cur = idxOfTail[tails.length - 1];
  while (cur !== -1 && cur !== undefined) { lis.push(pairs[cur]); cur = prev[cur]; }
  lis.reverse();
}
console.log('anchors', lis.length, '/ pairs', pairs.length);

// ---- アンカー区間ごとに復元 ----
const out = [];
const unresolved = [];
let po = 0; // old cursor
let pd = 0; // damaged cursor

function fillBlock(o0, o1, d0, d1) {
  // 区間内を貪欲＋DPで対応付け（小さい区間のみ）
  const on = o1 - o0;
  const dn = d1 - d0;
  if (dn <= 0) return;
  if (on <= 0) {
    for (let d = d0; d < d1; d++) {
      out.push(damaged[d]);
      if (hasQ(damaged[d])) unresolved.push({ line: out.length, text: damaged[d] });
    }
    return;
  }
  // LCS DP（互換判定）
  const dp = Array.from({ length: on + 1 }, () => new Int32Array(dn + 1));
  for (let a = on - 1; a >= 0; a--) {
    for (let b = dn - 1; b >= 0; b--) {
      dp[a][b] = compatible(o0 + a, d0 + b)
        ? dp[a + 1][b + 1] + 1
        : Math.max(dp[a + 1][b], dp[a][b + 1]);
    }
  }
  let a = 0, b = 0;
  while (b < dn) {
    if (a < on && compatible(o0 + a, d0 + b) && dp[a][b] === dp[a + 1][b + 1] + 1) {
      out.push(old[o0 + a]);
      a++; b++;
    } else if (a < on && dp[a + 1][b] >= dp[a][b + 1]) {
      a++;
    } else {
      out.push(damaged[d0 + b]);
      if (hasQ(damaged[d0 + b])) unresolved.push({ line: out.length, text: damaged[d0 + b] });
      b++;
    }
  }
}

for (const [oi, di] of lis) {
  fillBlock(po, oi, pd, di);
  out.push(old[oi]);
  po = oi + 1;
  pd = di + 1;
}
fillBlock(po, old.length, pd, damaged.length);

fs.writeFileSync('.restore/App.restored.jsx', out.join('\n'));
fs.writeFileSync('.restore/unresolved.txt', unresolved.map((u) => `${u.line}: ${u.text}`).join('\n'));
console.log('restored lines', out.length, ' (damaged had', damaged.length, ')');
console.log('unresolved lines with ?', unresolved.length);
