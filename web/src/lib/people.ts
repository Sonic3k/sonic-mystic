/* How a person and a birth read in a line. */
import type { BirthDto, Gender } from '@mystic/engine/api';
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

export const SONIC_HUB = 'sonic-hub';
