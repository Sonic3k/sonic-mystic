// How often does a rule's condition hold on real charts? Finds conditions that can never hold (a combination of
// stars that never meets) and conditions so broad they hold for almost everyone.
//   node scripts/check-reach.mjs <tuvi/rules/*.json …>          sample 3000 charts; rules never matched get an exhaustive check
//   node scripts/check-reach.mjs --expr "in(Cự Môn) & meet(Vũ Khúc)" [--palace "Quan Lộc"]   one condition
// Palace "*" or "Hạn" = any of the twelve palaces.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '@mystic/engine/tuvi';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const expr = opt('--expr'), onePalace = opt('--palace') ?? 'Mệnh', sampleN = Number(opt('--sample') ?? 3000);

const OPTS = E.defaultOptions();
// mulberry32 — a fixed seed, so two runs check the same charts
let seed = 12345;
const rnd = n => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296 * n) | 0;
};
const chartOf = (year, month, day, hour, gender) =>
  E.buildChart({ gender, calendar: 'lunar', year, month, day, hour }, OPTS, true);
const sample = Array.from({ length: sampleN }, () => chartOf(1924 + rnd(120), 1 + rnd(12), 1 + rnd(30), rnd(12), rnd(2) ? 'nam' : 'nu'));

/** branches of the chart where the rule is read */
const ROLE = new Map();
const roleOf = t => { if (!ROLE.has(t)) ROLE.set(t, E.findTarget(t)); return ROLE.get(t); };
function branchesFor(chart, palaces) {
  const out = new Set();
  for (const t of palaces) {
    if (t === '*' || t === 'Hạn') for (let b = 0; b < 12; b++) out.add(b);
    else if (t === 'Thân') out.add(chart.than);
    else { const r = roleOf(t), c = chart.palaces.find(p => p.role === r); if (c) out.add(c.branch); }
  }
  return [...out];
}
const holds = (chart, node, palaces) => branchesFor(chart, palaces).some(p =>
  E.evaluate(node, { chart, p, inHan: palaces.includes('Hạn'), han: { dai: p, tieu: p } }).ok);

function exhaustive(node, palaces) {
  for (let y = 1984; y < 2044; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 30; d++) for (let h = 0; h < 12; h++)
    for (const g of ['nam', 'nu']) if (holds(chartOf(y, m, d, h, g), node, palaces)) return { y, m, d, h, g };
  return null;
}

if (expr) {
  const p = E.parse(expr);
  if (!p.node) { console.log('✗', p.errors.join('; ')); process.exit(1); }
  const palaces = onePalace.split(',').map(s => s.trim());
  const n = sample.filter(c => holds(c, p.node, palaces)).length;
  console.log(`${expr}  @ ${palaces.join(',')}: ${n}/${sampleN} charts (${((100 * n) / sampleN).toFixed(1)}%)`);
  if (!n) { const ex = exhaustive(p.node, palaces); console.log(ex ? `possible, e.g. lunar ${ex.d}/${ex.m}/${ex.y} giờ ${ex.h} ${ex.g}` : 'NEVER holds on any chart (checked all 518,400 birth combinations)'); }
  process.exit(0);
}

let never = 0, broad = 0;
for (const f of argv) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const r of data.rules ?? []) {
    if (!r.when) continue;
    const p = E.parse(r.when);
    if (!p.node) { console.log(`✗ ${r.id}: ${p.errors.join('; ')}`); continue; }
    const n = sample.filter(c => holds(c, p.node, r.palaces)).length;
    if (n === 0) {
      const ex = exhaustive(p.node, r.palaces);
      if (!ex) { never++; console.log(`NEVER ${r.id}: ${r.when}   «${r.text.slice(0, 70)}»`); }
      else console.log(`rare  ${r.id}: holds e.g. lunar ${ex.d}/${ex.m}/${ex.y} giờ ${ex.h} ${ex.g}`);
    } else if (n / sampleN > 0.7 && !r.palaces.includes('*') && !r.palaces.includes('Hạn')) {
      broad++; console.log(`broad ${r.id}: ${((100 * n) / sampleN).toFixed(0)}% — ${r.when}`);
    }
  }
}
console.log(`never: ${never} · broad (>70%): ${broad}`);
