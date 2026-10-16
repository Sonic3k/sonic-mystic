// Builds the Chiêm tinh bundle the API imports (kb/bundle/astrology):
//   book.json      every source section by section and passage by passage — cô Hương Kiều's textbook, her table of
//                  keywords, her test of the dominant planets and her handout on Bạch Dương, the class's translation of
//                  Bil Tierney's book on aspects, and Woolfolk's book in Claude's translation (with the English kept);
//                  each passage with what it is to a reader (rule: speaks of a person; general: explains) and whose
//                  voice it is (hk: cô Hương Kiều, tierney: Bil Tierney in the class's translation, woolfolk)
//   rules.json     every passage that speaks of a person, with the condition under which it does and the part of a
//                  reading it belongs to — checked here against the engine's condition language
//   manifest.json  a hash of all of it: the API imports again only when it changes
// Sources: kb/sources/astrology/*.jsonl (one block per line, in reading order) and kb/astrology/*.json (one entry per
// heading of a source, and the passage-by-passage overrides). Run after any edit of a map: npm run kb:astrology
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS, parse, symbolsOf } from '@mystic/engine/astrology';

const kb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.env.ASTROLOGY_SOURCE_DIR ?? path.join(kb, 'sources/astrology');
const out = path.join(kb, 'bundle/astrology');
// in this order a reading lists what each source says of the same thing: her words first
const MAPS = ['huong-kieu-keywords', 'huong-kieu', 'huong-kieu-dominant', 'huong-kieu-aries', 'tierney-aspects', 'woolfolk'];
const ROLES = new Set(['rule', 'general']);
const TOPIC_CODES = new Set(TOPICS.map(t => t.code));
const errors = [];

/** whose words a passage is: her own, Tierney's (the 12 signs of her textbook are his "All Round the Zodiac"), Woolfolk's */
const voiceOf = (src, block) => (src === 'astrology.tierney' || (src === 'astrology.hk' && block.page >= 41 && block.page <= 147 && block.kind !== 'heading') ? 'tierney'
  : src === 'astrology.woolfolk' ? 'woolfolk' : 'hk');
const textOf = b => (b.kind === 'keywords' ? b.items.join('\n') : b.kind === 'table' ? b.rows.map(r => `${r.planet}: Vượng ${r.exaltation.join(', ')}; Tử ${r.fall.join(', ')}; Tướng ${r.ruler.join(', ')}; Tù ${r.detriment.join(', ')}`).join('\n') : b.text);

const books = [];
const rules = [];
let ord = 0;
for (const name of MAPS) {
  const map = JSON.parse(fs.readFileSync(path.join(kb, 'astrology', `${name}.json`), 'utf8'));
  const file = path.join(srcDir, map.source.file);
  if (!fs.existsSync(file)) { errors.push(`${name}: thiếu file nguồn ${file}`); continue; }
  const blocks = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l, i) => ({ id: i + 1, ...JSON.parse(l) }));
  const short = map.source.code.replace(/^astrology\./, '');
  const byAt = new Map(map.entries.map(e => [e.at, e]));
  const byCode = new Map(map.entries.map(e => [e.code, e]));
  for (const e of map.entries) {
    if (blocks[e.at - 1]?.kind !== 'heading') errors.push(`${short}/${e.code}: khối ${e.at} không phải đề mục`);
    if (e.parent && !byCode.has(e.parent)) errors.push(`${short}/${e.code}: không có mục cha ${e.parent}`);
    if (e.kind && !ROLES.has(e.kind)) errors.push(`${short}/${e.code}: kind "${e.kind}"`);
    for (const t of [e.topic ?? []].flat()) if (!TOPIC_CODES.has(t)) errors.push(`${short}/${e.code}: topic "${t}"`);
  }
  for (const b of blocks) if (b.kind === 'heading' && !byAt.has(b.id)) errors.push(`${short}: đề mục ở khối ${b.id} chưa có mục: "${b.text}"`);
  const inherit = (e, key) => { for (let x = e; x; x = x.parent ? byCode.get(x.parent) : undefined) if (x[key] !== undefined) return x[key]; return undefined; };

  const entries = [];
  let cur = null;
  for (const b of blocks) {
    if (b.kind === 'heading') {
      const e = byAt.get(b.id);
      if (!e) continue;
      const when = inherit(e, 'when') ?? null;
      const parsed = when ? parse(when) : null;
      if (parsed?.errors.length) errors.push(`${short}/${e.code}: điều kiện lỗi — ${parsed.errors.join('; ')} — ${when}`);
      const topic = inherit(e, 'topic') ?? null;
      cur = { code: e.code, title: e.title, parent: e.parent ?? null, page: b.page, at: b.id, topic: Array.isArray(topic) ? topic[0] : topic, symbols: [...symbolsOf(parsed?.node)], ...(b.en ? { en: b.en } : {}), paras: [] };
      entries.push(cur);
      continue;
    }
    if (!cur) { errors.push(`${short}: khối ${b.id} nằm trước đề mục đầu tiên`); continue; }
    const e = byCode.get(cur.code), o = map.paras?.[String(b.id)] ?? {};
    for (const k of Object.keys(o)) if (!['kind', 'when', 'topic'].includes(k)) errors.push(`${short} đoạn ${b.id}: khóa lạ "${k}"`);
    const role = o.kind ?? inherit(e, 'kind') ?? 'general';
    if (!ROLES.has(role)) errors.push(`${short} đoạn ${b.id}: kind "${role}"`);
    const text = textOf(b);
    const p = { id: b.id, kind: b.kind, role, page: b.page, text, voice: voiceOf(map.source.code, b) };
    if (b.pages && b.pages.length > 1) p.pages = b.pages;
    if (b.label) p.label = b.label;
    if (b.en) p.en = b.en;
    if (b.label_en) p.labelEn = b.label_en;
    if (b.items) p.items = b.items;
    if (b.kind === 'table') { p.columns = b.columns; p.rows = b.rows; }
    if (b.forms) { p.forms = b.forms; if (b.usage) p.usage = b.usage; }
    if (b.facet) p.facet = b.facet;
    cur.paras.push(p);
    const when = o.when ?? inherit(e, 'when') ?? null;
    const topics = [o.topic ?? inherit(e, 'topic') ?? []].flat();
    if (role === 'rule' || (role === 'general' && o.when)) {
      if (!when) { errors.push(`${short} đoạn ${b.id} (${role}) chưa có điều kiện: "${text.slice(0, 70)}"`); continue; }
      if (!topics.length) { errors.push(`${short} đoạn ${b.id} (${role}) không thuộc phần luận nào`); continue; }
      const parsed = parse(when);
      for (const m of parsed.errors) errors.push(`${short} đoạn ${b.id}: điều kiện lỗi — ${m} — ${when}`);
      topics.forEach(tp => rules.push({
        i: `${short}.b${b.id}${topics.length > 1 ? `.${tp}` : ''}`, s: map.source.code, e: cur.code, p: b.id, pg: b.page, t: text, w: when, k: role, tp, o: ord++,
        sy: [...symbolsOf(parsed.node)], v: p.voice, ...(p.label ? { lb: p.label } : {}), ...(p.en ? { en: p.en } : {}), ...(p.items ? { it: p.items } : {}),
      }));
    }
  }
  books.push({ source: map.source, entries });
}
const ids = new Set();
for (const r of rules) { if (ids.has(r.i)) errors.push(`trùng mã ${r.i}`); ids.add(r.i); }
if (errors.length) { for (const m of errors.slice(0, 80)) console.log(`✗ ${m}`); if (errors.length > 80) console.log(`… và ${errors.length - 80} lỗi khác`); process.exit(1); }

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'book.json'), JSON.stringify({ books }));
fs.writeFileSync(path.join(out, 'rules.json'), JSON.stringify({ rules }));
const hash = crypto.createHash('sha256');
for (const f of ['book.json', 'rules.json']) hash.update(fs.readFileSync(path.join(out, f)));
const count = (f) => books.reduce((n, b) => n + f(b), 0);
const manifest = {
  discipline: 'astrology', version: hash.digest('hex').slice(0, 16), sources: books.length,
  entries: count(b => b.entries.length), passages: count(b => b.entries.reduce((n, e) => n + e.paras.length, 0)), rules: rules.length,
  built: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`${manifest.sources} nguồn · ${manifest.entries} mục · ${manifest.passages} đoạn · ${rules.length} câu luận · bundle ${manifest.version}`);
for (const b of books) {
  const rs = rules.filter(r => r.s === b.source.code);
  const tally = {};
  for (const r of rs) tally[r.tp] = (tally[r.tp] ?? 0) + 1;
  console.log(`  ${b.source.code.padEnd(22)} ${String(b.entries.length).padStart(4)} mục · ${String(rs.length).padStart(4)} câu  ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
}
