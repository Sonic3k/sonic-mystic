// The numerology engine against the book's own examples (Lê Đỗ Quỳnh Hương, Thay đổi cuộc sống với Nhân số học):
// every birth chart drawn in the book, the arrows it names, the isolated numbers it circles, the names it works out,
// the pyramids, the personal years and the year lengths of "Các khúc giao thời".
// Runs on the built output: npm run build -w @mystic/engine && npm test -w @mystic/engine
import test from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../dist/numerology/index.js';

const chart = (date, more = {}) => {
  const [day, month, year] = date.split('/').map(Number);
  return N.buildNumerology({ day, month, year, asOf: { year: 2026, month: 10, day: 15 }, ...more });
};
const cells = g => N.GRID_ROWS.map(r => r.map(n => (g.counts[n] ? N.cellText(n, g.counts[n]) : '-')).join(' ')).join(' / ');

test('Con số chủ đạo (Phần 5) and Con số ngày sinh (Phần 8)', () => {
  const R = { '27/5/1983': 8, '16/8/1999': 7, '11/5/1992': 10, '7/5/1970': 11, '26/11/1973': 3, '1/5/1974': 9, '7/10/1984': 3,
    '21/4/1926': 7, '7/11/1988': 8, '15/5/2008': 3, '23/9/1970': 4, '28/2/2020': 7, '25/7/1993': 9, '15/2/1959': 5 };
  for (const [d, n] of Object.entries(R)) assert.equal(chart(d).ruling, n, d);
  // the book prints "Con số chủ đạo 10" for 28/9/1988 (Hình 101); by its own method 2+8+9+1+9+8+8 = 45 → 9
  assert.equal(chart('28/9/1988').ruling, 9);
  // 22/4: a sum of exactly 22
  assert.equal(chart('1/2/1990').ruling, 22);
  assert.equal(chart('2/2/1990').ruling, 5);
  assert.equal(N.rulingOf([2, 2, 1, 9, 8]), 22);
  assert.equal(N.label(22), '22/4');
  // the table on pages 548–549
  const T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 3, 4, 5, 6, 7, 8, 9, 10, 2, 3, 22, 5, 6, 7, 8, 9, 10, 11, 3, 4];
  T.forEach((n, i) => assert.equal(N.birthdayOf(i + 1), n, `ngày ${i + 1}`));
});

const FIGURES = [
  ['27/5/1983', '3 - 9 / 2 5 8 / 1 - 7', ''],   // p.180
  ['11/11/1999', '- - 999 / - - - / 11111 - -', ''],   // p.193
  ['24/6/1980', '- 6 9 / 2 - 8 / 1 4 -', ''],   // p.196
  ['13/2/1977', '3 - 9 / 2 - - / 11 - 77', ''],   // p.202
  ['1/5/1974', '- - 9 / - 5 - / 11 4 7', ''],   // p.206
  ['11/7/1982', '- - 9 / 2 - 8 / 111 - 7', ''],   // p.207
  ['10/1/1971', '- - 9 / - - - / 1111 - 7', ''],   // p.209
  ['11/11/1993', '3 - 99 / - - - / 11111 - -', ''],   // p.213
  ['14/3/1973', '33 - 9 / - - - / 11 4 7', ''],   // p.245
  ['25/3/1987', '3 - 9 / 2 5 8 / 1 - 7', ''],   // p.258
  ['17/7/1977', '- - 9 / - - - / 11 - 7777', ''],   // p.294
  ['15/6/1976', '- 66 9 / - 5 - / 11 - 7', '1-5-9'],   // p.330
  ['15/11/1971', '- - 9 / - 5 - / 11111 - 7', '1-5-9'],   // p.335
  ['10/5/1995', '- - 99 / - 55 - / 11 - -', '1-5-9'],   // p.337
  ['22/9/1965', '- 6 99 / 22 5 - / 1 - -', '1-5-9'],   // p.340
  ['3/6/2007', '3 6 - / 2 - - / - - 7', '!1-5-9'],   // p.346
  ['24/6/2008', '- 6 - / 22 - 8 / - 4 -', '!1-5-9 !3-5-7'],   // p.348
  ['30/3/2006', '33 6 - / 2 - - / - - -', '!1-4-7 !1-5-9 !7-8-9'],   // p.350
  ['22/2/2000', '- - - / 2222 - - / - - -', '!1-4-7 !1-5-9 !3-5-7 !3-6-9 !4-5-6 !7-8-9'],   // p.352
  ['7/5/1973', '3 - 9 / - 5 - / 1 - 77', '1-5-9 3-5-7'],   // p.370
  ['7/3/2005', '3 - - / 2 5 - / - - 7', '3-5-7'],   // p.370
  ['26/5/1973', '3 6 9 / 2 5 - / 1 - 7', '1-2-3 1-5-9 3-5-7 3-6-9'],   // p.375
  ['25/7/1993', '3 - 99 / 2 5 - / 1 - 7', '1-2-3 1-5-9 3-5-7'],   // p.378
  ['28/9/1984', '- - 99 / 2 - 88 / 1 4 -', '!3-5-7'],   // p.384
  ['28/2/1964', '- 6 9 / 22 - 8 / 1 4 -', '!3-5-7'],   // p.385
  ['26/8/1988', '- 6 9 / 2 - 888 / 1 - -', '!3-5-7'],   // p.397
  ['19/6/1963', '3 66 99 / - - - / 11 - -', '!2-5-8 3-6-9'],   // p.408
  ['16/10/1973', '3 6 9 / - - - / 111 - 7', '!2-5-8 3-6-9'],   // p.412
  ['8/3/1976', '3 6 9 / - - 8 / 1 - 7', '3-6-9 7-8-9'],   // p.417
  ['12/10/2005', '- - - / 22 5 - / 11 - -', '!3-6-9 !7-8-9'],   // p.425
  ['2/3/1958', '3 - 9 / 2 5 8 / 1 - -', '1-2-3 1-5-9 2-5-8'],   // p.448
  ['10/2/1985', '- - 9 / 2 5 8 / 11 - -', '1-5-9 2-5-8'],   // p.452
  ['30/7/1993', '33 - 99 / - - - / 1 - 7', '!2-5-8 !4-5-6'],   // p.463
  ['16/4/1976', '- 66 9 / - - - / 11 4 7', '!2-5-8 1-4-7'],   // p.475
  ['28/2/2020', '- - - / 2222 - 8 / - - -', '!1-4-7 !1-5-9 !3-5-7 !3-6-9 !4-5-6'],   // p.485
  ['26/11/1973', '3 6 9 / 2 - - / 111 - 7', '1-2-3 3-6-9'],   // p.495
  ['15/4/1962', '- 6 9 / 2 5 - / 11 4 -', '1-5-9 4-5-6'],   // p.501
  ['25/4/1968', '- 6 9 / 2 5 8 / 1 4 -', '1-5-9 2-5-8 4-5-6'],   // p.503
  ['26/5/1964', '- 66 9 / 2 5 - / 1 4 -', '1-5-9 4-5-6'],   // p.505
  ['29/3/1973', '33 - 99 / 2 - - / 1 - 7', '!4-5-6 1-2-3'],   // p.516
  ['10/7/1983', '3 - 9 / - - 8 / 11 - 7', '!4-5-6 7-8-9'],   // p.517
  ['7/11/1988', '- - 9 / - - 88 / 111 - 7', '!4-5-6 7-8-9'],   // p.523
  ['7/7/1938', '3 - 9 / - - 8 / 1 - 77', '!4-5-6 7-8-9'],   // p.526
  ['10/11/2011', '- - - / 2 - - / 11111 - -', '!3-5-7 !3-6-9 !4-5-6 !7-8-9'],   // p.536
  ['14/10/2012', '- - - / 22 - - / 111 4 -', '!3-5-7 !3-6-9 !7-8-9'],   // p.537
  ['1/10/2001', '- - - / 2 - - / 111 - -', '!3-5-7 !3-6-9 !4-5-6 !7-8-9'],   // p.564
  ['2/2/2002', '- - - / 2222 - - / - - -', '!1-4-7 !1-5-9 !3-5-7 !3-6-9 !4-5-6 !7-8-9'],   // p.567
  ['15/5/2008', '- - - / 2 55 8 / 1 - -', '!3-6-9 2-5-8'],   // p.820
  ['28/9/1988', '- - 99 / 2 - 888 / 1 - -', '!3-5-7 !4-5-6'],   // p.823
  ['21/4/1926', '- 6 9 / 22 - - / 11 4 -', '!3-5-7'],   // p.825
  ['23/9/1970', '3 - 99 / 2 - - / 1 - 7', '!4-5-6 1-2-3'],   // p.849
  ['2/2/2020', '- - - / 2222 - - / - - -', '!1-4-7 !1-5-9 !3-5-7 !3-6-9 !4-5-6 !7-8-9'],   // p.855
];

test('every birth chart the book draws, and the arrows it names', () => {
  for (const [date, grid, arrows] of FIGURES) {
    const c = chart(date);
    assert.equal(cells(c.grid), grid, date);
    for (const a of arrows.split(' ').filter(Boolean)) {
      if (a.startsWith('!')) assert.ok(c.grid.empty.includes(a.slice(1)), `${date}: mũi tên trống ${a.slice(1)}`);
      else assert.ok(c.grid.arrows.includes(a), `${date}: mũi tên ${a}`);
    }
  }
  assert.equal(FIGURES.length, 52);
  // Hình 28: four arrows; Hình 25 (22/2/2000): six empty arrows
  assert.deepEqual(chart('26/5/1973').grid.arrows, ['1-5-9', '3-5-7', '3-6-9', '1-2-3']);
  assert.deepEqual(chart('22/2/2000').grid.empty, ['1-5-9', '3-5-7', '3-6-9', '1-4-7', '4-5-6', '7-8-9']);
});

test('the isolated numbers the book circles', () => {
  const I = { '13/2/1977': [7, 9], '10/1/1971': [1, 7, 9], '11/11/1993': [1, 3, 9], '14/3/1973': [3, 9], '17/7/1977': [1, 7, 9],
    '3/6/2007': [7], '30/7/1993': [1, 3, 7, 9], '26/11/1973': [7], '29/3/1973': [7, 9], '10/7/1983': [1, 3], '7/11/1988': [1],
    '7/7/1938': [1, 3], '23/9/1970': [7, 9], '24/4/1934': [9], '11/11/1999': [1, 9], '11/7/1982': [] };
  for (const [d, iso] of Object.entries(I)) assert.deepEqual(chart(d).grid.isolated, iso, d);
  // Hình 110 also rings the 8 of 28/2/2020, a side cell; the text speaks only of the corners, and so does the engine
  assert.deepEqual(chart('28/2/2020').grid.isolated, []);
});

test('names: linh hồn, biểu đạt, tên riêng (Phần 12)', () => {
  const T = [['Quỳnh Hương', 10, 5, 6], ['Quỳnh', 10, 3, 4], ['Phong', 6, 9, 6], ['Win', 9, 10, 10], ['Hưng', 3, 2, 5],
    ['Đàm Vĩnh Hưng', 4, 9, 4], ['Minh Hưng', 3, 10, 4], ['Elizabeth', 2, 5, 7]];
  for (const [name, soul, expression, nameNumber] of T) {
    const n = chart('1/5/1974', { names: [{ text: name }] }).names[0];
    assert.deepEqual([n.soul, n.expression, n.nameNumber], [soul, expression, nameNumber], name);
  }
  assert.deepEqual(N.nameWords('Đàm Vĩnh Hưng'), ['DAM', 'VINH', 'HUNG']);
  assert.deepEqual(N.nameVariants('Lê Đỗ Quỳnh Hương').map(v => v.text), ['Hương', 'Quỳnh Hương', 'Lê Đỗ Quỳnh Hương']);
  // name number against the ruling one: Quỳnh Hương 6 with chủ đạo 9 (same plane), Quỳnh 4 (another plane)
  const q = chart('1/5/1974', { names: [{ text: 'Quỳnh Hương' }, { text: 'Quỳnh' }] });
  assert.deepEqual(q.names.map(n => n.relation), ['same_plane', 'other_plane']);
  assert.equal(chart('21/4/1926', { names: [{ text: 'Elizabeth' }] }).names[0].relation, 'same');
});

test('name charts laid over the birth chart (Hình 47, 48, 99, 100, 101, 104, 108)', () => {
  const C = [
    ['21/4/1926', 'Elizabeth', '3 6 99 / 2222 55 88 / 111 4 -', ['1-5-9', '3-6-9', '2-5-8', '1-2-3', '4-5-6']],
    ['23/9/1970', 'Dan Ho', '3 6 99 / 2 5 8 / 11 4 7', ['1-5-9', '3-5-7', '3-6-9', '2-5-8', '1-4-7', '1-2-3', '4-5-6', '7-8-9']],
    ['7/11/1988', 'Phong', '- 6 9 / - 5 888 / 111 - 777', ['1-5-9', '7-8-9']],
    ['7/11/1988', 'Win', '- - 99 / - 55 88 / 111 - 7', ['1-5-9', '7-8-9']],
    ['15/5/2008', 'Hoàng Yến', '- 6 - / 2 55555 88 / 11 - 77', ['2-5-8']],
    ['15/5/2008', 'Li', '3 - 9 / 2 55 8 / 1 - -', ['1-5-9', '2-5-8', '1-2-3']],
    ['28/9/1988', 'Chi', '3 - 999 / 2 - 8888 / 1 - -', ['1-2-3']],
    ['28/2/2020', 'Lam An', '3 - - / 2222 5 8 / 11 4 -', ['2-5-8', '1-2-3']],
    ['2/2/2020', 'Lam Anh', '3 - - / 2222 5 8 / 11 4 -', ['2-5-8', '1-2-3']],
  ];
  for (const [date, name, grid, arrows] of C) {
    const n = chart(date, { names: [{ text: name }] }).names[0];
    assert.equal(cells(n.combined), grid, `${date} ${name}`);
    assert.deepEqual(n.combined.arrows, arrows, `${date} ${name}`);
  }
  // PHONG breaks Mũi tên Uất giận, frees the three 1s, and pushes 7 and 8 past one (Hình 99)
  const phong = chart('7/11/1988', { names: [{ text: 'Phong' }] }).names[0].effect;
  assert.deepEqual(phong.broken, ['4-5-6']);
  assert.deepEqual(phong.deIsolated, [1]);
  assert.deepEqual(phong.excess, [7, 8]);
  assert.ok(phong.compensates && phong.reinforces);
  // CHI leaves Mũi tên Uất giận and adds an 8 and a 9 to 888 and 99 (Hình 101)
  const chi = chart('28/9/1988', { names: [{ text: 'Chi' }] }).names[0].effect;
  assert.deepEqual(chi.remaining, ['4-5-6']);
  assert.deepEqual(chi.excess, [8, 9]);
  // KHƯƠNG DI fills 3, 6 and 9 for 12/10/2005 (Mũi tên trống 3-6-9, page 433)
  const di = chart('12/10/2005', { names: [{ text: 'Khương Di' }] }).names[0].effect;
  assert.ok(di.broken.includes('3-6-9'));
  assert.deepEqual(di.filled.filter(n => [3, 6, 9].includes(n)), [3, 6, 9]);
});

test('the pyramid: four peaks, their ages and years (Phần 11)', () => {
  const P = [['1/5/1974', [5, 1, 3], [[6, 27, 2001], [4, 36, 2010], [10, 45, 2019], [8, 54, 2028]]],
    ['7/10/1984', [1, 7, 4], [[8, 33, 2017], [2, 42, 2026], [10, 51, 2035], [5, 60, 2044]]],
    ['21/4/1926', [4, 3, 9], [[7, 29, 1955], [3, 38, 1964], [10, 47, 1973], [4, 56, 1982]]]];
  for (const [d, base, peaks] of P) {
    const c = chart(d);
    assert.deepEqual(c.pyramid.base, base, d);
    assert.deepEqual(c.pyramid.peaks.map(p => [p.n, p.age, p.year]), peaks, d);
  }
  // the table on page 701: 36 − chủ đạo, and 32 for 22/4
  assert.equal(N.buildNumerology({ day: 2, month: 2, year: 1990 }).pyramid.peaks[0].age, 36 - 5);
  // the book's promise: everyone reaches each peak of their pyramid in a Personal Year 9
  for (let y = 1930; y <= 2015; y += 7) for (const [d, m] of [[1, 1], [22, 4], [29, 9], [31, 12], [19, 8], [10, 11]]) {
    const c = N.buildNumerology({ day: d, month: m, year: y });
    for (const p of c.pyramid.peaks) assert.equal(N.personalYearOf(d, m, p.year), 9, `${d}/${m}/${y} đỉnh ${p.index}`);
  }
});

test('personal years, world years and the book\'s year lengths (Phần 9)', () => {
  assert.deepEqual([2017, 2018, 2019, 2020].map(N.worldYear), [1, 2, 3, 4]);
  assert.deepEqual([1894, 1939, 1948, 1957, 1966, 1975, 1984, 1993, 2299].map(N.worldYear), Array(9).fill(22));
  assert.deepEqual([2017, 2018, 2019, 2020].map(y => N.personalYearOf(1, 5, y)), [7, 8, 9, 1]);
  const span = y => { const p = N.personalYear(1, 5, y); return [p.n, p.start, p.end, p.months]; };
  assert.deepEqual(span(2019), [9, '2018-09-01', '2019-09-30', 13]);
  assert.deepEqual(span(2020), [1, '2019-10-01', '2020-10-31', 13]);
  assert.deepEqual(span(2021), [2, '2020-11-01', '2021-08-31', 10]);
  assert.deepEqual(span(2022), [3, '2021-09-01', '2022-09-30', 13]);
  assert.deepEqual(span(2023), [4, '2022-10-01', '2023-10-31', 13]);
  // on 15/12/2019 the author is in Năm thứ nhất, inside the khúc giao thời from Năm thứ chín
  const c = N.buildNumerology({ day: 1, month: 5, year: 1974, asOf: { year: 2019, month: 12, day: 15 } });
  assert.equal(c.now.year.n, 1);
  assert.deepEqual(c.now.transition, { from: 9, to: 1, since: '2019-10-01', until: '2020-03-01', sure: false });
  assert.equal(c.now.stage, 2);
  assert.deepEqual([c.now.lastPeak.index, c.now.nextPeak.index], [3, 4]);
  // the cycle around a date runs 9, 1 … 9, 1
  assert.deepEqual(c.years.map(y => y.n), [9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
});

test('the condition language', () => {
  const c = chart('7/11/1988', { names: [{ text: 'Win' }], gender: 'male' });
  const x = { chart: c, name: c.names[0] };
  const ok = s => { const p = N.parse(s); assert.deepEqual(p.errors, [], s); return N.evaluate(p.node, x); };
  assert.ok(ok('ruling(8)').ok);
  assert.ok(ok('count(1, 3) & isolated(1) & arrow(7-8-9) & empty(4-5-6)').ok);
  assert.ok(ok('count(8, 2) & !count(8, 3+)').ok);
  assert.ok(ok('soul(9) & expression(10) & name_number(10) & name_breaks(4-5-6) & name_has(5)').ok);
  assert.ok(ok('male() & name_other_plane()').ok);
  assert.ok(!ok('day(22/4) | ruling(2, 11)').ok);
  assert.deepEqual(ok('count(1, 3) & isolated(1)').why, ['Ba số 1 (111)', 'số 111 bị cô lập']);
  for (const bad of ['ruling(12)', 'count(1)', 'arrow(1-2-4)', 'foo()', 'ruling(7', 'plane(heart, 1)']) assert.ok(N.parse(bad).errors.length, bad);
  assert.deepEqual([...N.symbolsOf(N.parse('arrow(1-5-9) & count(1, 2+) & !ruling(7)').node)], ['arrow:1-5-9', 'digit:1']);
});

test('conditions read in words', () => {
  assert.equal(N.describeWhen('ruling(9)'), 'Con số chủ đạo 9');
  assert.equal(N.describeWhen('ruling(4, 22/4)'), 'Con số chủ đạo 4 hoặc 22/4');
  assert.equal(N.describeWhen('count(1, 2) & arrow(1-4-7)'), 'Hai số 1 · Mũi tên Thực tế');
  assert.equal(N.describeWhen('count(2, 5+)'), 'Từ năm số 2');
  assert.equal(N.describeWhen('count(3, 0)'), 'Không có số 3');
  assert.equal(N.describeWhen('empty(4-5-6) & isolated(1)'), 'Mũi tên Uất giận · Số 1 bị cô lập');
  assert.equal(N.describeWhen('plane(mind, 3+)'), 'Trục Trí não có từ ba số');
  assert.equal(N.describeWhen('name_reinforces() | !name_compensates()'), 'Tên dồn thêm vào Biểu đồ ngày sinh hoặc không phải: Tên bù đắp cho Biểu đồ ngày sinh');
  assert.equal(N.describeWhen('peak_at(3, 10) & stage(2)'), 'Đỉnh thứ 3 mang số 10 · Giai đoạn trưởng thành');
  assert.equal(N.describeWhen('nonsense('), 'nonsense(');
});

