/* How a person and a birth read in a line. */
import type { BirthDto, Gender, SubjectDto } from '@mystic/engine/api';
import type { Gender as ChartGender } from '@mystic/engine/tuvi';
import { GIO } from './params';

export const genderName = (g: Gender | null) => (g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : null);
export const genderOf = (g: ChartGender): Gender => (g === 'nam' ? 'male' : 'female');

/** "8/2/1990 · 09:05 (ước chừng) · Hà Nội" — whatever is known */
export function birthLine(b: BirthDto): string {
  const parts: string[] = [];
  if (b.day && b.month && b.year) parts.push(`${b.day}/${b.month}${b.calendar === 'lunar' && b.leapMonth ? ' nhuận' : ''}/${b.year}${b.calendar === 'lunar' ? ' âm lịch' : ''}`);
  else if (b.year) parts.push(`năm ${b.year}`);
  const t = b.time ?? (b.hourBranch !== null ? `giờ ${GIO[b.hourBranch].n}` : null);
  if (t) parts.push(`${t}${b.timeApprox ? ' (ước chừng)' : ''}`);
  if (b.place) parts.push(b.place);
  return parts.join(' · ');
}

/** a birth complete enough to set up a chart */
export const birthComplete = (g: Gender | null, b: BirthDto) => !!g && !!b.year && !!b.month && !!b.day && (!!b.time || b.hourBranch !== null);

/** a date complete enough for the numbers (no hour needed) */
export const dateComplete = (b: BirthDto) => !!b.year && !!b.month && !!b.day;

/** "2 lá số · 1 hồ sơ nhân số học" */
export function profilesLine(s: SubjectDto): string {
  const tuvi = s.profiles.filter(p => p.discipline === 'tuvi').length, ns = s.profiles.filter(p => p.discipline === 'numerology').length;
  return [tuvi ? `${tuvi} lá số` : '', ns ? `${ns} hồ sơ nhân số học` : ''].filter(Boolean).join(' · ') || 'chưa có lá số';
}

export const SONIC_HUB = 'sonic-hub';
