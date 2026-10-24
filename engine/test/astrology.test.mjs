// The astrology engine against published charts and cô Hương Kiều's own definitions: Oprah Winfrey's chart as
// Woolfolk prints it (The Only Astrology Book You'll Ever Need, ch. 9 — the fixture holds the positions the Swiss
// Ephemeris gives for it), her table of Vượng – Tướng – Tù – Tử, her orbs, the structures of her glossary and
// Tierney's book, her test of the dominant planets, and the condition language.
// Runs on the built output: npm run build -w @mystic/engine && npm test -w @mystic/engine
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../dist/astrology/index.js';

const oprah = JSON.parse(fs.readFileSync(new URL('./fixtures/oprah-winfrey.json', import.meta.url), 'utf8'));
const chart = A.buildAstroChart(oprah);

test("Oprah Winfrey's chart as Woolfolk prints it (p. 322)", () => {
  // "Ascendant is 29 Sagittarius; The Sun is in 9° Aquarius in the Second House; …"
  const BOOK = [
    ['asc', 'sagittarius', 29, null, false], ['sun', 'aquarius', 9, 2, false], ['moon', 'sagittarius', 4, 11, false],
    ['mercury', 'aquarius', 19, 2, false], ['venus', 'aquarius', 8, 2, false], ['mars', 'scorpio', 23, 11, false],
    ['jupiter', 'gemini', 16, 6, true], ['saturn', 'scorpio', 9, 10, false], ['uranus', 'cancer', 20, 7, true],
    ['neptune', 'libra', 26, 10, true], ['pluto', 'leo', 24, 8, true],
  ];
  for (const [b, sign, deg, house, retro] of BOOK) {
    const p = chart.placements[b];
    assert.equal(p.sign, sign, b);
    assert.ok(Math.abs(p.deg - deg) <= 1, `${b}: ${p.deg} vs ${deg}`);
    if (house) assert.equal(p.house, house, `${b} house`);
    assert.equal(p.retro, retro, `${b} retro`);
  }
  assert.equal(chart.placements.sun.text, "8°59' Bảo Bình");
  assert.deepEqual(chart.rulers.chart, ['jupiter']);
  assert.equal(chart.houses[0].sign, 'sagittarius');
  assert.equal(chart.placements['south-node'].sign, 'cancer');
  assert.equal(chart.placements.ic.house, 4);
});

test('her table of Vượng – Tướng – Tù – Tử (p. 29)', () => {
  assert.deepEqual(A.dignitiesOf('mercury', 'virgo'), ['ruler', 'exaltation']);
  assert.deepEqual(A.dignitiesOf('sun', 'aquarius'), ['detriment']);
  assert.deepEqual(A.dignitiesOf('mars', 'scorpio'), ['ruler']);
  assert.deepEqual(A.dignitiesOf('venus', 'virgo'), ['fall']);
  assert.deepEqual(A.dignitiesOf('neptune', 'cancer'), ['exaltation']);
  assert.deepEqual(A.dignitiesOf('pluto', 'virgo'), ['fall']);
  assert.deepEqual(chart.placements.jupiter.dignities, ['detriment']);
  // every planet rules, is exalted in, falls in and is in detriment in some sign; fall is opposite exaltation
  for (const [p, d] of Object.entries(A.DIGNITIES)) {
    for (const k of ['ruler', 'exaltation', 'detriment', 'fall']) assert.ok(d[k].length, `${p} ${k}`);
    d.exaltation.forEach((s, i) => assert.equal((A.SIGN[s].index + 6) % 12, A.SIGN[d.fall[i]].index, `${p}: fall opposite exaltation`));
  }
});

test('her orbs: "lên đến X hay Y độ", the wider with Mặt Trời or Mặt Trăng', () => {
  assert.equal(A.aspectBetween('mars', 0, 'saturn', 125.5), null);
  assert.equal(A.aspectBetween('sun', 0, 'saturn', 126.5).aspect, 'trine');
  assert.equal(A.aspectBetween('mars', 10, 'venus', 14.9).aspect, 'conjunction');
  assert.equal(A.aspectBetween('mars', 10, 'venus', 15.1), null);
  assert.equal(A.aspectBetween('moon', 10, 'venus', 19.9).aspect, 'conjunction');
  assert.equal(A.aspectBetween('mars', 0, 'venus', 31.5), null);
  assert.equal(A.aspectBetween('mars', 0, 'venus', 30.9).aspect, 'semisextile');
  assert.equal(A.aspectBetween('mars', 359, 'venus', 1).aspect, 'conjunction');
  // out of sign: 2° Bạch Dương and 29° Kim Ngưu are a sextile one sign apart, not two
  const c = synth({ mars: 2, venus: 59, saturn: 200 });
  const s = c.aspects.find(a => a.a === 'venus' && a.b === 'mars' || a.a === 'mars' && a.b === 'venus');
  assert.equal(s.aspect, 'sextile');
  assert.equal(s.outOfSign, true);
});

/** a chart from longitudes alone, with equal houses from 0° Bạch Dương; Mặt Trời and Mặt Trăng, when not given, are
    put where they make no aspect to the bodies given (only those bodies are in the chart) */
function synth(lons, withHouses = true) {
  const bodies = {};
  for (const [k, v] of Object.entries(lons)) bodies[k] = { lon: v, speed: 1 };
  for (const lum of ['sun', 'moon']) {
    if (lum in bodies) continue;
    const others = Object.entries(bodies);
    let spot = null;
    for (let v = 0.25; v < 360 && spot === null; v += 0.5) if (others.every(([k, b]) => !A.aspectBetween(lum, v, k, b.lon))) spot = v;
    bodies[lum] = { lon: spot ?? 0.25, speed: 1 };
  }
  return A.buildAstroChart({
    local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 }, jd: 2451545, utcOffsetMinutes: 0, place: null, timeKnown: withHouses,
    positions: { bodies, houses: withHouses ? { cusps: Array.from({ length: 12 }, (_, i) => i * 30), asc: 0, mc: 270, vertex: 180 } : null },
  });
}

test('the structures of her glossary and of Tierney', () => {
  const kinds = c => c.patterns.map(p => p.kind).sort();
  // tam giác lớn Lửa: 1° Bạch Dương, 3° Sư Tử, 2° Nhân Mã
  let c = synth({ mars: 1, jupiter: 123, saturn: 242 });
  let p = c.patterns.find(x => x.kind === 'grand-trine');
  assert.deepEqual(p.bodies, ['mars', 'jupiter', 'saturn']);
  assert.equal(p.element, 'fire');
  // con diều: with a fourth planet opposite one and sextile the other two
  c = synth({ mars: 1, jupiter: 123, saturn: 242, venus: 181 });
  assert.ok(kinds(c).includes('kite'));
  // chữ T Cốt yếu with Sao Mộc at its đỉnh; out of the angular houses
  c = synth({ mars: 5, saturn: 184, jupiter: 93 });
  p = c.patterns.find(x => x.kind === 't-square');
  assert.equal(p.apex, 'jupiter');
  assert.equal(p.modality, 'cardinal');
  assert.equal(p.angular, true);
  // đại thập tự Kiên định: no chữ T read apart from it
  c = synth({ mars: 35, venus: 125, saturn: 215, jupiter: 305 });
  assert.equal(c.patterns.filter(x => x.kind === 'grand-cross').length, 1);
  assert.equal(c.patterns.find(x => x.kind === 'grand-cross').modality, 'fixed');
  assert.equal(c.patterns.filter(x => x.kind === 't-square').length, 0);
  // ngón tay định mệnh: two planets sextile, both quincunx a third
  c = synth({ mars: 10, venus: 70, pluto: 220 });
  p = c.patterns.find(x => x.kind === 'yod');
  assert.equal(p.apex, 'pluto');
  // hình chữ nhật thần bí
  c = synth({ mars: 10, venus: 70, saturn: 190, jupiter: 250 });
  assert.ok(kinds(c).includes('mystic-rectangle'));
  // quạt xếp: three in one sign
  c = synth({ mars: 2, venus: 12, mercury: 25 });
  assert.equal(c.patterns.find(x => x.kind === 'stellium').sign, 'aries');
  // Oprah: chữ T Kiên định Sao Thủy – Diêm Vương with Sao Hỏa at its đỉnh, and three planets in Bảo Bình
  p = chart.patterns.find(x => x.kind === 't-square');
  assert.equal(p.apex, 'mars');
  assert.equal(p.modality, 'fixed');
  assert.ok(chart.patterns.some(x => x.kind === 'stellium' && x.sign === 'aquarius'));
});

test('her test of the dominant planets ("Đi tìm nhân tố trội")', () => {
  const t = b => chart.dominant.tests.find(x => x.body === b);
  // Mặt Trời: đồng vị Sao Kim and vuông góc Sao Thổ (6 each), Diêm Vương ở Sư Tử (5), in the quạt xếp of Bảo Bình (5)
  assert.equal(t('sun').total, 22);
  assert.equal(t('sun').level, 'medium');
  assert.deepEqual(t('sun').items.map(i => i.line), [3, 3, 6, 10]);
  // Sao Thủy: the chart's ruler (Sao Mộc, for cung Mọc Nhân Mã) is in Song Tử — 10 once
  assert.ok(t('mercury').items.some(i => i.line === 4 && i.points === 10 && /chủ tinh lá số/.test(i.why)));
  assert.equal(t('mercury').level, 'very-strong');
  // Sao Kim, PHIÊN BẢN 2 adds Kim Ngưu and cung 2 (Sao Kim is in cung 2: +5; Mặt Trời and Sao Thủy there…)
  assert.ok(t('venus').withTaurus.total > t('venus').total);
  // Sao Thổ in cung 10, not đồng vị MC: +5
  assert.ok(t('saturn').items.some(i => i.line === 5 && i.points === 5));
  // Hải Vương đồng vị MC within the 10° allowed for the angles
  assert.ok(t('neptune').items.some(i => i.line === 1 && /MC/.test(i.why)));
  for (const x of chart.dominant.tests) assert.equal(x.total, x.items.reduce((n, i) => n + i.points, 0));
  // without the time: no lines for AC, MC or houses, and the test says so
  const noon = A.buildAstroChart({ ...oprah, timeKnown: false });
  assert.equal(noon.houses, null);
  assert.ok(noon.dominant.tests.every(x => x.partial));
  assert.ok(noon.notes.length >= 1);
});

test('her test against the class\'s homework "Nộp bài tính nhân tố trội"', () => {
  // the chart the homework scores, found from what it lists (Mặt Trời 3° Nhân Mã on the AC in cung 12, Mặt Trăng 29° Sư Tử
  // on the MC in cung 9, Sao Thổ Song Ngư in cung 3, Thiên Vương and Hải Vương Ma Kết in cung 2, Sao Kim in cung 11…)
  const hw = A.buildAstroChart(JSON.parse(fs.readFileSync(new URL('./fixtures/class-homework.json', import.meta.url), 'utf8')));
  const t = b => hw.dominant.tests.find(x => x.body === b);
  const has = (b, line, points, re) => assert.ok(t(b).items.some(i => i.line === line && i.points === points && re.test(i.why)), `${b}: line ${line} +${points} ${re}`);
  // Nhật kế: "Sun đồng vị AC: 15 · Sun vuông góc MC: 10 · Sun vuông góc Moon: 10 · Sun đồng vị Jupiter, Pluto, vuông góc
  // Saturn: 6 · Sun Venus: 4 · Moon Leo: 10 · Mar Leo: 5 · Sun thuộc cấu trúc T-square: 5"
  has('sun', 1, 15, /đồng vị AC/); has('sun', 1, 10, /vuông góc MC/); has('sun', 1, 10, /vuông góc Mặt Trăng/);
  has('sun', 3, 6, /Sao Mộc/); has('sun', 3, 6, /Sao Thổ/); has('sun', 3, 6, /Diêm Vương/); has('sun', 4, 4, /Sao Kim/);
  has('sun', 5, 10, /Mặt Trăng ở Sư Tử/); has('sun', 6, 5, /Sao Hỏa ở Sư Tử/); has('sun', 10, 5, /chữ T/);
  // "Fortuna ở Sư tử: 3": her line 9 leaves it to the reader — listed, not counted
  assert.ok(t('sun').choices.some(c => c.line === 9 && /Fortuna ở Sư Tử/.test(c.why)));
  assert.ok(!t('sun').items.some(i => /Fortuna/.test(i.why)));
  // Kim tinh kế 11, "Tính Kim ngưu: Uranus cung 2: 3, Neptune cung 2: 3"
  assert.deepEqual(t('venus').withTaurus.items.filter(i => i.line === 15).map(i => i.points), [3, 3]);
  // Hỏa tinh kế: "Mars ở Leo: 5" (Sao Hỏa in another fire sign)
  has('mars', 5, 5, /Sao Hỏa ở Sư Tử/);
  // Mộc tinh kế: "AC Sagittarius: 10 · Mặt trời Sagittarius: 5 · Moon cung 9: 5 · Mar cung 9: 3"; "Fortuna cung 9" is the reader's
  has('jupiter', 4, 10, /AC ở Nhân Mã/); has('jupiter', 4, 5, /Mặt Trời ở Nhân Mã/); has('jupiter', 7, 5, /Mặt Trăng ở cung 9/); has('jupiter', 8, 3, /Sao Hỏa ở cung 9/);
  assert.ok(t('jupiter').choices.some(c => /Fortuna ở cung 9/.test(c.why)));
  // Thổ tinh kế: "Moon có độ lệch góc vs MC: 5" (within 10° of the MC, from cung 9)
  has('saturn', 7, 5, /Mặt Trăng cách MC/);
  // Chiron kế, "Vùng Chiron: … Sun Sagittarius: 2"
  has('chiron', 6, 2, /Mặt Trời ở Nhân Mã/); has('chiron', 5, 5, /Chiron ở Xử Nữ/); has('chiron', 4, 5, /MC ở Xử Nữ/);
  for (const x of hw.dominant.tests) assert.equal(x.total, x.items.reduce((n, i) => n + i.points, 0));
});

test('Tử Khí by her spreadsheet: 310.58° on 1/6/2009, 0.0352° a day', () => {
  assert.equal(+A.ziqiAt(A.ZIQI_EPOCH_JD).toFixed(2), 310.58);
  assert.equal(+A.ziqiAt(A.ZIQI_EPOCH_JD + 1000).toFixed(2), 345.78);
  assert.equal(A.signOf(A.ziqiAt(A.ZIQI_EPOCH_JD + 2000)), 'aries');
});

test('a condition in words, and what it speaks of', () => {
  assert.equal(A.describeWhen('in(moon, sagittarius)'), 'Mặt Trăng ở Nhân Mã');
  assert.equal(A.describeWhen('focus(mercury) & in(mercury, aquarius)'), 'Sao Thủy ở Bảo Bình');
  assert.equal(A.describeWhen('aspect(sun, saturn, square, opposition)'), 'Mặt Trời vuông góc hay xung Sao Thổ');
  assert.equal(A.describeWhen('pattern(t-square, fixed) & apex(t-square, mars)'), 'Có Chữ T, thể thức Kiên định, Sao Hỏa là đỉnh của Chữ T');
  assert.equal(A.describeWhen('focus(sun) & dominant(self, low)'), 'Mặt Trời trội (thấp)');
  assert.equal(A.describeWhen('focus(mars)'), 'Phần đọc Sao Hỏa');
  assert.equal(A.describeWhen('in(sun, aries) & female()'), 'Mặt Trời ở Bạch Dương, nữ');
  // a "self" read in one body's section speaks of that body
  assert.ok(A.symbolsOf(A.parse('focus(sun) & dominant(self)').node).has('dominant:sun'));
});

test('the condition language', () => {
  const ev = (src, x = {}) => { const r = A.parse(src); assert.deepEqual(r.errors, [], src); return A.evaluate(r.node, { chart, ...x }); };
  assert.ok(ev('in(sun, aquarius)').ok);
  assert.deepEqual(ev('in(sun, aquarius)').why, ["Mặt Trời ở Bảo Bình (8°59')"]);
  assert.ok(ev('house(saturn, 10) & aspect(sun, saturn, square)').ok);
  assert.ok(!ev('aspect(sun, saturn, soft)').ok);
  assert.ok(ev('pattern(t-square, fixed) & apex(t-square, mars)').ok);
  assert.ok(ev('dominant(mercury, very-strong)').ok);
  assert.ok(ev('ruler(jupiter) & sun_ruler(uranus) & moon_ruler(jupiter)').ok);
  assert.ok(ev('in(self, scorpio) & house(self, 10-11)', { focus: 'mars' }).ok);
  assert.ok(ev('cusp(self, sagittarius)', { house: 1 }).ok);
  assert.ok(ev('decan(sun, aquarius, 1) & in_own(mars) & retro(pluto)').ok);
  assert.ok(ev('element(air, 5) & modality(fixed, 6+) & element(earth, 0)').ok);
  assert.ok(ev('hemisphere(east, 7) & !hemisphere(west, 4+)').ok);
  assert.ok(ev('dignity(sun, detriment)').ok);
  assert.ok(!ev('sun_cusp(capricorn, aquarius)').ok);
  assert.ok(ev('sun_cusp(pisces, aries)', { chart: synth({ sun: 357 }) }).ok);
  assert.ok(ev('sun_cusp(pisces, aries)', { chart: synth({ sun: 4.5 }) }).ok);
  assert.ok(!ev('sun_cusp(pisces, aries)', { chart: synth({ sun: 6 }) }).ok);
  assert.ok(ev('reception(venus, mars)', { chart: synth({ venus: 10, mars: 40 }) }).ok);
  for (const bad of ['in(sun, arie)', 'house(moon, 13)', 'aspect(sun, moon, sqaure)', 'pattern(kite, purple)', 'dominant(sun, huge)', 'foo(1)', 'in(sun'])
    assert.ok(A.parse(bad).errors.length, bad);
  assert.deepEqual([...A.symbolsOf(A.parse('in(mercury, gemini) & house(mercury, 3) & aspect(sun, moon, square)').node)].sort(),
    ['aspect:square', 'body:mercury', 'body:moon', 'body:sun', 'house:3', 'mercury@gemini', 'mercury@h3', 'moon~sun', 'sign:gemini']);
});

// ── how much each part of a chart weighs (weigh.ts): one set of rules for every chart ──
/** a chart from longitudes (and daily speeds), with equal houses whose first cusp is at `cusp1` */
function sky(lons, { cusp1 = 0, speeds = {} } = {}) {
  const bodies = {};
  for (const [k, v] of Object.entries(lons)) bodies[k] = { lon: v, speed: speeds[k] ?? 1 };
  for (const lum of ['sun', 'moon']) {
    if (lum in bodies) continue;
    let spot = null;
    for (let v = 0.25; v < 360 && spot === null; v += 0.5) if (Object.entries(bodies).every(([k, b]) => !A.aspectBetween(lum, v, k, b.lon))) spot = v;
    bodies[lum] = { lon: spot ?? 0.25, speed: 1 };
  }
  const cusps = Array.from({ length: 12 }, (_, i) => (cusp1 + i * 30) % 360);
  return A.buildAstroChart({
    local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 }, jd: 2451545, utcOffsetMinutes: 0, place: null, timeKnown: true,
    positions: { bodies, houses: { cusps, asc: cusps[0], mc: cusps[9], vertex: (cusps[6] + 3) % 360 } },
  });
}
const factor = (c, id) => c.weights.factors.find(f => f.id === id);
const rulesOf = f => f.reasons.map(r => r.rule);

test('weighing: the lights, the rising sign and its ruler govern every chart (K1)', () => {
  for (const id of ['sun', 'moon', 'asc', 'jupiter']) assert.equal(factor(chart, id).level, 'key', id);
  assert.ok(rulesOf(factor(chart, 'jupiter')).includes('K1'));
  // Oprah: Saturn and Neptune in cung 10, Uranus in cung 7, Chiron in cung 1 (K2); Mars in its own Scorpio (K4)
  for (const id of ['saturn', 'neptune', 'uranus', 'chiron']) assert.ok(rulesOf(factor(chart, id)).includes('K2'), id);
  assert.ok(rulesOf(factor(chart, 'mars')).includes('K4'));
  // Venus 0°08′ from the Sun (K6); the quạt xếp of Bảo Bình (K3); Pluto has none of it
  assert.ok(rulesOf(factor(chart, 'venus')).includes('K6'));
  assert.equal(factor(chart, 'stellium:sign:aquarius').level, 'key');
  assert.equal(factor(chart, 'pluto').level, 'normal');
  // the points on a planet or an angle are read in its part: La Hầu on Chiron, Tử Khí on Sao Thủy, Nguyệt Bột on the MC
  assert.equal(factor(chart, 'north-node').attachedTo, 'chiron');
  assert.equal(factor(chart, 'south-node').attachedTo, 'chiron');
  assert.equal(factor(chart, 'ziqi').attachedTo, 'mercury');
  assert.equal(factor(chart, 'lilith').attachedTo, 'house:10');
  for (const id of ['north-node', 'lilith', 'fortune', 'vertex']) assert.equal(factor(chart, id).level, 'normal', id);
  // a close major aspect to a light is key (K7); the loose Sun–Moon sextile (4°27′, over her 3°) standing alone is minor (M1)
  assert.equal(factor(chart, 'aspect:saturn|sun').level, 'key');
  assert.equal(factor(chart, 'aspect:moon|sun').level, 'minor');
  // every rule a reason names is one of the rules
  for (const f of chart.weights.factors) for (const r of [...f.reasons, ...f.notes]) if (r.rule) assert.ok(A.WEIGH_RULE[r.rule], r.rule);
});

test('weighing: a stellium of the slow planets alone is a generation\'s; with a personal planet, or in one house, it governs', () => {
  // cusps at 15°: Ma Kết (270–300) runs across cung 9 and cung 10
  let c = sky({ saturn: 280, uranus: 286, neptune: 290 }, { cusp1: 15 });
  let st = factor(c, 'stellium:sign:capricorn');
  assert.equal(st.level, 'normal');
  assert.ok(st.notes.some(n => n.rule === 'K3'));
  c = sky({ saturn: 280, uranus: 286, neptune: 290, mercury: 283 }, { cusp1: 15 });
  assert.equal(factor(c, 'stellium:sign:capricorn').level, 'key');
  c = sky({ saturn: 290, uranus: 296, neptune: 299 }, { cusp1: 15 });
  assert.equal(factor(c, 'stellium:sign:capricorn').level, 'key');
  // a member is read in the stellium: the cluster is the key factor, not each planet on its own
  assert.ok(factor(c, 'saturn').notes.some(n => n.rule === 'K3'));
});

test('weighing: own sign promotes, but not the slow planets; Tù alone never demotes', () => {
  // Sao Kim in Bò Cạp (Tù), cung 8, with no close major aspect and no stellium: weak on all counts (M2)
  const base = { saturn: 205, jupiter: 250, mars: 333 };
  let c = sky({ ...base, venus: 220 });
  assert.equal(factor(c, 'venus').level, 'minor');
  assert.ok(rulesOf(factor(c, 'venus')).includes('M2'));
  // the same Sao Kim in cung 7, a cung góc: Tù is a note, not a reason
  c = sky({ ...base, venus: 220 }, { cusp1: 30 });
  assert.equal(factor(c, 'venus').level, 'key');
  assert.ok(factor(c, 'venus').notes.some(n => n.rule === 'M2'));
  // in Thiên Bình, its own sign: K4
  c = sky({ ...base, venus: 190 });
  assert.ok(rulesOf(factor(c, 'venus')).includes('K4'));
  // Diêm Vương in Bò Cạp: the sign is a generation's (hk.b812) — noted, not promoted
  c = sky({ ...base, pluto: 222 });
  assert.ok(!rulesOf(factor(c, 'pluto')).includes('K4'));
  assert.ok(factor(c, 'pluto').notes.some(n => n.rule === 'K4' && /thế hệ/.test(n.why)));
  // without the time nothing is put among the minor for being weak (angularity cannot be told)
  const noon = A.buildAstroChart({ ...oprah, timeKnown: false });
  assert.ok(noon.weights.factors.every(f => !(f.kind === 'body' && f.level === 'minor')));
  assert.ok(noon.weights.notes.length >= 1);
});

test('weighing: a stationary planet counts when it has another sign of strength (K6)', () => {
  let c = sky({ venus: 280, saturn: 100 }, { speeds: { venus: -0.01 } });
  assert.ok(factor(c, 'venus').reasons.some(r => r.rule === 'K6' && /Đứng yên/.test(r.why)));
  c = sky({ venus: 220, saturn: 205, jupiter: 250, mars: 333 }, { speeds: { venus: 0.01 } });
  assert.ok(factor(c, 'venus').notes.some(n => n.rule === 'K6' && /Đứng yên/.test(n.why)));
});

test('weighing: what changes at the ends of the birth-time window is listed', () => {
  // the sky 40 minutes on: every cusp and angle 10° further
  const h = oprah.positions.houses, on = x => (x + 10) % 360;
  const later = A.buildAstroChart({ ...oprah, positions: { ...oprah.positions, houses: { cusps: h.cusps.map(on), asc: on(h.asc), mc: on(h.mc), vertex: on(h.vertex) } } });
  const w = A.weighChart(chart, { alternates: [{ label: '+40′', chart: later }] });
  const changed = w.factors.filter(f => f.varies.some(v => v.startsWith('+40′')));
  assert.ok(changed.length > 0);
  // what does not differ is not listed
  assert.ok(w.factors.some(f => f.kind === 'body' && !f.varies.length));
});

test('a written reading checked against the weighing', () => {
  const w = chart.weights;
  const sec = (title, weight, factors, text = 'x', refs = ['woolfolk.b4']) => ({ title, weight, factors, items: [{ layer: 'primary', text, refs }] });
  // Pluto put among the minor for "not a planet"-like reasons, and the key factors not all read at key level
  let warn = A.checkAstrologyReading([sec('Cách cân', 'intro', []), sec('Mặt Trời', 'key', ['sun']), sec('Diêm Vương', 'minor', ['pluto'], 'Điểm phụ, bài test của cô không tính.')], w);
  assert.ok(warn.some(x => /Ít tác dụng, nhưng pluto là Tô thêm/.test(x)));
  assert.ok(warn.some(x => /lấy «điểm phụ» làm lý do/.test(x)));
  assert.ok(warn.some(x => /chưa được đọc ở phần Trọng điểm/.test(x) && /Sao Mộc/.test(x)));
  // a key section with nothing key in it; no factors at all
  warn = A.checkAstrologyReading([sec('Cách cân', 'intro', []), sec('Diêm Vương', 'key', ['pluto'])], w);
  assert.ok(warn.some(x => /ghi Trọng điểm, nhưng/.test(x)));
  warn = A.checkAstrologyReading([{ title: 'Mặt Trời', weight: 'key', items: [{ layer: 'primary', text: 'x' }] }], w);
  assert.ok(warn.some(x => /Cách cân/.test(x)) && warn.some(x => /factors/.test(x)) && warn.some(x => /không dẫn đoạn nào/.test(x)));
  // a minor line the weighing itself puts there is fine
  warn = A.checkAstrologyReading([sec('Cách cân', 'intro', []), sec('Góc lỏng', 'minor', ['aspect:moon|sun'], 'Lỏng, 4°27′, thấp')], w);
  assert.ok(!warn.some(x => /làm lý do/.test(x)));
});

test('a Nhận định: plain prose, long enough to be a reading', async () => {
  const R = await import('../dist/readings.js');
  let warn = R.checkSummary([{ title: 'Con người', items: [{ layer: 'added', text: 'Mặt Trời lệch 1°17′, 3°02′ và 6°56′ (hk.b828).' }] }]);
  assert.ok(warn.some(x => /chữ/.test(x)) && warn.some(x => /số đo độ/.test(x)) && warn.some(x => /mã nguồn/.test(x)));
  // eleven paragraphs of a hundred words: a reading's length, a paragraph each
  const para = Array.from({ length: 100 }, (_, i) => (i % 12 ? 'chữ' : 'Bạn')).join(' ');
  const secs = Array.from({ length: 11 }, (_, i) => ({ title: `Đoạn ${i + 1}`, items: [{ layer: 'added', text: para }] }));
  assert.deepEqual(R.checkSummary(secs), []);
  // the page shows a section as one paragraph: two in one section, or one far too long, is said
  warn = R.checkSummary([{ title: 'Con người', items: [{ layer: 'added', text: `${para}\n\nĐoạn hai.` }] }, ...secs]);
  assert.ok(warn.some(x => /nhiều đoạn/.test(x)));
  warn = R.checkSummary([{ title: 'Con người', items: [{ layer: 'added', text: Array(11).fill(para).join(' ') }] }]);
  assert.ok(warn.some(x => /quá dài/.test(x)));
});

test('the weighting rules cite passages of the sources, and say where a book disagrees', () => {
  const block = /^(hk|hk-keywords|hk-dominant|hk-aries|hk-notes|tierney|woolfolk|books)\.b\d+$/;
  for (const r of A.WEIGH_RULES) {
    assert.ok(r.refs.length && r.refs.every(x => block.test(x)), r.code);
    // hers first (her own words, then her class's notes), before Tierney, Woolfolk and the other books
    const firstOther = r.refs.findIndex(x => !x.startsWith('hk'));
    assert.ok(firstOther < 0 || !r.refs.slice(firstOther).some(x => x.startsWith('hk')), r.code);
    for (const x of r.against ?? []) assert.ok(block.test(x) && r.applied?.includes(x), `${r.code}: ${x} is said in its Cách áp`);
    for (const x of (r.applied ?? '').match(/\b[a-z-]+\.b\d+\b/g) ?? []) assert.ok(block.test(x), `${r.code}: ${x}`);
  }
  for (const p of A.WEIGH_PRINCIPLES) assert.ok(p.refs.every(x => block.test(x)), p.text);
  assert.match(A.ASTROLOGY_READING_SPEC, /Nguyên tắc cân/);
  assert.ok(!/sách ngoài kho/.test(A.ASTROLOGY_READING_SPEC));
});
