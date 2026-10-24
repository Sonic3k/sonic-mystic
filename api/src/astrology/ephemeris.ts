/* The sky at a moment, from the Swiss Ephemeris (the sweph package: the library astro.com computes with), in the
   form the astrology engine takes: tropical longitudes and daily speeds of the ten planets, Chiron, the true node and
   the mean Lilith; Placidus cusps, AC, MC and Vertex at the birthplace. The ephemeris files (planets, Moon, the
   asteroids for Chiron; 1800–2400) are in api/ephe. Swiss Ephemeris is AGPL-licensed, and so is this repository. */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sweph from 'sweph';
import type { AstroInput, AstroPositions, EphemerisBody } from '@mystic/engine/astrology';

const C = sweph.constants;
const FLAGS = C.SEFLG_SWIEPH | C.SEFLG_SPEED;
const BODIES: [EphemerisBody, number][] = [
  ['sun', C.SE_SUN], ['moon', C.SE_MOON], ['mercury', C.SE_MERCURY], ['venus', C.SE_VENUS], ['mars', C.SE_MARS],
  ['jupiter', C.SE_JUPITER], ['saturn', C.SE_SATURN], ['uranus', C.SE_URANUS], ['neptune', C.SE_NEPTUNE], ['pluto', C.SE_PLUTO],
  ['chiron', C.SE_CHIRON], ['north-node', C.SE_TRUE_NODE], ['lilith', C.SE_MEAN_APOG],
];

export class EphemerisError extends Error {}

let pathSet = false;
/** api/ephe, next to dist/ or src/ (EPHE_PATH overrides) */
function ensurePath(): void {
  if (pathSet) return;
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = process.env.EPHE_PATH ?? [join(here, '../../ephe'), join(here, '../../../ephe')].find(d => existsSync(join(d, 'sepl_18.se1')));
  if (!dir) throw new EphemerisError('Không tìm thấy các file lịch thiên văn (api/ephe)');
  sweph.set_ephe_path(dir);
  pathSet = true;
}

export interface LocalMoment { year: number; month: number; day: number; hour: number; minute: number }
/** the Julian day (UT) of a local moment at a UTC offset */
export function julianDay(t: LocalMoment, offsetMinutes: number): number {
  return sweph.julday(t.year, t.month, t.day, t.hour + t.minute / 60 - offsetMinutes / 60, C.SE_GREG_CAL);
}

/** the positions at a moment; houses when a place is given */
export function positionsAt(jd: number, place: { latitude: number; longitude: number } | null): AstroPositions {
  ensurePath();
  const bodies: AstroPositions['bodies'] = {};
  for (const [code, id] of BODIES) {
    const r = sweph.calc_ut(jd, id, FLAGS);
    if (r.flag < 0) throw new EphemerisError(`Không tính được vị trí ${code}: ${r.error}`);
    // without its file the ephemeris falls back to the analytic one (and cannot give Chiron at all)
    if (!(r.flag & C.SEFLG_SWIEPH)) throw new EphemerisError(`Thiếu file lịch thiên văn cho ${code}${r.error ? `: ${r.error}` : ''}`);
    bodies[code] = { lon: r.data[0], speed: r.data[3] };
  }
  let houses: AstroPositions['houses'] = null;
  if (place) {
    const h = sweph.houses(jd, place.latitude, place.longitude, 'P');
    if (h.flag < 0) throw new EphemerisError('Không dựng được các cung địa bàn Placidus ở vĩ độ này');
    houses = { cusps: [...h.data.houses], asc: h.data.points[0], mc: h.data.points[1], vertex: h.data.points[3] };
  }
  return { bodies, houses };
}

/** the UTC offset (minutes) a time zone had at a local moment, by the time zone database ("Asia/Ho_Chi_Minh" was +8 in the South until 1975) */
export function offsetIn(timeZone: string, t: LocalMoment): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset', year: 'numeric' });
  const at = (utcMs: number) => {
    const name = fmt.formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/.exec(name);
    return m && m[1] ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  };
  const local = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute);
  let off = at(local);
  off = at(local - off * 60000);
  return off;
}

export interface AstroBirth {
  year: number; month: number; day: number;
  /** "HH:MM" local time, null when not known */
  time: string | null;
  utcOffsetMinutes: number | null; timeZone: string | null;
  place: string | null; latitude: number | null; longitude: number | null;
}

/** what the engine needs for a birth, and what the reader should know about how it was set up */
export function astroInputOf(b: AstroBirth, gender: 'male' | 'female' | null): { input: AstroInput; offsetMinutes: number; notes: string[] } {
  const notes: string[] = [];
  const [hh, mm] = b.time ? b.time.split(':').map(Number) : [12, 0];
  const local: LocalMoment = { year: b.year, month: b.month, day: b.day, hour: hh, minute: mm };
  let offset = b.utcOffsetMinutes;
  if (offset === null && b.timeZone) offset = offsetIn(b.timeZone, local);
  if (offset === null) { offset = 420; notes.push('Chưa có múi giờ nơi sinh: tính theo UTC+7.'); }
  const place = b.latitude !== null && b.longitude !== null ? { latitude: b.latitude, longitude: b.longitude } : null;
  const timeKnown = !!b.time && !!place;
  if (b.time && !place) notes.push('Chưa có tọa độ nơi sinh: không dựng được cung Mọc và các cung địa bàn.');
  const jd = julianDay(local, offset);
  const positions = positionsAt(jd, timeKnown ? place : null);
  const input: AstroInput = {
    local: { year: b.year, month: b.month, day: b.day, hour: b.time ? hh : null, minute: b.time ? mm : null },
    jd, utcOffsetMinutes: offset, place: place ? { name: b.place, ...place } : null, timeKnown, gender, positions,
  };
  if (!b.time) {
    const moon = (h: number, m: number) => positionsAt(julianDay({ ...local, hour: h, minute: m }, offset!), null).bodies.moon!.lon;
    input.moonRange = [moon(0, 0), moon(23, 59)];
  }
  return { input, offsetMinutes: offset, notes };
}

/** the same birth some minutes earlier or later (the ends of a birth-time window): the sky recomputed, the rest kept */
export function shiftedInput(input: AstroInput, minutes: number): AstroInput {
  const jd = input.jd + minutes / 1440;
  return { ...input, jd, positions: positionsAt(jd, input.timeKnown && input.place ? input.place : null) };
}

/** what a chart turns on at a minute: the sign of AC and of Mặt Trăng, and the house of each planet */
function signature(jd: number, place: { latitude: number; longitude: number }): string {
  const p = positionsAt(jd, place);
  const h = p.houses!;
  const houseOf = (lon: number) => { for (let i = 0; i < 12; i++) { const a = h.cusps[i], z = h.cusps[(i + 1) % 12]; if (((lon - a + 720) % 360) < ((z - a + 720) % 360)) return i + 1; } return 12; };
  const planets = BODIES.slice(0, 10).map(([k]) => houseOf(p.bodies[k]!.lon));
  return `${Math.floor(h.asc / 30)}|${Math.floor(p.bodies.moon!.lon / 30)}|${planets.join(',')}`;
}

/**
 * The span of birth times around the one given in which the chart reads the same: the same cung Mọc, the same sign
 * for Mặt Trăng, every planet in the same house — for a time known only roughly. Searched minute by minute up to
 * `limit` minutes each way.
 */
export function stableWindow(b: AstroBirth, offsetMinutes: number, limit = 240): { from: string; to: string; before: number; after: number; capped: boolean } | null {
  if (!b.time || b.latitude === null || b.longitude === null) return null;
  const place = { latitude: b.latitude, longitude: b.longitude };
  const [hh, mm] = b.time.split(':').map(Number);
  const base: LocalMoment = { year: b.year, month: b.month, day: b.day, hour: hh, minute: mm };
  const jd0 = julianDay(base, offsetMinutes);
  const sig = signature(jd0, place);
  const reach = (dir: 1 | -1) => { let k = 0; while (k < limit && signature(jd0 + (dir * (k + 1)) / 1440, place) === sig) k++; return k; };
  const before = reach(-1), after = reach(1);
  const clock = (delta: number) => { const t = ((hh * 60 + mm + delta) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  return { from: clock(-before), to: clock(after), before, after, capped: before === limit || after === limit };
}
