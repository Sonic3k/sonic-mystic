/* The slow planets as they move over a birth chart through a span of time (khách tinh, "transit", in cô's glossary;
   hồi vị, a "return", when one passes its own place): which house of the chart each is in and from when to when, the
   major aspects each makes to the chart's planets and angles (within 1°, with the days it is exact), and its stations.
   Pure computation from the sky day by day, which the API takes from the ephemeris. What a transit means is read
   from her keywords for the planet and the house — the sources have no chapter of their own on transits. */
import type { AstroChart } from './chart.js';
import { houseOf } from './chart.js';
import { BODY, SIGN, norm, signOf, type BodyCode, type SignCode } from './zodiac.js';

export type TransitBody = 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export const TRANSIT_BODIES: TransitBody[] = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export type TransitAspect = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
const ANGLE: Record<TransitAspect, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
const ASPECT_NAME: Record<TransitAspect, string> = { conjunction: 'đồng vị', sextile: 'lục hợp', square: 'vuông góc', trine: 'tam hợp', opposition: 'xung' };
/** what a transit touches: the planets and the angles (AC, MC) */
const TARGETS: BodyCode[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc'];

/** the sky on a day (noon UT): each slow planet's longitude and its speed in degrees a day */
export interface SkyDay { date: string; bodies: Partial<Record<TransitBody, { lon: number; speed: number }>> }
/** a planet's stay in a house of the chart (and the sign it moves through there) */
export interface TransitStay { body: TransitBody; house: number | null; sign: SignCode; from: string; to: string; text: string }
/** a major aspect a planet makes to the chart: the days it is within orb, and the days it is exact */
export interface TransitContact { body: TransitBody; target: BodyCode; aspect: TransitAspect; from: string; to: string; exact: string[]; text: string }
/** a planet standing still before it turns */
export interface TransitStation { body: TransitBody; date: string; turns: 'retro' | 'direct'; lon: number }
export interface Transits { from: string; to: string; stays: TransitStay[]; contacts: TransitContact[]; stations: TransitStation[] }

const nameOf = (b: BodyCode) => (b === 'asc' ? 'AC' : b === 'mc' ? 'MC' : BODY[b].name);
/** (-180, 180] */
const signed = (x: number) => ((x % 360) + 540) % 360 - 180;
/** how far a transit is from making an aspect to a point, signed (it is exact where this crosses 0) */
const offsetOf = (moving: number, fixed: number, angle: number) => {
  const d = norm(moving - fixed);
  if (angle === 0 || angle === 180) return signed(d - angle);
  const a = signed(d - angle), z = signed(d - (360 - angle));
  return Math.abs(a) <= Math.abs(z) ? a : z;
};
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}/${y}`; };

export function transitsOf(natal: AstroChart, days: SkyDay[], orb = 1): Transits {
  const cusps = natal.houses?.map(h => h.lon) ?? null;
  const stays: TransitStay[] = [], contacts: TransitContact[] = [], stations: TransitStation[] = [];
  for (const b of TRANSIT_BODIES) {
    const run = days.filter(d => d.bodies[b]);
    if (!run.length) continue;
    // stays: consecutive days in the same house and sign
    let cur: TransitStay | null = null;
    for (const d of run) {
      const lon = d.bodies[b]!.lon, house = cusps ? houseOf(lon, cusps) : null, sign = signOf(lon);
      if (cur && cur.house === house && cur.sign === sign) { cur.to = d.date; continue; }
      cur = { body: b, house, sign, from: d.date, to: d.date, text: '' };
      stays.push(cur);
    }
    // stations: where the speed changes sign
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1].bodies[b]!.speed, z = run[i].bodies[b]!.speed;
      if (a > 0 !== z > 0) stations.push({ body: b, date: run[i].date, turns: z < 0 ? 'retro' : 'direct', lon: run[i].bodies[b]!.lon });
    }
    // contacts: each target, each aspect, the runs of days within orb
    for (const t of TARGETS) {
      const p = natal.placements[t];
      if (!p || ((t === 'asc' || t === 'mc') && !natal.timeKnown)) continue;
      for (const k of Object.keys(ANGLE) as TransitAspect[]) {
        let c: TransitContact | null = null, prev: number | null = null;
        for (const d of run) {
          const off = offsetOf(d.bodies[b]!.lon, p.lon, ANGLE[k]);
          if (Math.abs(off) <= orb) {
            if (!c) { c = { body: b, target: t, aspect: k, from: d.date, to: d.date, exact: [], text: '' }; contacts.push(c); }
            c.to = d.date;
            if (prev !== null && (prev === 0 || off === 0 || prev > 0 !== off > 0)) c.exact.push(d.date);
          } else c = null;
          prev = Math.abs(off) <= orb ? off : null;
        }
      }
    }
  }
  for (const s of stays) s.text = `${BODY[s.body].name} ở ${SIGN[s.sign].name}${s.house ? `, cung ${s.house}` : ''}: ${dmy(s.from)} – ${dmy(s.to)}`;
  for (const c of contacts) {
    const back = c.body === c.target && c.aspect === 'conjunction' ? ' (hồi vị)' : '';
    c.text = `${BODY[c.body].name} ${ASPECT_NAME[c.aspect]} ${nameOf(c.target)} gốc${back}: ${dmy(c.from)} – ${dmy(c.to)}${c.exact.length ? `, đúng góc ${c.exact.map(dmy).join(', ')}` : ''}`;
  }
  contacts.sort((a, b) => a.from.localeCompare(b.from));
  return { from: days[0]?.date ?? '', to: days[days.length - 1]?.date ?? '', stays, contacts, stations };
}

/** the stays and contacts as lines, in the order of the planets and then of time */
export const transitLines = (t: Transits) => [...t.stays.map(s => s.text), ...t.contacts.map(c => c.text)];
