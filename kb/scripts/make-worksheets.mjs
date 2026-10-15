// One readable worksheet per star entry for digitizing: every paragraph with its id, kind and palace section.
// Run: npm run kb:book (from the repo root)  → kb/work/<line>-<star>.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const kb = path.resolve(dir, '..');
const book = JSON.parse(fs.readFileSync(path.join(kb, 'bundle/tuvi/book.json'), 'utf8'));
const out = path.join(kb, 'work');
fs.mkdirSync(out, { recursive: true });
for (const e of book.entries) {
  const lines = [`# ${e.name}  — entry ${e.line}, star id ${e.star}`, ''];
  for (const p of e.paras) lines.push(`[${p.id}] ${p.kind} | ${p.sec ? p.sec.join('+') : 'chung'} | ${p.text}`);
  fs.writeFileSync(path.join(out, `${e.line}-${e.star}.txt`), lines.join('\n') + '\n');
}
console.log(`${book.entries.length} worksheets`);
