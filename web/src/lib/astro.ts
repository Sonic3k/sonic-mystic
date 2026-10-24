/* Chiêm tinh as a link: the birth (date, clock time, zone, place) lives in the URL, so a chart can be opened again,
   bookmarked or sent; and the small helpers every astrology page shares. */
import { PLACES } from '@mystic/engine/birth';
import type { AstrologyBirthDto, AstrologyRequest, AstrologyVoice, BirthDto, Gender } from '@mystic/engine/api';
import type { Topic } from '@mystic/engine/astrology';

export interface AstroParams {
  /** whose chart, as typed (only shown) */
  name: string;
  birth: AstrologyBirthDto;
  gender: Gender | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "8°59′" — the degree and minute within the sign */
export function dm(lon: number): string {
  const d = ((lon % 360) + 360) % 360 % 30;
  const deg = Math.floor(d), min = Math.floor((d - deg) * 60 + 1e-9);
  return `${deg}°${pad(min)}′`;
}

/** "UTC−6", "UTC+5:30" */
export function offsetText(min: number): string {
  const a = Math.abs(min);
  return `UTC${min >= 0 ? '+' : '−'}${Math.floor(a / 60)}${a % 60 ? `:${pad(a % 60)}` : ''}`;
}

/** "33°03′ B, 89°35′ T" */
export function latLonText(lat: number, lon: number): string {
  const f = (x: number) => `${Math.floor(Math.abs(x))}°${pad(Math.round((Math.abs(x) % 1) * 60))}′`;
  return `${f(lat)} ${lat >= 0 ? 'B' : 'N'}, ${f(lon)} ${lon >= 0 ? 'Đ' : 'T'}`;
}

/** the zones a birth can be read in: by place (with summer time and the changes of history), or a fixed offset */
export const ZONES: { value: string; label: string }[] = [
  { value: 'tz:Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (theo lịch sử)' },
  ...[
    ['Asia/Bangkok', 'Bangkok'], ['Asia/Shanghai', 'Bắc Kinh'], ['Asia/Singapore', 'Singapore'], ['Asia/Tokyo', 'Tokyo'], ['Asia/Seoul', 'Seoul'],
    ['Australia/Sydney', 'Sydney'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris'], ['Europe/Berlin', 'Berlin'], ['Europe/Moscow', 'Moskva'],
    ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Denver', 'Denver'], ['America/Los_Angeles', 'Los Angeles'],
  ].map(([tz, city]) => ({ value: `tz:${tz}`, label: `${tz} (${city}, theo lịch sử)` })),
  ...[-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 9, 9.5, 10, 11, 12, 13, 14].map(h => {
    const min = Math.round(h * 60);
    const hint: Record<number, string> = { [-360]: ' (giờ miền Trung Hoa Kỳ)', [-300]: ' (giờ miền Đông Hoa Kỳ)', [-480]: ' (giờ Thái Bình Dương)', 0: ' (Greenwich)', 420: ' (Việt Nam)', 480: ' (Việt Nam trước 1975, Trung Quốc)' };
    return { value: `off:${min}`, label: `${offsetText(min)}${hint[min] ?? ''}` };
  }),
];
export const zoneOf = (b: Pick<AstrologyBirthDto, 'timeZone' | 'utcOffsetMinutes'>) => (b.timeZone ? `tz:${b.timeZone}` : b.utcOffsetMinutes !== null ? `off:${b.utcOffsetMinutes}` : 'tz:Asia/Ho_Chi_Minh');
export const zoneFields = (v: string): Pick<AstrologyBirthDto, 'timeZone' | 'utcOffsetMinutes'> =>
  (v.startsWith('off:') ? { timeZone: null, utcOffsetMinutes: Number(v.slice(4)) } : { timeZone: v.slice(3) || 'Asia/Ho_Chi_Minh', utcOffsetMinutes: null });

/** a known place by its name (Hà Nội, Huế…) */
export const placeNamed = (name: string) => PLACES.find(p => p.name.toLowerCase() === name.trim().toLowerCase()) ?? null;

export function toAstroSearch(p: AstroParams): string {
  const s = new URLSearchParams();
  if (p.name) s.set('name', p.name);
  const b = p.birth;
  s.set('date', `${b.year}-${pad(b.month)}-${pad(b.day)}`);
  if (b.time) s.set('time', b.time);
  if (b.timeApprox) s.set('approx', '1');
  if (b.timeZone) s.set('tz', b.timeZone); else if (b.utcOffsetMinutes !== null) s.set('utc', String(b.utcOffsetMinutes));
  if (b.place) s.set('place', b.place);
  if (b.latitude !== null && b.longitude !== null) { s.set('lat', String(b.latitude)); s.set('lon', String(b.longitude)); }
  if (p.gender) s.set('gender', p.gender);
  return s.toString();
}

export function fromAstroSearch(sp: URLSearchParams): AstroParams | null {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(sp.get('date') ?? '');
  if (!d) return null;
  const time = /^\d{1,2}:\d{2}$/.test(sp.get('time') ?? '') ? sp.get('time')!.padStart(5, '0') : null;
  const lat = Number(sp.get('lat')), lon = Number(sp.get('lon'));
  const has = sp.get('lat') !== null && sp.get('lon') !== null && Number.isFinite(lat) && Number.isFinite(lon);
  const utc = sp.get('utc');
  return {
    name: sp.get('name') ?? '',
    birth: {
      year: +d[1], month: +d[2], day: +d[3], time, timeApprox: sp.get('approx') === '1',
      timeZone: sp.get('tz') ?? (utc === null ? 'Asia/Ho_Chi_Minh' : null), utcOffsetMinutes: utc !== null && Number.isFinite(Number(utc)) ? Number(utc) : null,
      place: sp.get('place'), latitude: has ? lat : null, longitude: has ? lon : null,
    },
    gender: sp.get('gender') === 'female' ? 'female' : sp.get('gender') === 'male' ? 'male' : null,
  };
}

export const astroRequest = (p: AstroParams): AstrologyRequest => ({ birth: p.birth, gender: p.gender });

/** a stored birth (a person, a profile) as the chart reads it — a lunar date is read by the API */
export function astroBirthOfDto(b: BirthDto): AstrologyBirthDto | null {
  if (!b.year || !b.month || !b.day || b.calendar !== 'solar') return null;
  return { year: b.year, month: b.month, day: b.day, time: b.time, timeApprox: b.timeApprox, timeZone: b.timeZone, utcOffsetMinutes: b.utcOffsetMinutes, place: b.place, latitude: b.latitude, longitude: b.longitude };
}

/** whose words a passage is: [class of its colour, its name] */
export const VOICE: Record<AstrologyVoice, [string, string]> = {
  hk: ['hk', 'Lời cô'], notes: ['notes', 'Ghi chép lớp'], tierney: ['tie', 'Bản dịch Tierney'], woolfolk: ['wf', 'Woolfolk · Claude dịch'],
  books: ['books', 'Sách khác · Claude dịch'], claude: ['claude', 'Claude tổng hợp'],
};

/** the parts of a reading, in the order the page shows them */
export const PART_ORDER: Topic[] = ['sun', 'moon', 'asc', 'planet', 'sign', 'house', 'aspect', 'pattern', 'dominant', 'point', 'love'];
export const PART_TITLE: Record<Topic, string> = {
  overview: 'Tổng quan', sun: 'Mặt Trời', moon: 'Mặt Trăng', asc: 'Cung Mọc', planet: 'Các hành tinh', sign: 'Dấu hiệu', house: 'Cung địa bàn',
  aspect: 'Góc chiếu', pattern: 'Cấu trúc', dominant: 'Nhân tố trội', point: 'Các điểm khác', love: 'Tình yêu',
};

/** a title written all in capitals (the textbook's and Tierney's headings) */
export const isCaps = (t: string) => t.toUpperCase() === t && t.toLowerCase() !== t;

/** Oprah Winfrey, whose chart Woolfolk reads in her chapter 9 */
export const SAMPLE: AstroParams = {
  name: 'Oprah Winfrey',
  birth: { year: 1954, month: 1, day: 29, time: '04:30', timeApprox: false, timeZone: null, utcOffsetMinutes: -360, place: 'Kosciusko, Mississippi', latitude: 33.05, longitude: -89.583333 },
  gender: 'female',
};
export const isSample = (b: AstrologyBirthDto) => b.year === 1954 && b.month === 1 && b.day === 29 && b.time === '04:30' && b.latitude === 33.05;
export const SAMPLE_LABEL = 'ví dụ trong sách';
