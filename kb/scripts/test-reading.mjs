// Prints the reading of one chart (palace by palace counts, then one palace in full) — a quick end-to-end check.
// Run: node scripts/test-reading.mjs [yyyy-mm-dd] [hh] [nam|nu] [palace]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '@mystic/engine/tuvi';

const R = E;
const kbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = f => JSON.parse(fs.readFileSync(path.join(kbDir, f.startsWith('supplement') ? 'tuvi' : 'bundle/tuvi', f), 'utf8'));
const book = j('book.json'), raw = j('rules.json').rules, supp = j('supplement.json');
const star = new Map(book.entries.map(e => [e.line, e.star]));
const kb = {
  rules: R.compile(raw.map(r => ({ id: r.i, source: 'ba', entry: r.e, para: r.p, star: star.get(r.e), at: r.at, text: r.t, ctx: r.c, when: r.w, tone: r.o, review: r.r }))),
  supplement: R.compile(supp.stars.flatMap(s => s.rules.map(r => ({ id: r.id, source: 'bo-sung', star: s.star, at: r.palaces, text: r.text, when: r.when, tone: r.tone })))),
  palaceAbout: Object.fromEntries(supp.palaces.map(p => [p.palace, p.about])),
  principles: Object.fromEntries(supp.principles.map(p => [p.id, p])),
  starAbout: {}, entryName: Object.fromEntries(book.entries.map(e => [e.line, e.name])),
};
const [date = '1990-05-12', hh = '14', g = 'nam', show = 'Mệnh'] = process.argv.slice(2);
const [y, m, d] = date.split('-').map(Number);
const t0 = Date.now();
const chart = E.buildChart({ gender: g, calendar: 'solar', year: y, month: m, day: d, hour: +hh }, { ...E.defaultOptions(), viewYear: 2026 });
const views = R.VIEWS.map(v => R.readView(chart, kb, v));
const han = R.readHan(chart, kb, 2026);
console.log(`${date} ${hh}h ${g}: âm ${chart.lunar.day}/${chart.lunar.month}/${chart.lunar.year} · ${chart.amDuong} · ${chart.napAm.name} · ${chart.cuc.name} · ${Date.now() - t0}ms`);
for (const v of views) console.log(`  ${v.view.padEnd(11)} ${E.BRANCHES[v.branch].padEnd(5)} bà ${String(v.counts.ba).padStart(3)} (cát ${v.counts.cat}, hung ${v.counts.hung}) · bổ sung ${v.counts.boSung}`);
console.log(`  Hạn 2026: tuổi ${han.age}, đại hạn ${han.dai ? E.BRANCHES[han.dai.branch] : '-'} (${han.dai?.ba.reduce((n, g) => n + g.matches.length, 0) ?? 0} câu), tiểu hạn ${E.BRANCHES[han.tieu.branch]} (${han.tieu.ba.reduce((n, g) => n + g.matches.length, 0)} câu)`);
console.log('  bổ sung chung:', R.principlesFor(chart, kb).map(p => p.id).join(', '));
const v = views.find(x => x.view === show);
for (const gr of v.ba) {
  console.log(`\n  ── ${gr.name}${gr.inPalace ? '' : ' (từ cung khác)'}`);
  for (const mm of gr.matches) console.log(`     [${mm.rule.tone}] ${mm.rule.ctx ? `(${mm.rule.ctx}) ` : ''}${mm.rule.text}\n            ⟵ ${mm.why.join(' · ')}`);
}
