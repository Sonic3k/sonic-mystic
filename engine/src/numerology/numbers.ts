/* The building blocks of the book "Thay đổi cuộc sống với Nhân số học" (Lê Đỗ Quỳnh Hương, after David A. Phillips'
   The Complete Book of Numerology): how a number is reduced, the birth chart grid, its three planes, the arrows, the
   corners that can be isolated, and the letters of a name. 22 stands for the book's "22/4" everywhere. */

/** the book writes 22 as "22/4" */
export const label = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : n === 22 ? '22/4' : String(n));
/** 22/4 counts as 4 where the book adds or subtracts (36 − Con số chủ đạo) */
export const valueOf = (n: number): number => (n === 22 ? 4 : n);
/** "22/4" → 22, "7" → 7 (null when it is not one of the book's numbers: 1 to 11 and 22/4) */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (t === '22/4' || t === '22') return 22;
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 11 ? n : null;
}

export const digitSum = (n: number): number => String(Math.abs(n)).split('').reduce((a, c) => a + Number(c), 0);

/** adds the digits again and again until the number lies in lo..hi; 22 stops there when keep22 */
export function reduce(n: number, lo: number, hi: number, keep22: boolean): number {
  let x = n;
  while (!(x >= lo && x <= hi) && !(keep22 && x === 22)) {
    if (x < 10) break;
    x = digitSum(x);
  }
  return x;
}
/** one digit, 1..9 (the pyramid's base and first two peaks, the personal year) */
export const toDigit = (n: number): number => reduce(n, 1, 9, false);

// ── the birth chart ─────────────────────────────────────────────────────────

/** the grid as the book draws it: 3 6 9 on top, 2 5 8 in the middle, 1 4 7 at the bottom */
export const GRID_ROWS = [[3, 6, 9], [2, 5, 8], [1, 4, 7]] as const;

export type Plane = 'tri_nao' | 'tinh_than' | 'the_chat';
export const PLANES: { code: Plane; nums: [number, number, number]; name: string; self: string }[] = [
  { code: 'tri_nao', nums: [3, 6, 9], name: 'Trục ngang Trí não', self: 'Thể Ý thức' },
  { code: 'tinh_than', nums: [2, 5, 8], name: 'Trục ngang Tinh thần', self: 'Thể Siêu thức' },
  { code: 'the_chat', nums: [1, 4, 7], name: 'Trục ngang Thể chất', self: 'Thể Cơ bản' },
];
/** the plane of a number 1..9, and of the ruling/name numbers (10 → Thể chất, 11 → Tinh thần, 22/4 → both) */
export function planesOf(n: number): Plane[] {
  if (n === 22) return ['the_chat', 'tinh_than'];
  const d = n === 10 ? 1 : n === 11 ? 2 : n;
  return PLANES.filter(p => p.nums.includes(d)).map(p => p.code);
}

export interface ArrowDef { code: string; nums: [number, number, number]; full: string; empty: string | null }
/** the 15 arrows (seven strong–weak pairs and Mũi tên Kế hoạch), in the order of the book's Phần 7 */
export const ARROWS: ArrowDef[] = [
  { code: '1-5-9', nums: [1, 5, 9], full: 'Mũi tên Quyết tâm', empty: 'Mũi tên Trì hoãn' },
  { code: '3-5-7', nums: [3, 5, 7], full: 'Mũi tên Tâm linh', empty: 'Mũi tên Hoài nghi' },
  { code: '3-6-9', nums: [3, 6, 9], full: 'Mũi tên Trí tuệ', empty: 'Mũi tên Trí nhớ ngắn hạn' },
  { code: '2-5-8', nums: [2, 5, 8], full: 'Mũi tên Cân bằng cảm xúc', empty: 'Mũi tên Nhạy cảm' },
  { code: '1-4-7', nums: [1, 4, 7], full: 'Mũi tên Thực tế', empty: 'Mũi tên Thiếu trật tự' },
  { code: '1-2-3', nums: [1, 2, 3], full: 'Mũi tên Kế hoạch', empty: null },
  { code: '4-5-6', nums: [4, 5, 6], full: 'Mũi tên Ý chí', empty: 'Mũi tên Uất giận' },
  { code: '7-8-9', nums: [7, 8, 9], full: 'Mũi tên Hoạt động', empty: 'Mũi tên Thụ động' },
];
export const ARROW_BY_CODE: Record<string, ArrowDef> = Object.fromEntries(ARROWS.map(a => [a.code, a]));
/** "1-5-9", "159", "1–5–9", "9-5-1" → the arrow */
export function findArrow(s: string): ArrowDef | undefined {
  const d = s.replace(/\D/g, '').split('').map(Number).sort((a, b) => a - b);
  return ARROWS.find(a => a.nums.join('') === d.join(''));
}

/** a corner number with none of its neighbours on the chart is "bị cô lập" (the book draws a curve around it) */
export const CORNERS: Record<number, [number, number, number]> = { 1: [2, 4, 5], 3: [2, 5, 6], 7: [4, 5, 8], 9: [5, 6, 8] };

/** the book's best count of each number on a chart: a pair of 1 and of 2 ("11", "22"), a single 3 to 9 */
export const IDEAL_COUNT = (n: number): number => (n === 1 || n === 2 ? 2 : 1);

/** how the book writes a count of a number in a cell: 1 → "1", 3 → "111" */
export const cellText = (n: number, count: number): string => String(n).repeat(count);

/** "Một", "Hai"… as the book's headings count them */
export const COUNT_WORDS = ['Không', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín'];

// ── names ───────────────────────────────────────────────────────────────────

/** A J S = 1, B K T = 2 … I R = 9 (Phần 12, "Mỗi chữ cái tương ứng một con số") */
export const LETTER_NUMBER: Record<string, number> = {};
['AJS', 'BKT', 'CLU', 'DMV', 'ENW', 'FOX', 'GPY', 'HQZ', 'IR'].forEach((row, i) => { for (const ch of row) LETTER_NUMBER[ch] = i + 1; });
/** in Vietnamese Y is always read /i/, so it counts as a vowel (Phần 12) */
export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

/** the letters of a name without tone and vowel marks: "Đàm Vĩnh Hưng" → ["DAM", "VINH", "HUNG"] */
export function nameWords(name: string): string[] {
  return name.normalize('NFC').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().split(/[^A-Z]+/).filter(Boolean);
}

export interface Letter { ch: string; n: number; vowel: boolean; word: number }
export function lettersOf(name: string): Letter[] {
  const out: Letter[] = [];
  nameWords(name).forEach((w, word) => { for (const ch of w) if (LETTER_NUMBER[ch]) out.push({ ch, n: LETTER_NUMBER[ch], vowel: VOWELS.has(ch), word }); });
  return out;
}

/**
 * The names a full Vietnamese name is read by: the given name (what people are called by, the book's default), the
 * middle and given name together, and the whole name. The book reads "the name used most" — the reader picks.
 */
export function nameVariants(full: string): { label: string; text: string }[] {
  const words = full.normalize('NFC').trim().split(/\s+/).filter(w => nameWords(w).length);
  if (!words.length) return [];
  const out = [{ label: 'Tên gọi', text: words[words.length - 1] }];
  if (words.length >= 3) out.push({ label: 'Tên đệm và tên', text: words.slice(-2).join(' ') });
  if (words.length >= 2) out.push({ label: 'Họ tên đầy đủ', text: words.join(' ') });
  return out;
}
