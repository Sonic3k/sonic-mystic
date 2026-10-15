/* Vietnamese lunar calendar (Hồ Ngọc Đức's astronomical method). The time zone decides which day a new moon falls on:
   today's calendar follows UTC+7, so some months differ from China's (Tết 1985: 21/01 here, 20/02 there). It has not
   always: the North computed it for UTC+8 until 1967 and switched in 1968 (Tết Mậu Thân 1968 fell on 29/01 in the North,
   30/01 in the South); the South kept UTC+8 until reunification. `lunarZoneFor` picks the calendar a birth date was
   actually written in. */

const PI = Math.PI;

/** the meridian of the lunar calendar in use on a solar date: 8 before 1968, 8 in the South until 13/6/1975, else 7.
 *  The South is taken as below the 17th parallel; without a latitude the North is assumed. */
export function lunarZoneFor(day: number, month: number, year: number, latitude?: number | null): 7 | 8 {
  const ymd = year * 10000 + month * 100 + day;
  if (ymd < 19680101) return 8;
  if (latitude !== undefined && latitude !== null && latitude < 17 && ymd < 19750613) return 8;
  return 7;
}

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): [number, number, number] {
  let b: number, c: number;
  if (jd > 2299160) { const a = jd + 32044; b = Math.floor((4 * a + 3) / 146097); c = a - Math.floor((b * 146097) / 4); }
  else { b = 0; c = jd + 32082; }
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor((1461 * d) / 4), m = Math.floor((5 * e + 2) / 153);
  return [e - Math.floor((153 * m + 2) / 5) + 1, m + 3 - 12 * Math.floor(m / 10), b * 100 + d - 4800 + Math.floor(m / 10)];
}

function newMoon(k: number): number {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * Math.floor(L / (PI * 2));
  return L;
}

const sunLong = (dayNumber: number, tz: number) => Math.floor((sunLongitude(dayNumber - 0.5 - tz / 24) / PI) * 6);
const newMoonDay = (k: number, tz: number) => Math.floor(newMoon(k) + 0.5 + tz / 24);

function lunarMonth11(yy: number, tz: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021, k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k, tz);
  if (sunLong(nm, tz) >= 9) nm = newMoonDay(k - 1, tz);
  return nm;
}

function leapMonthOffset(a11: number, tz: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0, i = 1, arc = sunLong(newMoonDay(k + i, tz), tz);
  do { last = arc; i++; arc = sunLong(newMoonDay(k + i, tz), tz); } while (arc !== last && i < 14);
  return i - 1;
}

export interface LunarDate { day: number; month: number; year: number; leap: boolean }

export function solarToLunar(dd: number, mm: number, yy: number, tz = 7): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy), k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz);
  let a11 = lunarMonth11(yy, tz), b11 = a11, year: number;
  if (a11 >= monthStart) { year = yy; a11 = lunarMonth11(yy - 1, tz); }
  else { year = yy + 1; b11 = lunarMonth11(yy + 1, tz); }
  const day = dayNumber - monthStart + 1, diff = Math.floor((monthStart - a11) / 29);
  let leap = false, month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, tz);
    if (diff >= leapDiff) { month = diff + 10; if (diff === leapDiff) leap = true; }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

/** null when that lunar date does not exist (no such leap month that year) */
export function lunarToSolar(day: number, month: number, year: number, leap: boolean, tz = 7): [number, number, number] | null {
  let a11: number, b11: number;
  if (month < 11) { a11 = lunarMonth11(year - 1, tz); b11 = lunarMonth11(year, tz); }
  else { a11 = lunarMonth11(year, tz); b11 = lunarMonth11(year + 1, tz); }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  return jdToDate(newMoonDay(k + off, tz) + day - 1);
}

/** the leap month of a lunar year (0 if none) */
export function leapMonthOf(year: number, tz = 7): number {
  for (let m = 1; m <= 12; m++) if (lunarToSolar(1, m, year, true, tz)) return m;
  return 0;
}

/** 29 or 30 */
export function lunarMonthLength(month: number, year: number, leap: boolean, tz = 7): number {
  const start = lunarToSolar(1, month, year, leap, tz);
  if (!start) return 0;
  const [d, m, y] = jdToDate(jdFromDate(start[0], start[1], start[2]) + 29);
  const nx = solarToLunar(d, m, y, tz);
  return nx.day === 1 ? 29 : 30;
}
