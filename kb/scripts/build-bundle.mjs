// Builds the Tử vi import bundle the API loads into the database (kb/bundle/tuvi):
//   book.json        grandma's notebook, paragraph by paragraph (built by build-book.mjs)
//   rules.json       the digitized rules from tuvi/rules/*.json (reviewed by hand), each pointing back to its paragraph
//   supplement.json  the "bổ sung" layer — common knowledge, never grandma's
//   setup.json       grandma's Phần I: how to set up a chart
//   manifest.json    a hash of all of it: the API imports again only when the hash changes, and never overwrites a row
//                    someone edited in the database
// Run after any edit of a rule file: npm run kb:bundle (from the repo root)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(kb, 'bundle/tuvi');
const book = JSON.parse(fs.readFileSync(path.join(out, 'book.json'), 'utf8'));
const lines = new Set(book.entries.map(e => e.line));

const rules = [];
for (const f of fs.readdirSync(path.join(kb, 'tuvi/rules')).filter(f => f.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b))) {
  const d = JSON.parse(fs.readFileSync(path.join(kb, 'tuvi/rules', f), 'utf8'));
  if (!lines.has(d.entry)) throw new Error(`${f}: no entry ${d.entry}`);
  for (const r of d.rules) {
    const o = { i: r.id, e: d.entry, p: r.para, at: r.palaces, t: r.text, o: r.tone };
    if (r.ctx) o.c = r.ctx;
    if (r.when) o.w = r.when;
    if (r.review) o.r = r.review;
    rules.push(o);
  }
}
const ids = new Set();
for (const r of rules) { if (ids.has(r.i)) throw new Error(`duplicate rule id ${r.i}`); ids.add(r.i); }
fs.writeFileSync(path.join(out, 'rules.json'), JSON.stringify({ rules }));
for (const f of ['supplement.json', 'setup.json']) fs.copyFileSync(path.join(kb, 'tuvi', f), path.join(out, f));

const stars = fs.readFileSync(path.resolve(kb, '../engine/src/tuvi/stars.json'));
const hash = crypto.createHash('sha256');
for (const f of ['book.json', 'rules.json', 'supplement.json', 'setup.json']) hash.update(fs.readFileSync(path.join(out, f)));
hash.update(stars);
const manifest = { discipline: 'tuvi', version: hash.digest('hex').slice(0, 16), rules: rules.length, entries: book.entries.length, built: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${rules.length} rules · ${rules.filter(r => !r.w).length} kept as text only · ${rules.filter(r => r.r).length} with a review note · bundle ${manifest.version}`);
