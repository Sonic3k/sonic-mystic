/* A chart as a link: the birth and the options live in the URL, so a chart can be opened again, bookmarked or sent. */
import type { BirthInput, ChartOptions } from '@mystic/engine/tuvi';
import type { BirthDto, ProfileDto, SubjectDto, TuViSettings } from '@mystic/engine/api';
import { PLACES, birthInputOf } from '@mystic/engine/birth';

export interface ChartParams { name: string; input: BirthInput; options: ChartOptions }

const pad = (n: number) => String(n).padStart(2, '0');
export const thisYear = () => new Date().getFullYear();

export function toSearch(p: ChartParams): string {
  const { input: i, options: o } = p, s = new URLSearchParams();
  if (p.name) s.set('name', p.name);
  s.set('gender', i.gender);
  s.set('calendar', i.calendar);
  s.set('date', `${i.year}-${pad(i.month)}-${pad(i.day)}`);
  s.set('time', i.calendar === 'solar' ? `${pad(i.hour)}:${pad(i.minute ?? 0)}` : String(i.hour));
  if (i.calendar === 'lunar' && i.leap) s.set('leap', '1');
  if (i.latitude != null && i.longitude != null) s.set('place', `${i.latitude},${i.longitude}`);
  if (i.utcOffsetMinutes != null && i.utcOffsetMinutes !== 420) s.set('utc', String(i.utcOffsetMinutes));
  if (o.variant === 'books') s.set('variant', 'books');
  if (o.leapMonth === 'split15') s.set('leapmonth', 'split15');
  if (!o.tyNextDay) s.set('ty', 'same-day');
  if (o.lunarCalendar && o.lunarCalendar !== 'auto') s.set('lunar', o.lunarCalendar);
  if (o.hourBasis === 'true_solar') s.set('solartime', '1');
  if (o.viewYear !== thisYear()) s.set('year', String(o.viewYear));
  return s.toString();
}

export function fromSearch(sp: URLSearchParams): ChartParams | null {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(sp.get('date') ?? '');
  if (!d) return null;
  const calendar = sp.get('calendar') === 'lunar' ? 'lunar' : 'solar';
  const g = sp.get('gender') === 'female' ? 'female' : 'male';
  const t = sp.get('time') ?? '';
  let hour = 0, minute = 0;
  if (calendar === 'solar') { const m = /^(\d{1,2}):(\d{2})$/.exec(t); if (!m) return null; hour = +m[1]; minute = +m[2]; }
  else { hour = Number(t); if (!Number.isInteger(hour) || hour < 0 || hour > 11) return null; }
  const year = Number(sp.get('year') ?? thisYear());
  const place = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(sp.get('place') ?? '');
  const utc = Number(sp.get('utc'));
  const lunar = sp.get('lunar');
  return {
    name: sp.get('name') ?? '',
    input: {
      gender: g, calendar, year: +d[1], month: +d[2], day: +d[3], leap: sp.get('leap') === '1', hour, minute,
      latitude: place ? +place[1] : null, longitude: place ? +place[2] : null, utcOffsetMinutes: Number.isInteger(utc) && sp.get('utc') ? utc : 420,
    },
    options: {
      variant: sp.get('variant') === 'books' ? 'books' : 'grandma', leapMonth: sp.get('leapmonth') === 'split15' ? 'split15' : 'same', tyNextDay: sp.get('ty') !== 'same-day',
      lunarCalendar: lunar === 'utc8' || lunar === 'utc7' ? lunar : 'auto', hourBasis: sp.get('solartime') === '1' ? 'true_solar' : 'clock',
      viewYear: Number.isInteger(year) ? year : thisYear(),
    },
  };
}

export const settingsOf = (o: ChartOptions): TuViSettings => ({
  variant: o.variant, leapMonth: o.leapMonth, tyNextDay: o.tyNextDay, lunarCalendar: o.lunarCalendar ?? 'auto', hourBasis: o.hourBasis ?? 'clock',
});

/** how a tử vi profile places its stars (the defaults for a profile that stored none) */
export const tuviSettings = (p: ProfileDto): TuViSettings => p.settings ?? { variant: 'grandma', leapMonth: 'same', tyNextDay: true, lunarCalendar: 'auto', hourBasis: 'clock' };

export const fromProfile = (p: ProfileDto, viewYear = p.viewYear ?? thisYear()): ChartParams => ({
  name: p.subject.displayName,
  input: birthInputOf(p.gender, p.birth),
  options: { ...tuviSettings(p), viewYear },
});

export const blankParams = (): ChartParams => ({
  name: '',
  input: { gender: 'male', calendar: 'solar', year: 1990, month: 1, day: 1, hour: 12, minute: 0, latitude: null, longitude: null, utcOffsetMinutes: 420 },
  options: { variant: 'grandma', leapMonth: 'same', tyNextDay: true, lunarCalendar: 'auto', hourBasis: 'clock', viewYear: thisYear() },
});

/** the birth form filled with what is known of a person (anything missing keeps the form's default) */
export function fromSubject(s: SubjectDto): ChartParams {
  const p = blankParams(), i = p.input, b = s.birth;
  p.name = s.displayName;
  if (s.gender) i.gender = s.gender;
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

export const chartHref = (p: ChartParams) => `/tu-vi/chart?${toSearch(p)}`;
export const HOURS = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'].map((n, i) => ({
  n, i, span: i === 0 ? '23–1 giờ' : `${2 * i - 1}–${2 * i + 1} giờ`,
}));
