// Turns the clean text of "Luận TV 11.2011" into the book the pages read: one entry per star, each paragraph kept
// exactly as grandma wrote it (only the markdown escapes of the .doc export removed), with the palace section it sits in.
// Run: npm run kb:book (from the repo root)  → kb/bundle/tuvi/book.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findStar, findTarget, norm } from '@mystic/engine/tuvi';

const dir = path.dirname(fileURLToPath(import.meta.url));
const kb = path.resolve(dir, '..');

const lines = fs.readFileSync(path.join(kb, 'sources/tuvi/grandma-notes-2011-11.txt'), 'utf8').split('\n');
const unescape = s => s.replace(/\\([-*()!.#+_[\]>])/g, '$1').replace(/\s+$/, '');

/** "Cung Mệnh Thân:", "Cung Tài Điền:", "Cung hạn =" … → the palaces the section speaks of (null if not a section line) */
function sectionOf(text) {
  const m = /^Cung\s+(.*)$/u.exec(text);
  if (!m) return null;
  const words = m[1].split(/([\s,()]+)/u);
  const found = [];
  let rest = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w || /^[\s,()]+$/u.test(w)) continue;
    if (/^(hay|và)$/iu.test(w)) continue;
    const two = words[i + 2] ? findTarget(`${w} ${words[i + 2]}`) : undefined;
    if (two && !/^[\s,()]+$/u.test(words[i + 2] ?? '') ) { found.push(two); i += 2; continue; }
    const t = findTarget(w.replace(/[:=].*$/u, ''));
    if (t) { found.push(t); if (/[:=]/u.test(w)) { rest = 'x'; break; } continue; }
    rest = w; break;
  }
  if (!found.length) return null;
  // a section line names palaces, then a colon or "=" (or straight into the first rule: "Cung Huynh có Thái Dương= …")
  return [...new Set(found)];
}

const kindOf = text => {
  if (/^Cung\s/u.test(text)) return 'section';
  if (/^[-*•+]\s?/u.test(text)) return 'item';
  if (/^(Thuộc|Là\s.*tinh|Hành\s|Miếu|Vượng|Đắc|Hãm|Bình|Tính cách|Tượng)/iu.test(text) || /^[-]?\s*Miếu vượng/iu.test(text)) return 'meta';
  return 'text';
};

const entries = [], preface = [];
let cur = null, sec = null, inHead = false;
lines.forEach((raw, i) => {
  const id = i + 1, text = unescape(raw.trim());
  if (!text) return;
  const star = text.length < 40 ? findStar(text.replace(/\.$/, '')) : undefined;
  // a pair heading inside another entry: "Thiên Quan - Thiên Phúc", "Thiếu âm - Thiếu Dương"
  const pair = !star && text.length < 40 ? /^(.+?)\s+[-–]\s+(.+)$/u.exec(text) : null;
  const pa = pair && findStar(pair[1]), pb = pair && findStar(pair[2]);
  if ((star || (pa && pb)) && id >= 158) {
    cur = pa && pb
      ? { star: pa.id, stars: [pa.id, pb.id], name: text, line: id, paras: [] }
      : { star: star.id, name: text.replace(/\.$/, ''), line: id, paras: [] };
    entries.push(cur); sec = null; inHead = true;
    return;
  }
  if (!cur) { preface.push({ id, text }); return; }
  let kind = kindOf(text);
  if (kind === 'section') {
    const s = sectionOf(text);
    if (s) sec = s; else kind = 'text';
    inHead = false;
  } else if (kind === 'meta' && !inHead) kind = /^(Tính cách|Tượng)/iu.test(text) ? 'meta' : 'text';
  else if (kind !== 'meta') inHead = false;
  cur.paras.push({ id, kind, sec: kind === 'meta' ? null : sec, text });
});

const book = {
  source: {
    title: 'Luận Tử Vi — ghi chép của bà ngoại',
    file: 'Luan TV 11.2011(5).doc',
    note: 'Bản 11/2011, đối chiếu bản "Font fixed" với bản gốc để sửa những dòng bị chuyển mã hai lần.',
  },
  preface,
  entries,
};
fs.writeFileSync(path.join(kb, 'bundle/tuvi/book.json'), JSON.stringify(book));

// a short report for checking by eye
const report = entries.map(e => {
  const secs = [...new Set(e.paras.filter(p => p.sec).map(p => p.sec.join('+')))];
  return `${String(e.line).padStart(4)} ${e.name.padEnd(18)} ${String(e.paras.length).padStart(3)} paras  ${secs.join(' | ')}`;
});
fs.writeFileSync(path.join(kb, 'sources/tuvi/book-report.txt'), report.join('\n'));
console.log(`entries: ${entries.length}, paragraphs: ${entries.reduce((n, e) => n + e.paras.length, 0)}, preface: ${preface.length}`);
const labels = new Map();
entries.forEach(e => e.paras.filter(p => p.kind === 'section').forEach(p => { const k = p.text.slice(0, 22); labels.set(p.sec.join('+'), (labels.get(p.sec.join('+')) ?? 0) + 1); }));
console.log([...labels].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
void norm;
