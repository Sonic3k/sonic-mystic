/* Each room's key figure of a person, small enough for a row: the chính tinh of cung Mệnh (worked out here, the
   engine runs in the browser), the Sun, Moon and Ascendant (the API's ephemeris: read from the brief it keeps), the
   ruling and birthday numbers (worked out here). */
import { buildChart, type Level } from '@mystic/engine/tuvi';
import { birthInputOf, solarDateOf } from '@mystic/engine/birth';
import { buildNumerology } from '@mystic/engine/numerology';
import { SIGNS, type SignCode } from '@mystic/engine/astrology';
import type { BriefDto, ProfileSummaryDto, SubjectDto } from '@mystic/engine/api';

/** a person's newest profile in a room */
export const newest = (s: SubjectDto, discipline: string) =>
  s.profiles.filter(p => p.discipline === discipline).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

export interface TuviBadge { stars: { name: string; level?: Level }[]; branch: number }
export function tuviBadge(p: ProfileSummaryDto): TuviBadge | null {
  try {
    const c = buildChart(birthInputOf(p.gender, p.birth));
    return { stars: c.palaces[c.menh].stars.filter(s => s.kind === 'chinh').map(s => ({ name: s.name, level: s.level })), branch: c.menh };
  } catch { return null; }
}

export interface NumBadge { ruling: number; birthday: number }
export function numBadge(p: ProfileSummaryDto): NumBadge | null {
  const b = p.birth;
  if (!b.day || !b.month || !b.year) return null;
  try {
    const s = solarDateOf({ calendar: b.calendar, year: b.year, month: b.month, day: b.day, leapMonth: b.leapMonth, latitude: b.latitude });
    const c = buildNumerology({ year: s.year, month: s.month, day: s.day, gender: p.gender, names: [] });
    return { ruling: c.ruling, birthday: c.birthday };
  } catch { return null; }
}

export interface AstroBadge { sun: SignCode; moon: SignCode | null; asc: SignCode | null }
const signIn = (v: string | undefined) => (v ? SIGNS.find(s => v.includes(s.name))?.code ?? null : null);
export function astroBadge(b: BriefDto): AstroBadge | null {
  const f = (label: string) => b.facts.find(x => x.label === label)?.value;
  const sun = signIn(f('Mặt Trời'));
  return sun ? { sun, moon: signIn(f('Mặt Trăng')), asc: signIn(f('Cung Mọc')) } : null;
}
