// Prints the numerology reading of one person from the built bundle — section by section, with why each passage was
// chosen — a quick end-to-end check of the map.
// Run: node scripts/test-numerology.mjs [d/m/yyyy] [name] [male|female] [full]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as N from '@mystic/engine/numerology';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bundle/numerology');
const j = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const book = j('book.json'), raw = j('rules.json').rules;
const kb = {
  rules: N.compile(raw.map(r => ({ id: r.i, topic: r.tp, entry: r.e, ord: r.o, page: r.pg, kind: r.k, text: r.t, when: r.w }))),
  entries: Object.fromEntries(book.entries.map((e, i) => [e.code, { code: e.code, title: e.title, parent: e.parent ?? undefined, ord: i }])),
};
const [date = '1/5/1974', name = 'Quỳnh', gender = 'female', full] = process.argv.slice(2);
const [day, month, year] = date.split('/').map(Number);
const chart = N.buildNumerology({ day, month, year, gender, names: name ? [{ text: name }] : [], asOf: { year: 2026, month: 10, day: 15 } });
const t0 = Date.now();
const r = N.readNumerology(chart, kb);
const g = chart.grid;
console.log(`${date} ${name} (${gender}) · chủ đạo ${N.label(chart.ruling)} · ngày sinh ${N.label(chart.birthday)} · mũi tên ${g.arrows.join(' ') || '—'} · trống ${g.empty.join(' ') || '—'} · cô lập ${g.isolated.join(' ') || '—'}`);
const n = chart.names[0];
if (n) console.log(`  tên ${n.text}: linh hồn ${N.label(n.soul)} · biểu đạt ${N.label(n.expression)} · tên riêng ${N.label(n.nameNumber)} (${n.relation}) · bù ${n.effect.compensates} · dồn ${n.effect.reinforces}`);
console.log(`  đỉnh ${chart.pyramid.peaks.map(p => `${p.n}@${p.age}`).join(' ')} · năm cá nhân ${chart.now.year.n} (${chart.now.year.start}→${chart.now.year.end}) · giai đoạn ${chart.now.stage}`);
console.log(`  ${r.matched} đoạn khớp · ${Date.now() - t0} ms`);
let words = 0;
for (const s of r.sections) {
  console.log(`\n# ${s.title}${s.focus ? ` — ${s.focus}` : ''}`);
  for (const gr of s.groups) {
    console.log(`  ## ${gr.path.slice(1).join(' › ') || gr.title}`);
    for (const m of gr.matches) {
      words += m.rule.text.split(/\s+/).length;
      console.log(`    [${m.rule.kind}] tr.${m.rule.page} ${full ? m.rule.text : m.rule.text.slice(0, 90)}${m.why.length ? `  ← ${m.why.join('; ')}` : ''}`);
    }
  }
}
console.log(`\n${words} chữ`);
