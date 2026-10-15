// Builds the Nhân số học bundle the API imports (kb/bundle/numerology):
//   book.json      Lê Đỗ Quỳnh Hương's book section by section and paragraph by paragraph, each section with the numbers
//                  it is about, each paragraph with what it is to a reader: the book describing a person (rule), its
//                  advice, its words about children, an explanation (general), how to compute (method), an example of
//                  someone, a figure (its chart is read back by the engine's figureOf), a footnote
//   rules.json     every paragraph that speaks of a person, with the condition under which it does — checked here
//                  against the engine's condition language
//   tables.json    the book's tables as data
//   manifest.json  a hash of all of it: the API imports again only when it changes
// Sources: kb/sources/numerology/*.jsonl (the proofread book, one block per line, in reading order) and
// kb/numerology/map.json (one entry per heading of the book, and the paragraph-by-paragraph review).
// Run after any edit of the map: npm run kb:numerology (from the repo root)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS, figureOf, parse, symbolsOf } from '@mystic/engine/numerology';

const kb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.env.NUMEROLOGY_SOURCE_DIR ?? path.join(kb, 'sources/numerology');
const out = path.join(kb, 'bundle/numerology');
const sources = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter(f => f.endsWith('.jsonl')) : [];
if (sources.length !== 1) throw new Error(`cần đúng một file .jsonl của sách trong ${srcDir} (có ${sources.length})`);
const blocks = fs.readFileSync(path.join(srcDir, sources[0]), 'utf8').split('\n').filter(Boolean).map((l, i) => ({ id: i + 1, ...JSON.parse(l) }));
const map = JSON.parse(fs.readFileSync(path.join(kb, 'numerology/map.json'), 'utf8'));
const tables = JSON.parse(fs.readFileSync(path.join(kb, 'numerology/tables.json'), 'utf8'));

const errors = [];
const ROLES = new Set(['rule', 'advice', 'child', 'general', 'method', 'example']);
const TOPIC_CODES = new Set(TOPICS.map(t => t.code));
const byAt = new Map(map.entries.map(e => [e.at, e]));
const byCode = new Map(map.entries.map(e => [e.code, e]));
for (const e of map.entries) {
  if (blocks[e.at - 1]?.kind !== 'heading') errors.push(`${e.code}: khối ${e.at} không phải đề mục`);
  if (e.parent && !byCode.has(e.parent)) errors.push(`${e.code}: không có mục cha ${e.parent}`);
  if (e.kind && !ROLES.has(e.kind)) errors.push(`${e.code}: kind "${e.kind}"`);
  if (e.topic && !TOPIC_CODES.has(e.topic)) errors.push(`${e.code}: topic "${e.topic}"`);
}
for (const b of blocks) if (b.kind === 'heading' && !byAt.has(b.id)) errors.push(`đề mục ở khối ${b.id} chưa có mục: "${b.text}"`);
const inherit = (e, key) => { for (let x = e; x; x = x.parent ? byCode.get(x.parent) : undefined) if (x[key] !== undefined) return x[key]; return undefined; };

// the paragraphs of each entry, with what each one is
const entries = [];
let cur = null;
for (const b of blocks) {
  if (b.kind === 'heading') {
    const e = byAt.get(b.id);
    const when = inherit(e, 'when') ?? null;
    const parsed = when ? parse(when) : null;
    if (parsed?.errors.length) errors.push(`${e.code}: điều kiện lỗi — ${parsed.errors.join('; ')} — ${when}`);
    cur = { code: e.code, title: e.title, parent: e.parent ?? null, kind: e.parent ? 'section' : (/^p\d+$/.test(e.code) ? 'part' : 'section'), page: b.page, at: b.id, topic: inherit(e, 'topic') ?? null, symbols: [...symbolsOf(parsed?.node)], paras: [] };
    entries.push(cur);
    continue;
  }
  if (!cur) { errors.push(`khối ${b.id} nằm trước đề mục đầu tiên`); continue; }
  const e = byCode.get(cur.code), o = map.paras?.[String(b.id)] ?? {};
  for (const k of Object.keys(o)) if (!['kind', 'when', 'topic'].includes(k)) errors.push(`đoạn ${b.id}: khóa lạ "${k}"`);
  const role = b.kind === 'figure' ? 'figure' : b.kind === 'note' ? 'note' : o.kind ?? inherit(e, 'kind') ?? 'general';
  if (!ROLES.has(role) && role !== 'figure' && role !== 'note') errors.push(`đoạn ${b.id}: kind "${role}"`);
  const p = { id: b.id, kind: b.kind, role, page: b.page, text: b.text };
  if (b.pages && b.pages.length > 1) p.pages = b.pages;
  // a figure that draws a birth chart ("3 | - | 9 / 2 | 5 | 8 / …") must read back as one
  if (b.kind === 'figure' && /^[\d\-(][^/]*\|[^/]*\//.test(b.text.split('||')[1]?.trim() ?? '') && !figureOf(b.text).grid) errors.push(`hình ở khối ${b.id}: không đọc được biểu đồ "${b.text.slice(0, 80)}"`);
  const when = o.when ?? inherit(e, 'when') ?? null, topic = o.topic ?? inherit(e, 'topic') ?? null;
  if (['rule', 'advice', 'child'].includes(role) || (role === 'general' && o.when === 'any()')) {
    if (!when) errors.push(`đoạn ${b.id} (${role}) chưa có điều kiện: "${b.text.slice(0, 70)}"`);
    else if (!topic) errors.push(`đoạn ${b.id} (${role}) không thuộc phần luận nào`);
    else p.rule = { when, topic };
  }
  cur.paras.push(p);
}

// rules: the paragraphs that speak of a person, each with its parsed condition
const rules = [];
let ord = 0;
for (const e of entries) for (const p of e.paras) {
  if (!p.rule) continue;
  const parsed = parse(p.rule.when);
  for (const m of parsed.errors) errors.push(`đoạn ${p.id}: điều kiện lỗi — ${m} — ${p.rule.when}`);
  rules.push({ i: `ldqh.b${p.id}`, e: e.code, p: p.id, pg: p.page, t: p.text, w: p.rule.when, k: p.role, tp: p.rule.topic, o: ord++, s: [...symbolsOf(parsed.node)] });
}
const ids = new Set();
for (const r of rules) { if (ids.has(r.i)) errors.push(`trùng mã ${r.i}`); ids.add(r.i); }
for (const t of tables.tables) if (!byCode.has(t.entry)) errors.push(`bảng ${t.key}: không có mục ${t.entry}`);

if (errors.length) { for (const m of errors) console.log(`✗ ${m}`); process.exit(1); }

fs.mkdirSync(out, { recursive: true });
const book = { source: map.source, entries: entries.map(e => ({ ...e, paras: e.paras.map(({ rule: _r, ...p }) => p) })) };
fs.writeFileSync(path.join(out, 'book.json'), JSON.stringify(book));
fs.writeFileSync(path.join(out, 'rules.json'), JSON.stringify({ rules }));
fs.writeFileSync(path.join(out, 'tables.json'), JSON.stringify(tables));
const hash = crypto.createHash('sha256');
for (const f of ['book.json', 'rules.json', 'tables.json']) hash.update(fs.readFileSync(path.join(out, f)));
const manifest = { discipline: 'numerology', version: hash.digest('hex').slice(0, 16), entries: entries.length, passages: entries.reduce((n, e) => n + e.paras.length, 0), rules: rules.length, built: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const tally = {};
for (const r of rules) { tally[r.tp] ??= {}; tally[r.tp][r.k] = (tally[r.tp][r.k] ?? 0) + 1; }
const roles = {};
for (const e of entries) for (const p of e.paras) roles[p.role] = (roles[p.role] ?? 0) + 1;
console.log(`${entries.length} mục · ${manifest.passages} đoạn (${Object.entries(roles).map(([k, n]) => `${k} ${n}`).join(', ')}) · ${rules.length} câu luận · bundle ${manifest.version}`);
for (const t of TOPICS) if (tally[t.code]) console.log(`  ${t.code.padEnd(10)} ${Object.entries(tally[t.code]).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
