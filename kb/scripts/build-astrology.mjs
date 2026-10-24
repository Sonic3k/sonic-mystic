// Builds the Chiêm tinh bundle the API imports (kb/bundle/astrology):
//   book.json      every source section by section and passage by passage — cô Hương Kiều's textbook, her table of
//                  keywords, her test of the dominant planets and her handout on Bạch Dương, her class's notes, the
//                  class's translation of Bil Tierney's book on aspects, Woolfolk's book in Claude's translation (with the
//                  English kept), the other books' passages on weighing a chart (Claude's translation, the English kept),
//                  and the weighting rules themselves (drawn up from the engine's WEIGH_RULES, each with the passages it
//                  rests on); each passage with what it is to a reader (rule: speaks of a person; general: explains) and
//                  whose voice it is (hk: cô Hương Kiều, notes: her class, tierney: Bil Tierney in the class's
//                  translation, woolfolk, books: the other books, claude: the rules Claude drew from all of them)
//   rules.json     every passage that speaks of a person, with the condition under which it does and the part of a
//                  reading it belongs to — checked here against the engine's condition language
//   manifest.json  a hash of all of it: the API imports again only when it changes
// Sources: kb/sources/astrology/*.jsonl (one block per line, in reading order; a block's id is its line, so a block that
// was folded into another stays as {"kind":"void"}) and kb/astrology/*.json (one entry per heading of a source, and the
// passage-by-passage overrides: kind, when, topic, and entry — the entry a passage belongs to when the page's layout put
// it under another heading, as the main text running past a sidebar). Run after any edit of a map: npm run kb:astrology
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS, WEIGH_LEVEL_NAME, WEIGH_PRINCIPLES, WEIGH_RULES, parse, symbolsOf } from '@mystic/engine/astrology';

const kb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.env.ASTROLOGY_SOURCE_DIR ?? path.join(kb, 'sources/astrology');
const out = path.join(kb, 'bundle/astrology');
// in this order a reading lists what each source says of the same thing: her words first
// (the rules last: they cite the others)
const MAPS = ['huong-kieu-keywords', 'huong-kieu', 'huong-kieu-dominant', 'huong-kieu-aries', 'huong-kieu-notes', 'tierney-aspects', 'woolfolk', 'books', 'method'];
const ROLES = new Set(['rule', 'general']);
const TOPIC_CODES = new Set(TOPICS.map(t => t.code));
const errors = [];

/** whose words a passage is: her own, her class's, Tierney's (the 12 signs of her textbook are his "All Round the Zodiac"),
    Woolfolk's, the other books', or the rules Claude drew from them */
const VOICE_OF_SOURCE = { 'astrology.hk-notes': 'notes', 'astrology.tierney': 'tierney', 'astrology.woolfolk': 'woolfolk', 'astrology.books': 'books', 'astrology.method': 'claude' };
const voiceOf = (src, block) => (src === 'astrology.hk' && block.page >= 41 && block.page <= 147 && block.kind !== 'heading' ? 'tierney' : VOICE_OF_SOURCE[src] ?? 'hk');
/** a passage's text: a table's is its rows, one to a line (her dignities in her words; any other cell by cell) */
const isDignities = b => b.columns[0]?.[0] === 'planet' && b.rows.every(r => Array.isArray(r.exaltation));
const cellText = v => (Array.isArray(v) ? v.join(', ') : String(v ?? '')).replace(/\n/g, ': ');
const textOf = b => (b.kind === 'keywords' ? b.items.join('\n')
  : b.kind === 'table' ? (isDignities(b)
    ? b.rows.map(r => `${r.planet}: Vượng ${r.exaltation.join(', ')}; Tử ${r.fall.join(', ')}; Tướng ${r.ruler.join(', ')}; Tù ${r.detriment.join(', ')}`)
    : b.rows.map(r => b.columns.map(([k]) => cellText(r[k])).filter(Boolean).join(' · '))).join('\n')
  : b.text);

/** a passage of a source already built, as a reader would look it up: the book (for the other books, the one of the six
    it is from), where in it, and the page */
function cite(built, ref) {
  const m = /^([a-z-]+)\.b(\d+)$/.exec(ref);
  const book = m && built.find(b => b.source.code === `astrology.${m[1]}`);
  if (!book) { errors.push(`method: không có nguồn cho ${ref}`); return { name: ref, short: ref, where: '', page: null }; }
  const id = Number(m[2]);
  const e = book.entries.find(x => x.paras.some(p => p.id === id));
  const p = e?.paras.find(x => x.id === id);
  if (!e || !p) { errors.push(`method: ${ref} không phải một đoạn của ${book.source.title}`); return { name: ref, short: ref, where: '', page: null }; }
  let top = e;
  for (let up = e; up; up = up.parent ? book.entries.find(y => y.code === up.parent) : undefined) top = up;
  const tidy = (t) => t.replace(/[«»]/g, '').replace(/\s*\([^()]*\)$/, '').replace(/[.:]+$/, '').trim();
  const other = book.source.code === 'astrology.books';
  const name = tidy(other ? top.title : book.source.title);
  const where = tidy(other ? (p.label ?? e.title) : e.title);
  return { name, short: other ? name.replace(/^.* — /, '') : name, where: where === name ? '' : where, page: p.page };
}
const at = (c) => `${c.where ? `«${c.where}»` : ''}${c.page !== null ? `${c.where ? ' ' : ''}tr. ${c.page}` : ''}`;
/** passages cited one after another, book by book: "Chiêm tinh học cơ bản: «Phân nhóm» tr. 14, «…» tr. 154; …" */
const citeList = (built, refs) => {
  const groups = new Map();
  for (const c of refs.map(r => cite(built, r))) { const g = groups.get(c.name) ?? []; const w = at(c); if (!g.includes(w)) g.push(w); groups.set(c.name, g); }
  // a bare page already named with a passage on it says nothing more
  const keep = (ws) => ws.filter(w => w && !(/^tr\. /.test(w) && ws.some(x => x !== w && x.endsWith(` ${w}`))));
  return [...groups].map(([name, ws]) => (keep(ws).length ? `${name}: ${keep(ws).join(', ')}` : name)).join('; ') + '.';
};
/** a passage cited inside a sentence: the book's short name and where in it */
const citeInline = (built, ref) => { const c = cite(built, ref), w = at(c); return w ? `${c.short}, ${w}` : c.short; };
/** the weighting rules as a source of their own: what they rest on, then each level and each rule with the passages it
    cites — in words, each citation as a reader would look it up */
function weighSource(built) {
  const blocks = [], entries = [];
  const head = (code, text, level, parent) => { blocks.push({ id: blocks.length + 1, kind: 'heading', level, text }); entries.push({ at: blocks.length, code, title: text, kind: 'general', ...(parent ? { parent } : {}) }); };
  const para = (text, label) => blocks.push({ id: blocks.length + 1, kind: 'para', text, ...(label ? { label } : {}) });
  const words = (text) => text.replace(/\b[a-z-]+\.b\d+\b/g, r => citeInline(built, r));
  const list = (refs) => citeList(built, refs);
  head('intro', 'Cách cân lá số', 1);
  para(`Một bộ luật cho mọi lá số, để bài luận biết điều gì nói trước, nói kỹ. Ba mức: ${WEIGH_LEVEL_NAME.key} — điều chi phối lá số; ${WEIGH_LEVEL_NAME.normal} — có tác dụng, không chi phối; ${WEIGH_LEVEL_NAME.minor} — bị làm yếu, hay quá nhỏ. Máy tính chỉ xét yếu tố nào hợp luật nào, không cộng điểm. Mỗi luật dẫn những đoạn nó dựa vào, lời cô trước; chỗ luật áp một đoạn quá chữ của đoạn ấy thì ghi «Cách áp»; chỗ sách nói khác thì ghi ra.`);
  head('principles', 'Nguyên tắc', 2, 'intro');
  for (const p of WEIGH_PRINCIPLES) { para(words(p.text)); if (p.refs.length) para(list(p.refs), 'Dựa trên:'); }
  for (const level of ['key', 'normal', 'minor']) {
    head(level, WEIGH_LEVEL_NAME[level], 1);
    for (const r of WEIGH_RULES.filter(x => x.level === level)) {
      head(r.code.toLowerCase(), `${r.code} · ${r.name}`, 2, level);
      para(r.text);
      if (r.applied) para(words(r.applied), 'Cách áp:');
      para(list(r.refs), 'Dựa trên:');
      if (r.against?.length) para(list(r.against), 'Sách nói khác:');
    }
  }
  return { blocks, entries };
}

const books = [];
const rules = [];
let ord = 0;
for (const name of MAPS) {
  const map = JSON.parse(fs.readFileSync(path.join(kb, 'astrology', `${name}.json`), 'utf8'));
  let blocks;
  if (map.generated === 'weigh') ({ blocks, entries: map.entries } = weighSource(books));
  else {
    const file = path.join(srcDir, map.source.file);
    if (!fs.existsSync(file)) { errors.push(`${name}: thiếu file nguồn ${file}`); continue; }
    blocks = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l, i) => ({ id: i + 1, ...JSON.parse(l) }));
  }
  const short = map.source.code.replace(/^astrology\./, '');
  const byAt = new Map(map.entries.map(e => [e.at, e]));
  const byCode = new Map(map.entries.map(e => [e.code, e]));
  for (const e of map.entries) {
    if (blocks[e.at - 1]?.kind !== 'heading') errors.push(`${short}/${e.code}: khối ${e.at} không phải đề mục`);
    if (e.parent && !byCode.has(e.parent)) errors.push(`${short}/${e.code}: không có mục cha ${e.parent}`);
    if (e.kind && !ROLES.has(e.kind)) errors.push(`${short}/${e.code}: kind "${e.kind}"`);
    if (e.join && map.entries.some(x => x.parent === e.code)) errors.push(`${short}/${e.code}: đề mục nối vào đề mục trước thì không có mục con`);
    for (const t of [e.topic ?? []].flat()) if (!TOPIC_CODES.has(t)) errors.push(`${short}/${e.code}: topic "${t}"`);
  }
  for (const b of blocks) if (b.kind === 'heading' && !byAt.has(b.id)) errors.push(`${short}: đề mục ở khối ${b.id} chưa có mục: "${b.text}"`);
  const inherit = (e, key) => { for (let x = e; x; x = x.parent ? byCode.get(x.parent) : undefined) if (x[key] !== undefined) return x[key]; return undefined; };

  const entries = [];
  const built = new Map();
  let cur = null;
  for (const b of blocks) {
    if (b.kind === 'void') {
      if (map.paras?.[String(b.id)]) errors.push(`${short} đoạn ${b.id}: khối đã gộp vào khối khác (void) mà vẫn có ghi đè`);
      continue;
    }
    if (b.kind === 'heading') {
      const e = byAt.get(b.id);
      if (!e) continue;
      // a heading that only completes the one before it (Woolfolk's "(January 20 – February 18)" under "Aquarius")
      if (e.join) {
        if (cur?.at !== b.id - 1) errors.push(`${short}/${e.code}: "join" chỉ dùng cho đề mục ngay sau một đề mục khác`);
        else { cur.title = `${cur.title} ${e.title}`; if (b.en) cur.en = cur.en ? `${cur.en} ${b.en}` : b.en; }
        continue;
      }
      const when = inherit(e, 'when') ?? null;
      const parsed = when ? parse(when) : null;
      if (parsed?.errors.length) errors.push(`${short}/${e.code}: điều kiện lỗi — ${parsed.errors.join('; ')} — ${when}`);
      const topic = inherit(e, 'topic') ?? null;
      cur = { code: e.code, title: e.title, parent: e.parent ?? null, page: b.page ?? null, at: b.id, topic: Array.isArray(topic) ? topic[0] : topic, symbols: [...symbolsOf(parsed?.node)], ...(b.en ? { en: b.en } : {}), paras: [] };
      entries.push(cur);
      built.set(cur.code, cur);
      continue;
    }
    const o = map.paras?.[String(b.id)] ?? {};
    for (const k of Object.keys(o)) if (!['kind', 'when', 'topic', 'entry'].includes(k)) errors.push(`${short} đoạn ${b.id}: khóa lạ "${k}"`);
    // the entry the passage belongs to: the heading above it, or the one the map names (an entry already begun)
    const home = o.entry ? built.get(o.entry) : cur;
    if (!home) { errors.push(o.entry ? `${short} đoạn ${b.id}: "entry" ${o.entry} không phải một mục đứng trước đoạn này` : `${short}: khối ${b.id} nằm trước đề mục đầu tiên`); continue; }
    const e = byCode.get(home.code);
    const role = o.kind ?? inherit(e, 'kind') ?? 'general';
    if (!ROLES.has(role)) errors.push(`${short} đoạn ${b.id}: kind "${role}"`);
    const text = textOf(b);
    const p = { id: b.id, kind: b.kind, role, page: b.page ?? null, text, voice: voiceOf(map.source.code, b) };
    if (b.pages && b.pages.length > 1) p.pages = b.pages;
    if (b.label) p.label = b.label;
    if (b.en) p.en = b.en;
    if (b.label_en) p.labelEn = b.label_en;
    if (b.items) p.items = b.items;
    if (b.kind === 'table') { p.columns = b.columns; p.rows = b.rows; if (b.title !== undefined) p.title = b.title; }
    if (b.forms) { p.forms = b.forms; if (b.usage) p.usage = b.usage; }
    if (b.facet) p.facet = b.facet;
    home.paras.push(p);
    const when = o.when ?? inherit(e, 'when') ?? null;
    const topics = [o.topic ?? inherit(e, 'topic') ?? []].flat();
    if (role === 'rule' || (role === 'general' && o.when)) {
      if (!when) { errors.push(`${short} đoạn ${b.id} (${role}) chưa có điều kiện: "${text.slice(0, 70)}"`); continue; }
      if (!topics.length) { errors.push(`${short} đoạn ${b.id} (${role}) không thuộc phần luận nào`); continue; }
      const parsed = parse(when);
      for (const m of parsed.errors) errors.push(`${short} đoạn ${b.id}: điều kiện lỗi — ${m} — ${when}`);
      topics.forEach(tp => rules.push({
        i: `${short}.b${b.id}${topics.length > 1 ? `.${tp}` : ''}`, s: map.source.code, e: home.code, p: b.id, pg: b.page ?? null, t: text, w: when, k: role, tp, o: ord++,
        sy: [...symbolsOf(parsed.node)], v: p.voice, ...(p.label ? { lb: p.label } : {}), ...(p.en ? { en: p.en } : {}), ...(p.items ? { it: p.items } : {}),
      }));
    }
  }
  // a parent that lists the order of its sections (Woolfolk's table of the Nodes reads row by row across two columns):
  // each section, with everything under it, takes its place in that order
  for (const pe of map.entries.filter(x => x.children !== undefined)) {
    const kids = entries.filter(x => x.parent === pe.code).map(x => x.code);
    if (!Array.isArray(pe.children) || kids.length !== pe.children.length || kids.some(c => !pe.children.includes(c))) { errors.push(`${short}/${pe.code}: "children" phải là danh sách kể đủ và đúng các mục con`); continue; }
    const under = code => { const set = new Set([code]); for (const x of entries) if (x.parent && set.has(x.parent)) set.add(x.code); return entries.filter(x => set.has(x.code)); };
    const groups = pe.children.map(under);
    const moved = new Set(groups.flat());
    const start = Math.min(...groups.map(g => entries.indexOf(g[0])));
    const rest = entries.filter(x => !moved.has(x));
    entries.splice(0, entries.length, ...rest.slice(0, start), ...groups.flat(), ...rest.slice(start));
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
