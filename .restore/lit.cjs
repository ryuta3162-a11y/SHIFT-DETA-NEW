/** 両側の「非ASCII/破損を含むリテラル」を出現順に抽出して件数を比べる */
const fs = require('fs');

function extractLiterals(text, opts) {
  const { damaged } = opts;
  const lits = [];
  let i = 0;
  const isBad = damaged ? (s) => /\?/.test(s) : (s) => /[^\x00-\x7F]/.test(s);

  function readString(quote, start) {
    // start は開始引用符の次
    let i2 = start;
    let content = '';
    while (i2 < text.length) {
      const c = text[i2];
      if (c === '\\') { content += text.slice(i2, i2 + 2); i2 += 2; continue; }
      if (c === quote) return { content, end: i2 + 1, closed: true };
      if (c === '\n') return { content, end: i2, closed: false };
      content += c;
      i2++;
    }
    return { content, end: i2, closed: false };
  }

  function readTemplate(start) {
    let i2 = start;
    const pieces = [];
    let cur = '';
    while (i2 < text.length) {
      const c = text[i2];
      const n = text[i2 + 1];
      if (c === '\\') { cur += text.slice(i2, i2 + 2); i2 += 2; continue; }
      if (c === '`') { pieces.push(cur); return { pieces, end: i2 + 1 }; }
      if (c === '$' && n === '{') {
        pieces.push(cur);
        cur = '';
        // 対応する } まで飛ばす（入れ子/文字列を考慮）
        let depth = 1;
        let j = i2 + 2;
        while (j < text.length && depth > 0) {
          const cj = text[j];
          if (cj === '{') depth++;
          else if (cj === '}') depth--;
          else if (cj === "'" || cj === '"') { const r = readString(cj, j + 1); j = r.end; continue; }
          else if (cj === '`') { const r = readTemplate(j + 1); j = r.end; continue; }
          j++;
        }
        pieces.push({ expr: text.slice(i2, j) });
        i2 = j;
        continue;
      }
      cur += c;
      i2++;
    }
    pieces.push(cur);
    return { pieces, end: i2 };
  }

  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (damaged && c === '/' && n === '/') { const e = text.indexOf('\n', i); i = e < 0 ? text.length : e; continue; }
    if (damaged && c === '/' && n === '*') { const e = text.indexOf('*/', i); i = e < 0 ? text.length : e + 2; continue; }
    if (c === "'" || c === '"') {
      const r = readString(c, i + 1);
      if (isBad(r.content)) lits.push({ kind: c, start: i, end: r.end, content: r.content, closed: r.closed });
      i = r.end;
      continue;
    }
    if (c === '`') {
      const r = readTemplate(i + 1);
      const texts = r.pieces.filter((p) => typeof p === 'string');
      if (texts.some(isBad)) lits.push({ kind: '`', start: i, end: r.end, pieces: r.pieces });
      i = r.end;
      continue;
    }
    i++;
  }
  return lits;
}

const src = fs.readFileSync('.restore/App.damaged.jsx', 'utf8');
const bundle = fs.readFileSync('.restore/bundle.html', 'utf8');
const APP_START = Number(process.env.APP_START || 208270);

const dmg = extractLiterals(src, { damaged: true });
const bnd = extractLiterals(bundle.slice(APP_START), { damaged: false });
console.log('damaged literals with ?', dmg.length);
console.log('bundle literals with jp', bnd.length);

const fmt = (l) => (l.kind === '`'
  ? l.pieces.map((p) => (typeof p === 'string' ? p : '${…}')).join('')
  : l.content);

const n = Number(process.argv[2] || 20);
const lines = [];
for (let k = 0; k < n; k++) {
  lines.push(`${k} [${dmg[k] ? dmg[k].kind : '-'}] ${dmg[k] ? JSON.stringify(fmt(dmg[k])) : ''}\n     -> ${bnd[k] ? JSON.stringify(fmt(bnd[k])) : ''}`);
}
fs.writeFileSync('.restore/pairs.txt', lines.join('\n'));
console.log('wrote .restore/pairs.txt');
