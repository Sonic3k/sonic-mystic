/* How a person and a birth read in a line. */
import type { BirthDto, Gender, SubjectDto } from '@mystic/engine/api';
import { HOURS } from './params';

export const genderName = (g: Gender | null) => (g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : null);

/** "8/2/1990 · 09:05 (ước chừng) · Hà Nội" — whatever is known */
export function birthLine(b: BirthDto): string {
  const parts: string[] = [];
  if (b.day && b.month && b.year) parts.push(`${b.day}/${b.month}${b.calendar === 'lunar' && b.leapMonth ? ' nhuận' : ''}/${b.year}${b.calendar === 'lunar' ? ' âm lịch' : ''}`);
  else if (b.year) parts.push(`năm ${b.year}`);
  const t = b.time ?? (b.hourBranch !== null ? `giờ ${HOURS[b.hourBranch].n}` : null);
  if (t) parts.push(`${t}${b.timeApprox ? ' (ước chừng)' : ''}`);
  if (b.place) parts.push(b.place);
  return parts.join(' · ');
}

/** "8/2/1990 lúc 09:05 (ước chừng), Hà Nội": the birth as a sentence says it */
export function birthPhrase(b: BirthDto): string {
  const d = b.day && b.month && b.year ? `${b.day}/${b.month}${b.calendar === 'lunar' && b.leapMonth ? ' nhuận' : ''}/${b.year}${b.calendar === 'lunar' ? ' âm lịch' : ''}` : b.year ? `năm ${b.year}` : '';
  const t = b.time ? `lúc ${b.time}` : b.hourBranch !== null ? `giờ ${HOURS[b.hourBranch].n}` : '';
  return [[d, t && `${t}${b.timeApprox ? ' (ước chừng)' : ''}`].filter(Boolean).join(' '), b.place].filter(Boolean).join(', ');
}

/** a birth complete enough to set up a chart */
export const birthComplete = (g: Gender | null, b: BirthDto) => !!g && !!b.year && !!b.month && !!b.day && (!!b.time || b.hourBranch !== null);

/** a date complete enough for the numbers (no hour needed) */
export const dateComplete = (b: BirthDto) => !!b.year && !!b.month && !!b.day;

/** "2 lá số tử vi · 1 lá số chiêm tinh · 1 hồ sơ nhân số học" */
export function profilesLine(s: SubjectDto): string {
  const n = (d: string) => s.profiles.filter(p => p.discipline === d).length;
  const tuvi = n('tuvi'), numerology = n('numerology'), astro = n('astrology');
  return [tuvi ? `${tuvi} lá số tử vi` : '', astro ? `${astro} lá số chiêm tinh` : '', numerology ? `${numerology} hồ sơ nhân số học` : ''].filter(Boolean).join(' · ') || 'chưa có lá số';
}

export const SONIC_HUB = 'sonic-hub';
