/* A stored birth (as the API returns it) → the engine's input. Shared by the API and the webs so both read a profile
   the same way. */
import type { BirthDto, Gender } from './api.js';
import type { BirthInput } from './tuvi/index.js';
import { lunarMonthLength, lunarToSolar, lunarZoneFor } from './tuvi/lunar.js';

export class BirthError extends Error {}

export interface SolarDate {
  year: number; month: number; day: number;
  /** the birth was written in the lunar calendar, and converted with the calendar of its time (zone: UTC+7 or +8) */
  fromLunar: boolean; zone: 7 | 8 | null;
}

/**
 * The solar date of a birth (what Nhân số học reads): as written, or converted from the lunar date. A lunar date is
 * converted with the calendar it was written in — UTC+8 before 1968, and in the South (latitude below 17°) until
 * 13/6/1975 — as the Tử vi chart does.
 */
export function solarDateOf(b: Pick<BirthDto, 'calendar' | 'year' | 'month' | 'day' | 'leapMonth' | 'latitude'>): SolarDate {
  if (b.year === null || b.month === null || b.day === null) throw new BirthError('Chưa có đủ ngày tháng năm sinh');
  const { year, month, day } = b;
  if (b.calendar === 'solar') {
    const t = new Date(Date.UTC(year, month - 1, day));
    if (month < 1 || month > 12 || day < 1 || t.getUTCMonth() !== month - 1) throw new BirthError(`Không có ngày ${day}/${month}/${year} dương lịch`);
    return { year, month, day, fromLunar: false, zone: null };
  }
  if (month < 1 || month > 12 || day < 1 || day > 30) throw new BirthError(`Không có ngày ${day}/${month}/${year} âm lịch`);
  const leap = !!b.leapMonth;
  const at = (tz: 7 | 8) => lunarToSolar(day, month, year, leap, tz);
  let s = at(7), zone: 7 | 8 = 7;
  const s8 = at(8);
  if (s8 && lunarZoneFor(s8[0], s8[1], s8[2], b.latitude) === 8) { s = s8; zone = 8; }
  if (!s) throw new BirthError(leap ? `Năm âm lịch ${year} không có tháng ${month} nhuận` : `Không đổi được ngày ${day}/${month}/${year} âm lịch`);
  if (day > lunarMonthLength(month, year, leap, zone)) throw new BirthError(`Tháng ${month}${leap ? ' nhuận' : ''} năm ${year} âm lịch chỉ có 29 ngày`);
  return { day: s[0], month: s[1], year: s[2], fromLunar: true, zone };
}

/** the engine's input for a birth; a BirthError names what is missing when a chart cannot be set up */
export function birthInputOf(gender: Gender | null, b: BirthDto): BirthInput {
  if (!gender) throw new BirthError('Chưa có giới tính');
  if (b.year === null || b.month === null || b.day === null) throw new BirthError('Chưa có đủ ngày tháng năm sinh');
  let hour: number, minute: number | undefined;
  if (b.calendar === 'solar') {
    if (b.time) [hour, minute] = b.time.split(':').map(Number);
    else if (b.hourBranch !== null) { hour = (b.hourBranch * 2) % 24; minute = 0; }   // the middle of that giờ
    else throw new BirthError('Chưa có giờ sinh');
  } else {
    if (b.hourBranch !== null) hour = b.hourBranch;
    else if (b.time) hour = Math.floor((Number(b.time.split(':')[0]) + 1) / 2) % 12;
    else throw new BirthError('Chưa có giờ sinh');
  }
  return {
    gender: gender === 'male' ? 'nam' : 'nu', calendar: b.calendar, year: b.year, month: b.month, day: b.day,
    leap: b.calendar === 'lunar' && b.leapMonth, hour, minute,
    latitude: b.latitude, longitude: b.longitude, utcOffsetMinutes: b.utcOffsetMinutes,
  };
}

/** a few birthplaces with their coordinates (latitude picks the lunar calendar of 1968–1975; longitude, sun time) */
export const PLACES: { name: string; latitude: number; longitude: number }[] = [
  { name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542 },
  { name: 'Hải Phòng', latitude: 20.8449, longitude: 106.6881 },
  { name: 'Nam Định', latitude: 20.4388, longitude: 106.1621 },
  { name: 'Thanh Hóa', latitude: 19.8067, longitude: 105.7852 },
  { name: 'Vinh', latitude: 18.6796, longitude: 105.6813 },
  { name: 'Huế', latitude: 16.4637, longitude: 107.5909 },
  { name: 'Đà Nẵng', latitude: 16.0544, longitude: 108.2022 },
  { name: 'Nha Trang', latitude: 12.2388, longitude: 109.1967 },
  { name: 'Đà Lạt', latitude: 11.9404, longitude: 108.4583 },
  { name: 'TP Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297 },
  { name: 'Cần Thơ', latitude: 10.0452, longitude: 105.7469 },
];
