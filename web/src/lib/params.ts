/* A chart as a link: the birth and the options live in the URL, so a chart can be opened again, bookmarked or sent. */
import type { BirthInput, ChartOptions } from '@mystic/engine/tuvi';
import type { BirthDto, ProfileDto, SubjectDto, TuViSettings } from '@mystic/engine/api';
import { PLACES, birthInputOf } from '@mystic/engine/birth';

export interface ChartParams { name: string; input: BirthInput; options: ChartOptions }

const pad = (n: number) => String(n).padStart(2, '0');
export const thisYear = () => new Date().getFullYear();

export function toSearch(p: ChartParams): string {
  const { input: i, options: o } = p, s = new URLSearchParams();
  if (p.name) s.set('n', p.name);
  s.set('g', i.gender);
  s.set('c', i.calendar === 'solar' ? 'd' : 'a');
  s.set('ngay', `${i.year}-${pad(i.month)}-${pad(i.day)}`);
  s.set('gio', i.calendar === 'solar' ? `${pad(i.hour)}:${pad(i.minute ?? 0)}` : String(i.hour));
  if (i.calendar === 'lunar' && i.leap) s.set('nhuan', '1');
  if (i.latitude != null && i.longitude != null) s.set('noi', `${i.latitude},${i.longitude}`);
  if (i.utcOffsetMinutes != null && i.utcOffsetMinutes !== 420) s.set('mui', String(i.utcOffsetMinutes));
  if (o.variant === 'sach') s.set('an', 'sach');
  if (o.leapMonth === 'split15') s.set('thangnhuan', '15');
  if (!o.tyNextDay) s.set('ty', 'cung-ngay');
  if (o.lunarCalendar && o.lunarCalendar !== 'auto') s.set('lich', o.lunarCalendar === 'utc8' ? '8' : '7');
  if (o.hourBasis === 'true_solar') s.set('gio-mat-troi', '1');
  if (o.viewYear !== thisYear()) s.set('nam', String(o.viewYear));
  return s.toString();
}

export function fromSearch(sp: URLSearchParams): ChartParams | null {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(sp.get('ngay') ?? '');
  if (!d) return null;
  const calendar = sp.get('c') === 'a' ? 'lunar' : 'solar';
  const g = sp.get('g') === 'nu' ? 'nu' : 'nam';
  const t = sp.get('gio') ?? '';
  let hour = 0, minute = 0;
  if (calendar === 'solar') { const m = /^(\d{1,2}):(\d{2})$/.exec(t); if (!m) return null; hour = +m[1]; minute = +m[2]; }
  else { hour = Number(t); if (!Number.isInteger(hour) || hour < 0 || hour > 11) return null; }
  const year = Number(sp.get('nam') ?? thisYear());
  const place = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(sp.get('noi') ?? '');
  const mui = Number(sp.get('mui'));
  return {
    name: sp.get('n') ?? '',
    input: {
      gender: g, calendar, year: +d[1], month: +d[2], day: +d[3], leap: sp.get('nhuan') === '1', hour, minute,
      latitude: place ? +place[1] : null, longitude: place ? +place[2] : null, utcOffsetMinutes: Number.isInteger(mui) && sp.get('mui') ? mui : 420,
    },
    options: {
      variant: sp.get('an') === 'sach' ? 'sach' : 'ba', leapMonth: sp.get('thangnhuan') === '15' ? 'split15' : 'same', tyNextDay: sp.get('ty') !== 'cung-ngay',
      lunarCalendar: sp.get('lich') === '8' ? 'utc8' : sp.get('lich') === '7' ? 'utc7' : 'auto', hourBasis: sp.get('gio-mat-troi') === '1' ? 'true_solar' : 'clock',
      viewYear: Number.isInteger(year) ? year : thisYear(),
    },
  };
}

export const settingsOf = (o: ChartOptions): TuViSettings => ({
  variant: o.variant, leapMonth: o.leapMonth, tyNextDay: o.tyNextDay, lunarCalendar: o.lunarCalendar ?? 'auto', hourBasis: o.hourBasis ?? 'clock',
});

/** how a tử vi profile places its stars (the defaults for a profile that stored none) */
export const tuviSettings = (p: ProfileDto): TuViSettings => p.settings ?? { variant: 'ba', leapMonth: 'same', tyNextDay: true, lunarCalendar: 'auto', hourBasis: 'clock' };

export const fromProfile = (p: ProfileDto, viewYear = p.viewYear ?? thisYear()): ChartParams => ({
  name: p.subject.displayName,
  input: birthInputOf(p.gender, p.birth),
  options: { ...tuviSettings(p), viewYear },
});

export const blankParams = (): ChartParams => ({
  name: '',
  input: { gender: 'nam', calendar: 'solar', year: 1990, month: 1, day: 1, hour: 12, minute: 0, latitude: null, longitude: null, utcOffsetMinutes: 420 },
  options: { variant: 'ba', leapMonth: 'same', tyNextDay: true, lunarCalendar: 'auto', hourBasis: 'clock', viewYear: thisYear() },
});

/** the birth form filled with what is known of a person (anything missing keeps the form's default) */
export function fromSubject(s: SubjectDto): ChartParams {
  const p = blankParams(), i = p.input, b = s.birth;
  p.name = s.displayName;
  if (s.gender) i.gender = s.gender === 'male' ? 'nam' : 'nu';
  if (b.year && b.month && b.day) Object.assign(i, { calendar: b.calendar, year: b.year, month: b.month, day: b.day, leap: b.calendar === 'lunar' && b.leapMonth });
  if (i.calendar === 'solar') {
    if (b.time) { const [h, m] = b.time.split(':').map(Number); i.hour = h; i.minute = m; }
    else if (b.hourBranch !== null) { i.hour = (b.hourBranch * 2) % 24; i.minute = 0; }
  } else {
    i.hour = b.hourBranch ?? (b.time ? Math.floor((Number(b.time.split(':')[0]) + 1) / 2) % 12 : 6);
  }
  i.latitude = b.latitude; i.longitude = b.longitude; i.utcOffsetMinutes = b.utcOffsetMinutes ?? 420;
  return p;
}

/** a chart's birth as the API stores it (for saving a chart as a profile) */
export function birthDtoOf(i: BirthInput): Partial<BirthDto> {
  const place = PLACES.find(p => p.latitude === i.latitude && p.longitude === i.longitude)?.name;
  const where = { latitude: i.latitude ?? null, longitude: i.longitude ?? null, utcOffsetMinutes: i.utcOffsetMinutes ?? null, ...(place ? { place } : {}) };
  return i.calendar === 'solar'
    ? { calendar: 'solar', year: i.year, month: i.month, day: i.day, leapMonth: false, time: `${pad(i.hour)}:${pad(i.minute ?? 0)}`, hourBranch: null, ...where }
    : { calendar: 'lunar', year: i.year, month: i.month, day: i.day, leapMonth: !!i.leap, time: null, hourBranch: i.hour, ...where };
}

/** the clock's UTC offset a birth most likely had: the South used UTC+8 from 1960 to 13/6/1975 */
export function clockOffsetFor(i: BirthInput): number {
  const ymd = i.year * 10000 + i.month * 100 + i.day;
  return i.calendar === 'solar' && i.latitude != null && i.latitude < 17 && ymd >= 19600101 && ymd < 19750613 ? 480 : 420;
}

export const chartHref = (p: ChartParams) => `/tu-vi/la-so?${toSearch(p)}`;
export const GIO = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'].map((n, i) => ({
  n, i, span: i === 0 ? '23–1 giờ' : `${2 * i - 1}–${2 * i + 1} giờ`,
}));
