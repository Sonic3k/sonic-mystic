// Checks digitized rule files against the book: every paragraph accounted for, every rule's text copied exactly
// from its paragraph, every condition readable by the engine.
// Run: node kb/scripts/validate-rules.mjs [file-or-dir ...]   (default: kb/tuvi/rules)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, findTarget } from '@mystic/engine/tuvi';

const dir = path.dirname(fileURLToPath(import.meta.url));
const kb = path.resolve(dir, '..');
const book = JSON.parse(fs.readFileSync(path.join(kb, 'bundle/tuvi/book.json'), 'utf8'));
const paraById = new Map();
for (const e of book.entries) for (const p of e.paras) paraById.set(p.id, { ...p, entry: e });

const args = process.argv.slice(2);
const targets = args.length ? args : [path.join(kb, 'tuvi/rules')];
const files = targets.flatMap(t => (fs.statSync(t).isDirectory() ? fs.readdirSync(t).filter(f => f.endsWith('.json')).map(f => path.join(t, f)) : [t]));

const squash = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const TONES = new Set(['cat', 'hung', 'trung', 'mixed']);
const SKIP = new Set(['meta', 'verse', 'theory', 'xref', 'heading', 'dup']);
let errors = 0, warns = 0, rules = 0;
const covered = new Set();
const err = (f, m) => { errors++; console.log(`✗ ${path.basename(f)}: ${m}`); };
const warn = (f, m) => { warns++; if (process.env.VERBOSE) console.log(`⚠ ${path.basename(f)}: ${m}`); };

for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(f, `JSON lỗi: ${e.message}`); continue; }
  const entry = book.entries.find(e => e.line === data.entry);
  if (!entry) { err(f, `không có mục sao ở dòng ${data.entry}`); continue; }
  const ids = new Set(entry.paras.map(p => p.id));
  const seen = new Set();
  for (const s of data.skip ?? []) {
    if (!ids.has(s.para)) err(f, `skip: đoạn ${s.para} không thuộc mục này`);
    if (!SKIP.has(s.kind)) err(f, `skip ${s.para}: kind "${s.kind}" không hợp lệ`);
    seen.add(s.para);
  }
  for (const r of data.rules ?? []) {
    rules++;
    const where = `${r.id ?? '?'} (đoạn ${r.para})`;
    if (!ids.has(r.para)) { err(f, `${where}: đoạn không thuộc mục này`); continue; }
    seen.add(r.para);
    const para = paraById.get(r.para);
    if (!r.text || !squash(para.text).includes(squash(r.text))) err(f, `${where}: text không phải nguyên văn của đoạn: "${r.text}"`);
    if (!Array.isArray(r.palaces) || !r.palaces.length) err(f, `${where}: thiếu palaces`);
    else for (const t of r.palaces) if (t !== '*' && !findTarget(t)) err(f, `${where}: cung không rõ "${t}"`);
    if (!TONES.has(r.tone)) err(f, `${where}: tone "${r.tone}"`);
    if (r.when === null || r.when === undefined || r.when === '') {
      if (!r.review) err(f, `${where}: không có điều kiện thì phải ghi review`);
    } else {
      const p = parse(r.when);
      for (const m of p.errors) err(f, `${where}: điều kiện lỗi — ${m} — ${r.when}`);
      for (const m of p.warnings) warn(f, `${where}: ${m}`);
    }
  }
  for (const id of ids) if (!seen.has(id)) err(f, `đoạn ${id} chưa được xử lý: "${paraById.get(id).text.slice(0, 80)}"`);
  ids.forEach(id => covered.add(id));
}
const total = book.entries.reduce((n, e) => n + e.paras.length, 0);
console.log(`${files.length} files · ${rules} rules · ${covered.size}/${total} paragraphs in validated entries · ${errors} errors · ${warns} warnings`);
process.exit(errors ? 1 : 0);
