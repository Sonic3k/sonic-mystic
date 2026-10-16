/* A birth chart from the positions the ephemeris gives (the API computes them with the Swiss Ephemeris: tropical
   zodiac, Placidus houses, true node, mean Lilith): where each planet and point stands — sign, degree, house, dignity —
   the house cusps, the aspects with cô Hương Kiều's orbs, the structures she and Bil Tierney read (tam giác lớn, con
   diều, chữ T, đại thập tự, ngón tay định mệnh, đại lục hợp, hình chữ nhật thần bí / khó khăn, đại tam hợp phụ, quạt
   xếp), the balance of elements and modes, the rulers, and her test of the dominant planets. Pure computation. */
import {
  ASPECTS, BODY, PLANETS, SIGN, SIGNS, degreeInSign, dignitiesOf, isPlanet, lonText, norm, separation, signOf,
  type AspectCode, type BodyCode, type Dignity, type Element, type Modality, type PlanetCode, type SignCode,
} from './zodiac.js';
import { dominantOf, type DominantResult } from './dominant.js';

export interface BodyPosition { lon: number; speed?: number | null }
export type EphemerisBody = PlanetCode | 'chiron' | 'north-node' | 'lilith';
export interface AstroPositions {
  bodies: Partial<Record<EphemerisBody, BodyPosition>>;
  /** Placidus cusps of houses 1–12, the Ascendant, the Midheaven and the Vertex; null when the birth time is not known */
  houses: { cusps: number[]; asc: number; mc: number; vertex: number } | null;
}
export interface AstroInput {
  /** the date and time of birth as written, in local time (no time: hour and minute null) */
  local: { year: number; month: number; day: number; hour: number | null; minute: number | null };
  /** Julian day (UT) the positions are for */
  jd: number;
  utcOffsetMinutes: number | null;
  place: { name: string | null; latitude: number; longitude: number } | null;
  timeKnown: boolean;
  /** some passages speak of a woman or of a man (Woolfolk, ch. 2) */
  gender?: 'male' | 'female' | null;
  positions: AstroPositions;
  /** when the time is not known: the Moon at the first and at the last minute of that day */
  moonRange?: [number, number] | null;
}

export interface Placement {
  body: BodyCode; lon: number; sign: SignCode; deg: number; text: string;
  house: number | null; speed: number | null; retro: boolean;
  /** Vượng, Tử, Tướng, Tù (her table; the ten planets only) */
  dignities: Dignity[];
  /** which ten degrees of its sign (Woolfolk's decanates) */
  decan: 1 | 2 | 3;
}
export interface HouseCusp { n: number; lon: number; sign: SignCode; text: string; rulers: PlanetCode[]; bodies: BodyCode[] }
export interface Aspect {
  a: BodyCode; b: BodyCode; aspect: AspectCode;
  /** how far from exact, in degrees */
  orb: number;
  /** the two ends do not stand the aspect's own number of signs apart ("góc chiếu phân tách", Tierney ch. 3) */
  outOfSign: boolean;
  /** the aspect is getting closer (null when a speed is not known) */
  applying: boolean | null;
}
export type PatternKind = 'grand-trine' | 'minor-grand-trine' | 'kite' | 'grand-sextile' | 't-square' | 'grand-cross'
  | 'mystic-rectangle' | 'hard-rectangle' | 'yod' | 'stellium';
export interface Pattern {
  kind: PatternKind; bodies: PlanetCode[];
  /** the planet the structure points to: chữ T's and the Yod's đỉnh, the midpoint planet of a minor grand trine */
  apex: PlanetCode | null;
  /** the element (grand trine, minor grand trine) or the pair of elements (grand sextile) all its planets share */
  element: Element | 'fire-air' | 'earth-water' | null;
  modality: Modality | null;
  /** its planets do not keep to the signs of the structure ("phân tách") */
  outOfSign: boolean;
  /** a stellium's sign */
  sign?: SignCode;
  /** every planet of it sits in a cung góc (1, 4, 7, 10) */
  angular: boolean;
}
export interface Balance {
  elements: Record<Element, PlanetCode[]>;
  modalities: Record<Modality, PlanetCode[]>;
  /** by house (needs the time): above / below the horizon, east / west of the meridian */
  hemispheres: { above: PlanetCode[]; below: PlanetCode[]; east: PlanetCode[]; west: PlanetCode[] } | null;
}
export interface AstroChart {
  input: AstroInput;
  timeKnown: boolean;
  placements: Partial<Record<BodyCode, Placement>>;
  /** the bodies in the order a chart lists them */
  order: BodyCode[];
  houses: HouseCusp[] | null;
  aspects: Aspect[];
  patterns: Pattern[];
  balance: Balance;
  rulers: { chart: PlanetCode[] | null; sun: PlanetCode[]; moon: PlanetCode[] };
  dominant: DominantResult;
  /** what the reader should know about this chart (no time, a Moon that may change sign that day…) */
  notes: string[];
}

/** cô Hương Kiều's Tử Khí: 310.58° on 1/6/2009, moving 0.0352° a day (her spreadsheet "Tính tử khí") */
export const ZIQI_EPOCH_JD = 2454983.5;
export const ziqiAt = (jd: number) => norm(310.58 + 0.0352 * (jd - ZIQI_EPOCH_JD));

const ORDER: BodyCode[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  'north-node', 'south-node', 'lilith', 'ziqi', 'chiron', 'fortune', 'vertex', 'antivertex', 'asc', 'mc', 'dsc', 'ic'];
/** the bodies whose aspects a chart shows: the ten planets, Chiron, La Hầu, Nguyệt Bột, AC and MC */
export const ASPECT_BODIES: BodyCode[] = [...PLANETS, 'chiron', 'north-node', 'lilith', 'asc', 'mc'];

/** the house a longitude falls in, from the cusps */
export function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    if (norm(lon - a) < norm(b - a)) return i + 1;
  }
  return 12;
}
const signGap = (a: number, b: number) => { const d = Math.abs(Math.floor(norm(a) / 30) - Math.floor(norm(b) / 30)) % 12; return Math.min(d, 12 - d); };

/** the aspect two longitudes make, if any, with her orbs (the wider one when Mặt Trời or Mặt Trăng is in it) */
export function aspectBetween(a: BodyCode, la: number, b: BodyCode, lb: number): { aspect: AspectCode; orb: number } | null {
  const sep = separation(la, lb);
  const lum = a === 'sun' || a === 'moon' || b === 'sun' || b === 'moon';
  let best: { aspect: AspectCode; orb: number } | null = null;
  for (const d of ASPECTS) {
    const off = Math.abs(sep - d.angle);
    if (off <= d.orb[lum ? 1 : 0] && (!best || off < best.orb)) best = { aspect: d.code, orb: off };
  }
  return best;
}

export function buildAstroChart(input: AstroInput): AstroChart {
  const P = input.positions, H = input.timeKnown ? P.houses : null;
  const lons: Partial<Record<BodyCode, { lon: number; speed: number | null }>> = {};
  for (const [k, v] of Object.entries(P.bodies) as [EphemerisBody, BodyPosition][]) if (v) lons[k] = { lon: norm(v.lon), speed: v.speed ?? null };
  if (lons['north-node']) lons['south-node'] = { lon: norm(lons['north-node'].lon + 180), speed: lons['north-node'].speed };
  lons.ziqi = { lon: ziqiAt(input.jd), speed: 0.0352 };
  if (H) {
    lons.asc = { lon: norm(H.asc), speed: null }; lons.mc = { lon: norm(H.mc), speed: null };
    lons.dsc = { lon: norm(H.asc + 180), speed: null }; lons.ic = { lon: norm(H.mc + 180), speed: null };
    lons.vertex = { lon: norm(H.vertex), speed: null }; lons.antivertex = { lon: norm(H.vertex + 180), speed: null };
    // Fortuna = AC + Mặt Trăng − Mặt Trời, by day and by night alike
    if (lons.sun && lons.moon) lons.fortune = { lon: norm(H.asc + lons.moon.lon - lons.sun.lon), speed: null };
  }

  const placements: Partial<Record<BodyCode, Placement>> = {};
  for (const code of ORDER) {
    const v = lons[code];
    if (!v) continue;
    const sign = signOf(v.lon), deg = degreeInSign(v.lon);
    placements[code] = {
      body: code, lon: v.lon, sign, deg, text: lonText(v.lon),
      house: H ? houseOf(v.lon, H.cusps) : null, speed: v.speed,
      retro: v.speed !== null && v.speed < 0 && code !== 'ziqi',
      dignities: isPlanet(code) ? dignitiesOf(code, sign) : [],
      decan: (Math.min(2, Math.floor(deg / 10)) + 1) as 1 | 2 | 3,
    };
  }
  // the angles sit on their own cusps
  if (H) for (const [c, n] of [['asc', 1], ['ic', 4], ['dsc', 7], ['mc', 10]] as const) placements[c]!.house = n;
  const order = ORDER.filter(c => placements[c]);

  const houses: HouseCusp[] | null = H ? H.cusps.map((lon, i) => ({
    n: i + 1, lon: norm(lon), sign: signOf(lon), text: lonText(lon), rulers: SIGN[signOf(lon)].rulers,
    bodies: order.filter(c => BODY[c].kind !== 'angle' && placements[c]!.house === i + 1),
  })) : null;

  // aspects: each pair once, the closest aspect within orb
  const aspects: Aspect[] = [];
  const present = ASPECT_BODIES.filter(c => placements[c]);
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
    const a = present[i], b = present[j];
    if ((a === 'asc' && b === 'mc') || (a === 'mc' && b === 'asc')) continue;
    const pa = placements[a]!, pb = placements[b]!;
    const hit = aspectBetween(a, pa.lon, b, pb.lon);
    if (!hit) continue;
    const def = ASPECTS.find(d => d.code === hit.aspect)!;
    let applying: boolean | null = null;
    if (pa.speed !== null && pb.speed !== null) {
      const dt = 1 / 24;
      const later = Math.abs(separation(pa.lon + pa.speed * dt, pb.lon + pb.speed * dt) - def.angle);
      applying = later < hit.orb;
    }
    aspects.push({ a, b, aspect: hit.aspect, orb: hit.orb, outOfSign: def.signs !== null && signGap(pa.lon, pb.lon) !== def.signs, applying });
  }

  const patterns = findPatterns(placements, aspects);
  const planets = PLANETS.filter(p => placements[p]);
  const elements = { fire: [], earth: [], air: [], water: [] } as Record<Element, PlanetCode[]>;
  const modalities = { cardinal: [], fixed: [], mutable: [] } as Record<Modality, PlanetCode[]>;
  for (const p of planets) { const s = SIGN[placements[p]!.sign]; elements[s.element].push(p); modalities[s.modality].push(p); }
  const hemispheres = H ? {
    above: planets.filter(p => placements[p]!.house! >= 7), below: planets.filter(p => placements[p]!.house! <= 6),
    east: planets.filter(p => placements[p]!.house! <= 3 || placements[p]!.house! >= 10), west: planets.filter(p => placements[p]!.house! >= 4 && placements[p]!.house! <= 9),
  } : null;
  const rulers = {
    chart: H ? SIGN[placements.asc!.sign].rulers : null,
    sun: SIGN[placements.sun!.sign].rulers, moon: SIGN[placements.moon!.sign].rulers,
  };

  const notes: string[] = [];
  if (!input.timeKnown) {
    notes.push('Chưa có giờ sinh: lá số không có cung Mọc (AC), MC, các cung địa bàn, Vertex và Fortuna; vị trí các sao lấy lúc 12 giờ trưa.');
    const mr = input.moonRange;
    if (mr && signOf(mr[0]) !== signOf(mr[1])) notes.push(`Mặt Trăng đổi cung trong ngày sinh: từ ${SIGN[signOf(mr[0])].name} sang ${SIGN[signOf(mr[1])].name} — cần giờ sinh để biết Mặt Trăng ở cung nào.`);
  }
  const chart: AstroChart = {
    input, timeKnown: !!H, placements, order, houses, aspects, patterns,
    balance: { elements, modalities, hemispheres }, rulers, dominant: { tests: [], complete: false }, notes,
  };
  chart.dominant = dominantOf(chart);
  return chart;
}

// ── structures ──
const key = (a: BodyCode, b: BodyCode) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const PAIR_ORDER = (xs: PlanetCode[]) => [...xs].sort((a, b) => PLANETS.indexOf(a) - PLANETS.indexOf(b));

function findPatterns(pl: Partial<Record<BodyCode, Placement>>, aspects: Aspect[]): Pattern[] {
  const ps = PLANETS.filter(p => pl[p]);
  const asp = new Map<string, Aspect>();
  for (const a of aspects) if (isPlanet(a.a) && isPlanet(a.b)) asp.set(key(a.a, a.b), a);
  const is = (a: PlanetCode, b: PlanetCode, k: AspectCode) => asp.get(key(a, b))?.aspect === k;
  const elemOf = (p: PlanetCode) => SIGN[pl[p]!.sign].element, modOf = (p: PlanetCode) => SIGN[pl[p]!.sign].modality;
  const same = <T,>(xs: T[]) => xs.every(x => x === xs[0]);
  const angular = (xs: PlanetCode[]) => xs.every(p => { const h = pl[p]!.house; return h !== null && [1, 4, 7, 10].includes(h); });
  const out: Pattern[] = [];
  const add = (kind: PatternKind, bodies: PlanetCode[], apex: PlanetCode | null, extra: Partial<Pattern> = {}) => {
    out.push({ kind, bodies: PAIR_ORDER(bodies), apex, element: null, modality: null, outOfSign: false, angular: angular(bodies), ...extra });
  };
  const combos = (n: number): PlanetCode[][] => {
    const r: PlanetCode[][] = [];
    const go = (start: number, acc: PlanetCode[]) => { if (acc.length === n) { r.push(acc); return; } for (let i = start; i < ps.length; i++) go(i + 1, [...acc, ps[i]]); };
    go(0, []);
    return r;
  };

  // tam giác lớn: three planets each trine the others; con diều: one more, opposite one of them and sextile the other two
  const trines = combos(3).filter(([a, b, c]) => is(a, b, 'trine') && is(b, c, 'trine') && is(a, c, 'trine'));
  for (const t of trines) {
    const els = t.map(elemOf);
    add('grand-trine', t, null, same(els) ? { element: els[0] } : { outOfSign: true });
    for (const d of ps) {
      if (t.includes(d)) continue;
      for (const head of t) {
        const others = t.filter(x => x !== head);
        if (is(d, head, 'opposition') && others.every(o => is(d, o, 'sextile'))) add('kite', [...t, d], null, same(els) ? { element: els[0] } : { outOfSign: true });
      }
    }
  }
  // đại tam hợp phụ: a trine with a third planet sextile both ends (at its midpoint)
  for (const [a, b, c] of combos(3)) for (const [x, y, m] of [[a, b, c], [a, c, b], [b, c, a]] as PlanetCode[][]) {
    if (is(x, y, 'trine') && is(m, x, 'sextile') && is(m, y, 'sextile')) {
      const els = [x, y].map(elemOf);
      add('minor-grand-trine', [x, y, m], m, same(els) ? { element: els[0] } : { outOfSign: true });
    }
  }
  // đại lục hợp: two grand trines whose planets face each other across the chart
  for (let i = 0; i < trines.length; i++) for (let j = i + 1; j < trines.length; j++) {
    const A = trines[i], B = trines[j];
    if (A.some(x => B.includes(x))) continue;
    if (A.every(x => B.some(y => is(x, y, 'opposition')))) {
      const ea = A.map(elemOf), eb = B.map(elemOf);
      const pair = same(ea) && same(eb) ? ([ea[0], eb[0]].sort().join('-') === 'air-fire' ? 'fire-air' : [ea[0], eb[0]].sort().join('-') === 'earth-water' ? 'earth-water' : null) : null;
      add('grand-sextile', [...A, ...B], null, pair ? { element: pair } : { outOfSign: true });
    }
  }
  // đại thập tự: two oppositions, each planet square the two of the other pair
  const crosses: PlanetCode[][] = [];
  for (const q of combos(4)) {
    const [a, b, c, d] = q;
    for (const [w, x, y, z] of [[a, b, c, d], [a, c, b, d], [a, d, b, c]] as PlanetCode[][]) {
      if (is(w, x, 'opposition') && is(y, z, 'opposition') && is(w, y, 'square') && is(w, z, 'square') && is(x, y, 'square') && is(x, z, 'square')) {
        const ms = q.map(modOf);
        add('grand-cross', q, null, same(ms) ? { modality: ms[0] } : { outOfSign: true });
        crosses.push(q);
      }
    }
  }
  // chữ T: an opposition, both ends square a third planet (its đỉnh) — those inside a grand cross are read with it
  for (const [a, b, c] of combos(3)) for (const [x, y, apex] of [[a, b, c], [a, c, b], [b, c, a]] as PlanetCode[][]) {
    if (is(x, y, 'opposition') && is(apex, x, 'square') && is(apex, y, 'square')) {
      if (crosses.some(q => [x, y, apex].every(p => q.includes(p)))) continue;
      const ms = [x, y, apex].map(modOf);
      add('t-square', [x, y, apex], apex, same(ms) ? { modality: ms[0] } : { outOfSign: true });
    }
  }
  // hình chữ nhật thần bí (the oppositions' ends 60° and 120° apart) and khó khăn (45° and 135°)
  for (const q of combos(4)) {
    const [a, b, c, d] = q;
    for (const [w, x, y, z] of [[a, b, c, d], [a, c, b, d], [a, d, b, c]] as PlanetCode[][]) {
      if (!is(w, x, 'opposition') || !is(y, z, 'opposition')) continue;
      for (const [s, t] of [[y, z], [z, y]] as PlanetCode[][]) {
        // w–s and x–t one kind, w–t and x–s the other
        if (is(w, s, 'sextile') && is(x, t, 'sextile') && is(w, t, 'trine') && is(x, s, 'trine')) add('mystic-rectangle', q, null);
        if (is(w, s, 'semisquare') && is(x, t, 'semisquare') && is(w, t, 'sesquiquadrate') && is(x, s, 'sesquiquadrate')) add('hard-rectangle', q, null);
      }
    }
  }
  // ngón tay định mệnh (Yod): two planets sextile, both quincunx a third, its đỉnh
  for (const [a, b, c] of combos(3)) for (const [x, y, apex] of [[a, b, c], [a, c, b], [b, c, a]] as PlanetCode[][]) {
    if (is(x, y, 'sextile') && is(apex, x, 'quincunx') && is(apex, y, 'quincunx')) add('yod', [x, y, apex], apex);
  }
  // quạt xếp (stellium): three or more of the ten in one sign
  for (const s of SIGNS) {
    const inS = ps.filter(p => pl[p]!.sign === s.code);
    if (inS.length >= 3) add('stellium', inS, null, { sign: s.code });
  }
  // the same structure found from another corner only once
  const seen = new Set<string>();
  return out.filter(p => { const k = `${p.kind}:${p.bodies.join(',')}:${p.apex ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export const PATTERN_NAME: Record<PatternKind, string> = {
  'grand-trine': 'Tam giác lớn', 'minor-grand-trine': 'Đại tam hợp phụ', kite: 'Con diều', 'grand-sextile': 'Đại lục hợp',
  't-square': 'Chữ T', 'grand-cross': 'Đại thập tự', 'mystic-rectangle': 'Hình chữ nhật thần bí', 'hard-rectangle': 'Hình chữ nhật khó khăn',
  yod: 'Ngón tay định mệnh (Yod)', stellium: 'Quạt xếp (stellium)',
};
