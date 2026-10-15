/* Everything the book computes from a solar birth date and a name, in the book's own order: Con số chủ đạo (Phần 5),
   Biểu đồ ngày sinh with its arrows and isolated numbers (Phần 6–7), Con số ngày sinh (Phần 8), the personal years
   with the book's year lengths and khúc giao thời (Phần 9), the three stages of life (Phần 10), the four peaks of the
   pyramid (Phần 11), and the numbers, chart and effect of a name (Phần 12). */
import {
  ARROWS, CORNERS, IDEAL_COUNT, PLANES, digitSum, lettersOf, planesOf, reduce, toDigit, valueOf,
  type Letter, type Plane,
} from './numbers.js';

export type Gender = 'male' | 'female';
export interface YMD { year: number; month: number; day: number }
export interface NameInput { label?: string | null; text: string; primary?: boolean | null }
export interface NumerologyInput extends YMD {
  gender?: Gender | null;
  /** the names to read, as the person is called; the primary one is the name the reading speaks of */
  names?: NameInput[];
  /** "today" for the personal year and the stage of life (defaults to the real today) */
  asOf?: YMD;
}

/** a chart's numbers: how many of each (index 1..9, index 0 counts the zeros), the arrows, the isolated corners */
export interface Grid {
  counts: number[];
  /** full arrows (three numbers present), in the book's order */
  arrows: string[];
  /** empty arrows (three numbers absent) */
  empty: string[];
  /** corner numbers (1, 3, 7, 9) with none of their neighbours */
  isolated: number[];
  /** how many digits sit on each plane */
  planes: Record<Plane, number>;
}

export interface NameEffect {
  /** what the name adds to each number */
  added: number[];
  /** numbers the birth chart lacks and the name brings */
  filled: number[];
  /** empty arrows of the birth chart the name breaks ("phá thế") */
  broken: string[];
  /** empty arrows the name leaves empty */
  remaining: string[];
  /** arrows the combined chart has and the birth chart does not */
  newArrows: string[];
  /** arrows the name chart has on its own that the birth chart has too (the book: a name should not repeat them) */
  sharedArrows: string[];
  deIsolated: number[];
  newIsolated: number[];
  /** numbers the name pushes past the book's best count (two 1s, two 2s, one of 3–9) */
  excess: number[];
  /** khuynh hướng thứ nhất: the name makes up for a weakness of the birth chart */
  compensates: boolean;
  /** khuynh hướng thứ hai: the name adds to what the birth chart already has */
  reinforces: boolean;
}

export interface NameReading {
  label: string; text: string; primary: boolean;
  letters: Letter[];
  /** Con số linh hồn: the vowels (1..11, 22/4) */
  soul: number | null; soulSum: number;
  /** Con số biểu đạt: the consonants (1..11, 22/4) */
  expression: number | null; expressionSum: number;
  /** Con số tên riêng: linh hồn + biểu đạt (2..11, 22/4) */
  nameNumber: number | null;
  /** how the name number stands to Con số chủ đạo */
  relation: 'same' | 'same_plane' | 'other_plane' | null;
  /** the name's own chart, and the birth chart with the name's numbers added */
  grid: Grid; combined: Grid;
  effect: NameEffect;
}

export interface Peak { index: 1 | 2 | 3 | 4; n: number; age: number; year: number }
export interface PersonalYear {
  year: number;
  /** Con số năm cá nhân of that calendar year, 1..9 */
  n: number;
  /** Con số năm thế giới (22 = the book's 22/4 years: 1939, 1948, … 1993, 2299) */
  world: number;
  /** the book's length of that personal year: from 1/9, 1/10 or 1/11 of the year before (YYYY-MM-DD) */
  start: string; end: string; months: 10 | 13;
}
export interface Now {
  date: string;
  /** years since the birth year, as the book counts the peaks */
  age: number;
  /** Phần 10: 1 niên thiếu (before the first peak), 2 trưởng thành (the 27 years of the peaks), 3 viên mãn */
  stage: 1 | 2 | 3;
  /** the personal year being lived on that date, by the book's year lengths */
  year: PersonalYear;
  /** inside the khúc giao thời into that year: 2 to 5 months from its start (sure in the first 2) */
  transition: { from: number; to: number; since: string; until: string; sure: boolean } | null;
  lastPeak: Peak | null; nextPeak: Peak | null;
}

export interface NumerologyChart {
  input: { year: number; month: number; day: number; gender: Gender | null; names: NameInput[]; asOf: YMD };
  digits: number[];
  /** the sum of every digit of the birth date */
  sum: number;
  ruling: number;
  birthday: number;
  grid: Grid;
  names: NameReading[];
  /** the name the reading speaks of (index in names), when there is a name */
  primary: number | null;
  pyramid: { base: [number, number, number]; peaks: Peak[] };
  /** the 9-year cycle around now: the 9 before it, the cycle (1 → 9), the 1 after */
  years: PersonalYear[];
  now: Now;
}

export class NumerologyError extends Error {}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: YMD) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
function addMonths(date: string, k: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + k, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function validDate(d: YMD): boolean {
  return [d.year, d.month, d.day].every(Number.isInteger) && d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= lastDay(d.year, d.month);
}
export const today = (): YMD => { const t = new Date(); return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() }; };

/** Phần 5: add every digit of the date, again and again, until the number lies in 2..11 — 22 stays as 22/4 */
export const rulingOf = (digits: number[]) => reduce(digits.reduce((a, b) => a + b, 0), 2, 11, true);
/** Phần 8: days 1..11 as they are, 22 as 22/4, the others added up to 1..11 (19 and 28 give 10, 29 gives 11) */
export function birthdayOf(day: number): number {
  if (day === 22) return 22;
  return reduce(day, 1, 11, false);
}
/** Con số năm thế giới: the digits of the year added to one digit (22 kept to show the 22/4 years) */
export function worldYear(year: number): number {
  const s = digitSum(year);
  return s === 22 ? 22 : toDigit(s);
}
/** Phần 9: PYN = WYN + the month's digits + the day's digits, to one digit */
export const personalYearOf = (day: number, month: number, year: number) => toDigit(valueOf(worldYear(year)) + digitSum(month) + digitSum(day));

/** the book's year lengths ("Các khúc giao thời"): years 3, 6, 9 run 1/9 → 30/9; 1, 4, 7 run 1/10 → 31/10; 2, 5, 8 run 1/11 → 31/8 */
export function personalYear(day: number, month: number, year: number): PersonalYear {
  const n = personalYearOf(day, month, year);
  const k = n % 3;
  const [sm, em, ed] = k === 0 ? [9, 9, 30] : k === 1 ? [10, 10, 31] : [11, 8, 31];
  return { year, n, world: worldYear(year), start: `${year - 1}-${pad(sm)}-01`, end: `${year}-${pad(em)}-${pad(ed)}`, months: k === 2 ? 10 : 13 };
}

export function gridOf(counts: number[]): Grid {
  const has = (n: number) => counts[n] > 0;
  const arrows = ARROWS.filter(a => a.nums.every(has)).map(a => a.code);
  const empty = ARROWS.filter(a => a.empty && !a.nums.some(has)).map(a => a.code);
  const isolated = Object.entries(CORNERS).filter(([n, nb]) => has(Number(n)) && !nb.some(has)).map(([n]) => Number(n));
  const planes = Object.fromEntries(PLANES.map(p => [p.code, p.nums.reduce((s, n) => s + counts[n], 0)])) as Record<Plane, number>;
  return { counts, arrows, empty, isolated, planes };
}
const countsOf = (digits: number[]) => { const c = Array(10).fill(0); for (const d of digits) c[d]++; return c; };

function nameReading(input: NameInput, primary: boolean, ruling: number, birth: Grid): NameReading {
  const letters = lettersOf(input.text);
  const soulSum = letters.filter(l => l.vowel).reduce((s, l) => s + l.n, 0);
  const expressionSum = letters.filter(l => !l.vowel).reduce((s, l) => s + l.n, 0);
  const soul = soulSum ? reduce(soulSum, 1, 11, true) : null;
  const expression = expressionSum ? reduce(expressionSum, 1, 11, true) : null;
  const both = (soul ?? 0) + (expression ?? 0);
  const nameNumber = both ? reduce(both, 2, 11, true) : null;
  let relation: NameReading['relation'] = null;
  if (nameNumber !== null) {
    const pr = planesOf(ruling), pn = planesOf(nameNumber);
    relation = nameNumber === ruling ? 'same' : pn.some(p => pr.includes(p)) ? 'same_plane' : 'other_plane';
  }
  const added = Array(10).fill(0); for (const l of letters) added[l.n]++;
  added[0] = 0;
  const grid = gridOf(added);
  const combined = gridOf(birth.counts.map((c, i) => (i === 0 ? c : c + added[i])));
  const effect: NameEffect = {
    added,
    filled: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !birth.counts[n] && added[n]),
    broken: birth.empty.filter(a => !combined.empty.includes(a)),
    remaining: birth.empty.filter(a => combined.empty.includes(a)),
    newArrows: combined.arrows.filter(a => !birth.arrows.includes(a)),
    sharedArrows: grid.arrows.filter(a => birth.arrows.includes(a)),
    deIsolated: birth.isolated.filter(n => !combined.isolated.includes(n)),
    newIsolated: combined.isolated.filter(n => !birth.isolated.includes(n)),
    excess: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => added[n] && combined.counts[n] > IDEAL_COUNT(n)),
    compensates: false, reinforces: false,
  };
  effect.compensates = effect.broken.length + effect.deIsolated.length + effect.newArrows.length > 0;
  effect.reinforces = effect.sharedArrows.length + effect.excess.length > 0;
  return {
    label: input.label?.trim() || input.text.trim(), text: input.text.trim(), primary, letters,
    soul, soulSum, expression, expressionSum, nameNumber, relation, grid, combined, effect,
  };
}

export function buildNumerology(input: NumerologyInput): NumerologyChart {
  const { year, month, day } = input;
  if (!validDate({ year, month, day })) throw new NumerologyError(`Không có ngày ${day}/${month}/${year} dương lịch`);
  if (year < 1800 || year > 2200) throw new NumerologyError('Năm sinh phải từ 1800 đến 2200');
  const asOf = input.asOf ?? today();
  if (!validDate(asOf)) throw new NumerologyError('Ngày xem không hợp lệ');

  const digits = `${day}${month}${year}`.split('').map(Number);
  const grid = gridOf(countsOf(digits));
  const ruling = rulingOf(digits);
  const birthday = birthdayOf(day);

  // names: the first one marked primary (else the first given) is the one the reading speaks of
  const given = (input.names ?? []).filter(n => n && typeof n.text === 'string' && lettersOf(n.text).length);
  const pi = given.length ? Math.max(0, given.findIndex(n => n.primary)) : -1;
  const names = given.map((n, i) => nameReading(n, i === pi, ruling, grid));

  // Phần 11: the base is the month, the day and the year each brought to one digit
  const base: [number, number, number] = [toDigit(month), toDigit(day), toDigit(digitSum(year))];
  const p1 = toDigit(base[0] + base[1]), p2 = toDigit(base[1] + base[2]);
  const p3 = reduce(p1 + p2, 1, 11, false), p4 = reduce(base[0] + base[2], 1, 11, false);
  const first = 36 - valueOf(ruling);
  const peaks: Peak[] = [p1, p2, p3, p4].map((n, i) => ({ index: (i + 1) as Peak['index'], n, age: first + 9 * i, year: year + first + 9 * i }));

  // the personal year being lived on asOf (it starts in the calendar year before)
  const date = ymd(asOf);
  const cur = [asOf.year, asOf.year + 1].map(y => personalYear(day, month, y)).find(p => p.start <= date && date <= p.end)!;
  const since = cur.start, until = addMonths(cur.start, 5), sureUntil = addMonths(cur.start, 2);
  const prevN = cur.n === 1 ? 9 : cur.n - 1;
  const transition = date < until ? { from: prevN, to: cur.n, since, until, sure: date < sureUntil } : null;
  const age = asOf.year - year;
  const stage: Now['stage'] = age < peaks[0].age ? 1 : age < peaks[3].age ? 2 : 3;
  const lastPeak = [...peaks].reverse().find(p => p.year <= asOf.year) ?? null;
  const nextPeak = peaks.find(p => p.year > asOf.year) ?? null;

  // the cycle that holds the calendar year: from its year 1, with the year 9 before and the year 1 after
  const startYear = asOf.year - (personalYearOf(day, month, asOf.year) - 1);
  const years = Array.from({ length: 11 }, (_, i) => personalYear(day, month, startYear - 1 + i));

  return {
    input: { year, month, day, gender: input.gender ?? null, names: given, asOf },
    digits, sum: digits.reduce((a, b) => a + b, 0), ruling, birthday, grid, names, primary: pi >= 0 ? pi : null,
    pyramid: { base, peaks }, years,
    now: { date, age, stage, year: cur, transition, lastPeak, nextPeak },
  };
}
