/* A stored birth (as the API returns it) → the engine's input. Shared by the API and the webs so both read a profile
   the same way. */
import type { BirthDto, Gender } from './api.js';
import type { BirthInput } from './tuvi/index.js';

export class BirthError extends Error {}

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
