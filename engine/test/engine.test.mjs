// The engine against grandma's own tables, known Vietnamese lunar dates, and the settings she did not write down.
// Runs on the built output: npm run build -w @mystic/engine && npm test -w @mystic/engine
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/tuvi/index.js';

const BR = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

test('lunar calendar (UTC+7)', () => {
  const tet = [[2026, 2, 17], [2025, 1, 29], [2024, 2, 10], [2023, 1, 22], [2020, 1, 25], [2000, 2, 5], [1990, 1, 27], [1985, 1, 21], [1968, 1, 29], [2012, 1, 23], [2008, 2, 7]];
  for (const [y, m, d] of tet) assert.deepEqual(E.solarToLunar(d, m, y), { day: 1, month: 1, year: y, leap: false }, `Tết ${y}`);
  assert.deepEqual(E.solarToLunar(22, 3, 2023), { day: 1, month: 2, year: 2023, leap: true });
  assert.deepEqual(E.solarToLunar(23, 5, 2020), { day: 1, month: 4, year: 2020, leap: true });
  assert.equal(E.leapMonthOf(2023), 2);
  assert.equal(E.leapMonthOf(2025), 6);
  assert.deepEqual(E.lunarToSolar(15, 8, 2026, false), [25, 9, 2026]);
});

test('the calendar of the time: UTC+8 before 1968, and in the South until 1975', () => {
  assert.equal(E.lunarZoneFor(31, 12, 1967), 8);
  assert.equal(E.lunarZoneFor(1, 1, 1968), 7);
  assert.equal(E.lunarZoneFor(1, 6, 1970, 10.8), 8, 'Sài Gòn 1970');
  assert.equal(E.lunarZoneFor(1, 6, 1970, 21.03), 7, 'Hà Nội 1970');
  assert.equal(E.lunarZoneFor(1, 1, 1976, 10.8), 7);
  // Tết Mậu Thân: 29/1/1968 in the North, 30/1 in the South
  assert.deepEqual(E.solarToLunar(29, 1, 1968, 8), { day: 30, month: 12, year: 1967, leap: false });
  assert.deepEqual(E.solarToLunar(30, 1, 1968, 8), { day: 1, month: 1, year: 1968, leap: false });
  const south = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1968, month: 1, day: 29, hour: 10, latitude: 10.8 });
  assert.equal(south.lunarZone, 8);
  assert.deepEqual(south.lunar, { day: 30, month: 12, year: 1967, leap: false });
  assert.ok(south.calendarWarning, 'the two calendars disagree that day');
  const north = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1968, month: 1, day: 29, hour: 10, latitude: 21.03 });
  assert.equal(north.lunarZone, 7);
  assert.deepEqual(north.lunar, { day: 1, month: 1, year: 1968, leap: false });
  const forced = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1968, month: 1, day: 29, hour: 10, latitude: 10.8 }, { ...E.defaultOptions(), lunarCalendar: 'utc7' });
  assert.equal(forced.lunarZone, 7);
});

test('sun time at the birthplace (optional)', () => {
  // Hà Nội, 8/2/1990, 9:05 by the clock: the sun runs about 14 minutes behind, the meridian adds 3 → about 8:54
  const t = E.trueSolarTime(8, 2, 1990, 9, 5, 105.8542, 420);
  assert.equal(t.hour, 8);
  assert.ok(t.minute >= 52 && t.minute <= 56, `got ${t.hour}:${t.minute}`);
  const base = { gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5, latitude: 21.0285, longitude: 105.8542, utcOffsetMinutes: 420 };
  assert.equal(BR[E.buildChart(base).hour], 'Tỵ', 'clock');
  assert.equal(BR[E.buildChart(base, { ...E.defaultOptions(), hourBasis: 'true_solar' }).hour], 'Thìn', 'sun');
});

test("grandma's tables: Tử Vi by day and cục", () => {
  const T = {
    2: { 'Tỵ': [8, 9], 'Ngọ': [10, 11], 'Mùi': [12, 13], 'Thân': [14, 15], 'Thìn': [6, 7, 30], 'Dậu': [16, 17], 'Mão': [4, 5, 28, 29], 'Tuất': [18, 19], 'Dần': [2, 3, 26, 27], 'Sửu': [1, 24, 25], 'Tý': [22, 23], 'Hợi': [20, 21] },
    3: { 'Tỵ': [4, 12, 14], 'Ngọ': [7, 15, 17], 'Mùi': [10, 18, 20], 'Thân': [13, 21, 23], 'Thìn': [1, 9, 11], 'Dậu': [16, 24, 26], 'Mão': [6, 8], 'Tuất': [19, 27, 29], 'Dần': [3, 5], 'Sửu': [2, 28], 'Tý': [25], 'Hợi': [22, 30] },
    4: { 'Tỵ': [6, 16, 19, 25], 'Ngọ': [10, 20, 23, 29], 'Mùi': [14, 24, 27], 'Thân': [18, 28], 'Thìn': [2, 12, 15, 21], 'Dậu': [22], 'Mão': [8, 11, 17], 'Tuất': [26], 'Dần': [4, 7, 13], 'Sửu': [3, 9], 'Tý': [5], 'Hợi': [1, 30] },
    5: { 'Tỵ': [8, 20, 24], 'Ngọ': [1, 13, 25, 29], 'Mùi': [6, 18, 30], 'Thân': [11, 23], 'Thìn': [3, 15, 19, 27], 'Dậu': [16, 28], 'Mão': [10, 14, 22], 'Tuất': [21], 'Dần': [5, 9, 17], 'Sửu': [4, 12], 'Tý': [7], 'Hợi': [2, 26] },
    6: { 'Tỵ': [10, 24, 29], 'Ngọ': [2, 16, 30], 'Mùi': [8, 22], 'Thân': [14, 28], 'Thìn': [4, 18, 23], 'Dậu': [1, 20], 'Mão': [12, 17, 27], 'Tuất': [7, 26], 'Dần': [6, 11, 21], 'Sửu': [5, 15, 25], 'Tý': [9, 19], 'Hợi': [3, 13] },
  };
  let n = 0;
  for (const [c, tab] of Object.entries(T)) for (const [b, days] of Object.entries(tab)) for (const d of days) { assert.equal(BR[E.tuViPosition(+c, d)], b, `cục ${c} ngày ${d}`); n++; }
  assert.equal(n, 150);
});

test("grandma's tables: Tìm Cục", () => {
  const CUC = { 'Tý': ['Thủy', 'Hỏa', 'Thổ', 'Mộc', 'Kim'], 'Sửu': ['Thủy', 'Hỏa', 'Thổ', 'Mộc', 'Kim'],
    'Dần': ['Hỏa', 'Thổ', 'Mộc', 'Kim', 'Thủy'], 'Mão': ['Hỏa', 'Thổ', 'Mộc', 'Kim', 'Thủy'], 'Tuất': ['Hỏa', 'Thổ', 'Mộc', 'Kim', 'Thủy'], 'Hợi': ['Hỏa', 'Thổ', 'Mộc', 'Kim', 'Thủy'],
    'Thìn': ['Mộc', 'Kim', 'Thủy', 'Hỏa', 'Thổ'], 'Tỵ': ['Mộc', 'Kim', 'Thủy', 'Hỏa', 'Thổ'],
    'Ngọ': ['Thổ', 'Mộc', 'Kim', 'Thủy', 'Hỏa'], 'Mùi': ['Thổ', 'Mộc', 'Kim', 'Thủy', 'Hỏa'],
    'Thân': ['Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'], 'Dậu': ['Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'] };
  for (const [b, row] of Object.entries(CUC)) row.forEach((el, s5) => {
    const bi = BR.indexOf(b), stemDan = ((s5 % 5) * 2 + 2) % 10, st = (stemDan + ((bi - 2 + 12) % 12)) % 10;
    assert.equal(E.napAmOf(st, bi).element, el, `${b} / can ${s5}`);
  });
});

test('whole charts hold together', () => {
  for (const [y, m, d, h, g] of [[1990, 5, 12, 14, 'nam'], [1962, 11, 3, 2, 'nu'], [2025, 8, 30, 23, 'nam'], [1945, 2, 14, 9, 'nu'], [2001, 12, 31, 0, 'nam']]) {
    for (const variant of ['ba', 'sach']) {
      const c = E.buildChart({ gender: g, calendar: 'solar', year: y, month: m, day: d, hour: h }, { ...E.defaultOptions(), variant, viewYear: 2026 });
      assert.equal(c.palaces.reduce((a, p) => a + p.stars.filter(s => s.kind === 'chinh').length, 0), 14);
      assert.equal((c.pos.thien_phu + c.pos.tu_vi) % 12, 4);
      assert.equal((c.pos.kinh_duong - c.pos.loc_ton + 12) % 12, 1);
      assert.ok(['Mệnh', 'Phúc Đức', 'Quan Lộc', 'Thiên Di', 'Tài Bạch', 'Phu Thê'].includes(c.palaces[c.than].role));
    }
  }
});

test('a lunar input round-trips to its solar date', () => {
  const c = E.buildChart({ gender: 'nu', calendar: 'lunar', year: 1990, month: 1, day: 13, hour: 5 });
  assert.deepEqual(c.solar, [8, 2, 1990]);
  assert.equal(c.lunarZone, 7);
});

test('Canh Ngọ 1990: one of the three places grandma differs from the books', () => {
  const c = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5 });
  assert.deepEqual(c.lunar, { day: 13, month: 1, year: 1990, leap: false });
  assert.equal(E.canChiName(c.stem, c.branch), 'Canh Ngọ');
  assert.equal(BR[c.hour], 'Tỵ');
  assert.ok(c.variantStars.includes('hoa_khoa') && c.variantStars.includes('hoa_ky'));
  assert.equal(c.pos.hoa_ky, c.pos.thai_am, "grandma: Kỵ on Thái Âm");
  const sach = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5 }, { ...E.defaultOptions(), variant: 'sach' });
  assert.equal(sach.pos.hoa_ky, sach.pos.thien_dong, 'books: Kỵ on Thiên Đồng');
});

test('the condition language parses and reads a chart', () => {
  const p = E.parse('in(Tử Vi, Thiên Phủ) & meet(Tả Hữu) & !meet(Lục Sát)');
  assert.deepEqual(p.errors, []);
  const bad = E.parse('in(Sao Không Có)');
  assert.ok(bad.errors.length > 0);
  const c = E.buildChart({ gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5 });
  const r = E.evaluate(E.parse('male()').node, { chart: c, p: c.menh });
  assert.equal(r.ok, true);
});
