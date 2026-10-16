/* cô Hương Kiều's "Đi tìm nhân tố trội": a test for each planet (and Chiron) that adds up points for its aspects to
   the lights and the angles, for the signs and houses it shares its nature with, and for the structures it is part
   of. Every point given names the line of her test it comes from and what in the chart earned it.
   Her orbs for the test: 8° for đồng vị and xung, 6° for vuông góc and tam hợp, 3° for the weak aspects; đồng vị and
   xung with AC and MC up to 10°. Reading her lines:
   - "X ở A hay cung N, +5 điểm" gives the 5 once (any of them); "mỗi nhân tố" / "mỗi cái" gives it for each;
   - "hành tinh khác" are the ten planets other than the one tested and those the same kind of line names (Mặt Trời,
     Mặt Trăng); in the test of Mặt Trời, Mặt Trăng in cung 5 counts as another planet there, as no line names it, and
     in the test of Chiron the lights count in "vùng của Chiron", which no other line scores (as the class's
     homework "Nộp bài tính nhân tố trội" does: "Sun Sagittarius: 2");
   - the weak aspects are every aspect but those four (her list "lục hợp, bán lục hợp, Q, bQ, 45, 135,…");
   - in the test of Mặt Trăng, "góc chiếu yếu … với mặt trăng" is read as with Mặt Trời (the Moon cannot aspect itself);
   - "quạt xếp, chữ T lớn, tam giác lớn…" are the structures: quạt xếp (three or more planets in a sign), chữ T, tam
     giác lớn, con diều, đại thập tự, ngón tay định mệnh, đại lục hợp and the two rectangles;
   - the lines asking you to add 2–5 points by your own feeling are left to you, as she says: what in the chart they
     name (an aspect to La Hầu or Kế Đô, Fortuna in the sign or the house) is listed, not counted. */
import type { AstroChart } from './chart.js';
import { ASPECT, BODY, PLANETS, SIGN, separation, lowerFirst, type AspectCode, type BodyCode, type PlanetCode, type SignCode } from './zodiac.js';

export type DominantBody = PlanetCode | 'chiron';
export type DominantLevel = 'low' | 'medium' | 'strong' | 'very-strong';
export const LEVEL_NAME: Record<DominantLevel, string> = { low: 'thấp', medium: 'trung bình', strong: 'mạnh', 'very-strong': 'cháy máy đo' };
export interface DominantItem {
  /** the line of her test (1 = its first line to score) */
  line: number;
  points: number;
  why: string;
}
/** what a line "cộng 2 đến 5 điểm … nếu tự bạn cảm thấy" names and the chart has: for the reader to weigh */
export interface DominantChoice { line: number; why: string }
export interface DominantTest {
  body: DominantBody; total: number; level: DominantLevel; items: DominantItem[];
  /** the factors her "add 2–5 points by your own feeling" line names, found in the chart (not in the total) */
  choices: DominantChoice[];
  /** Venus, "PHIÊN BẢN 2": with Kim Ngưu and cung 2 counted too */
  withTaurus?: { total: number; level: DominantLevel; items: DominantItem[]; choices: DominantChoice[] };
  /** some lines could not be scored (no birth time: no AC, MC, houses) */
  partial: boolean;
}
export interface DominantResult { tests: DominantTest[]; complete: boolean }

const STRONG: AspectCode[] = ['conjunction', 'square', 'trine', 'opposition'];
/** her orb for an aspect in the test */
const orbOf = (k: AspectCode, angle: boolean) => (k === 'conjunction' || k === 'opposition' ? (angle ? 10 : 8) : k === 'square' || k === 'trine' ? 6 : 3);
const ANGLE_NAME: Partial<Record<BodyCode, string>> = { asc: 'AC', mc: 'MC' };
const nameOf = (b: BodyCode) => ANGLE_NAME[b] ?? BODY[b].name;
const deg = (x: number) => `${Math.floor(x)}°${String(Math.floor((x % 1) * 60)).padStart(2, '0')}'`;

interface TestSpec {
  body: DominantBody;
  /** the signs it shares its nature with and its house */
  signs: SignCode[]; house: number;
  /** the line numbers of her test, by kind */
  lines: {
    lights: number; eclipse?: number; strong: number; weak: number; inSign: number; nodes?: number; otherInSign: number;
    lightsInHouse: number; icCancer?: number; otherInHouse: number; pattern?: number; ownPlace: number;
    /** "cộng 2 đến 5 điểm … nếu tự bạn cảm thấy": its line, and whether it names Fortuna in the house too */
    feel?: number; feelHouse?: boolean;
  };
  /** what her line "X ở …" gives 5 points for (once, unless `each`) */
  own: { signs?: SignCode[]; house?: boolean; cuspSign?: boolean; notOnMc?: boolean; each?: boolean };
  /** Mặt Trời and Mặt Trăng tests: 15 / 10 for the lights and angles, 6 / 4 for the rest; others 10 / 5 / 2 */
  luminary: boolean;
  /** Thổ tinh: the lights and planets within 10° of MC count as in cung 10 (even in cung 9) */
  nearMc?: boolean;
  /** Chiron: the other planets are scored in "vùng của Chiron" (Thiên Bình, Bò Cạp, Nhân Mã) and in cung 6 or Xử Nữ */
  region?: SignCode[];
}

const SPECS: TestSpec[] = [
  { body: 'sun', signs: ['leo'], house: 5, luminary: true, own: {},
    lines: { lights: 1, eclipse: 2, strong: 3, weak: 4, inSign: 5, otherInSign: 6, ownPlace: 7, lightsInHouse: 7, otherInHouse: 8, pattern: 10, feel: 9 } },
  { body: 'moon', signs: ['cancer'], house: 4, luminary: true, own: {},
    lines: { lights: 1, eclipse: 2, strong: 3, weak: 4, inSign: 5, nodes: 6, otherInSign: 7, lightsInHouse: 8, icCancer: 9, otherInHouse: 10, pattern: 12, ownPlace: 8, feel: 11 } },
  { body: 'mercury', signs: ['gemini', 'virgo'], house: 3, luminary: false, own: { signs: ['gemini', 'virgo'], house: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10 } },
  { body: 'venus', signs: ['libra'], house: 7, luminary: false, own: { signs: ['libra'], house: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10 } },
  { body: 'mars', signs: ['aries'], house: 1, luminary: false, own: { signs: ['aries', 'leo', 'sagittarius'], house: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'jupiter', signs: ['sagittarius'], house: 9, luminary: false, own: { signs: ['aries', 'leo', 'sagittarius'] },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'saturn', signs: ['capricorn'], house: 10, luminary: false, own: { signs: ['capricorn'], house: true, notOnMc: true }, nearMc: true,
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'uranus', signs: ['aquarius'], house: 11, luminary: false, own: { signs: ['aquarius'], house: true, cuspSign: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'neptune', signs: ['pisces'], house: 12, luminary: false, own: { signs: ['pisces'], cuspSign: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'pluto', signs: ['scorpio'], house: 8, luminary: false, own: { signs: ['scorpio'], house: true, cuspSign: true },
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8, pattern: 9, feel: 10, feelHouse: true } },
  { body: 'chiron', signs: ['virgo'], house: 6, luminary: false, own: { signs: ['virgo'], house: true, cuspSign: true, each: true }, region: ['libra', 'scorpio', 'sagittarius'],
    lines: { lights: 1, strong: 2, weak: 3, inSign: 4, ownPlace: 5, otherInSign: 6, lightsInHouse: 7, otherInHouse: 8 } },
];
const STRUCTURES = new Set(['stellium', 't-square', 'grand-trine', 'kite', 'grand-cross', 'yod', 'grand-sextile', 'mystic-rectangle', 'hard-rectangle']);

function levelOf(body: DominantBody, n: number): DominantLevel {
  const low = body === 'chiron' ? 14 : 15;
  return n <= low ? 'low' : n <= 25 ? 'medium' : n <= 40 ? 'strong' : 'very-strong';
}

export function dominantOf(c: AstroChart): DominantResult {
  const pl = c.placements, time = c.timeKnown;
  const lon = (b: BodyCode) => pl[b]?.lon;
  /** the aspect between two bodies with the test's orbs */
  const asp = (a: BodyCode, b: BodyCode): { k: AspectCode; off: number } | null => {
    const la = lon(a), lb = lon(b);
    if (la === undefined || lb === undefined) return null;
    const sep = separation(la, lb), angle = a === 'asc' || a === 'mc' || b === 'asc' || b === 'mc';
    let best: { k: AspectCode; off: number } | null = null;
    for (const d of Object.values(ASPECT)) {
      const off = Math.abs(sep - d.angle);
      if (off <= orbOf(d.code, angle) && (!best || off < best.off)) best = { k: d.code, off };
    }
    return best;
  };
  const aspText = (a: BodyCode, b: BodyCode, r: { k: AspectCode; off: number }) => `${nameOf(a)} ${lowerFirst(ASPECT[r.k].name)} ${nameOf(b)} (lệch ${deg(r.off)})`;
  const inSign = (b: BodyCode, s: SignCode[]) => pl[b] !== undefined && s.includes(pl[b]!.sign);
  const inHouse = (b: BodyCode, n: number) => pl[b]?.house === n;
  const ruler = time ? SIGN[pl.asc!.sign].rulers[0] : null;
  const patterns = c.patterns.filter(p => STRUCTURES.has(p.kind));

  const run = (s: TestSpec, signs: SignCode[], house: number, part: 'all' | 'taurus'): { items: DominantItem[]; choices: DominantChoice[]; partial: boolean } => {
    const X = s.body, L = s.lines, items: DominantItem[] = [];
    let partial = false;
    const give = (line: number, points: number, why: string) => items.push({ line, points, why });
    const lights = (X === 'sun' ? ['moon'] : X === 'moon' ? ['sun'] : ['sun', 'moon']) as BodyCode[];
    const others = PLANETS.filter(p => p !== X && p !== 'sun' && p !== 'moon');
    const signNames = signs.map(x => SIGN[x].name).join(' hay ');
    if (part === 'all') {
      // aspects to the lights and the angles, then to the other planets, then the weak ones
      for (const b of [...lights, 'asc', 'mc'] as BodyCode[]) {
        if ((b === 'asc' || b === 'mc') && !time) { partial = true; continue; }
        const r = asp(X, b);
        if (!r || !STRONG.includes(r.k)) continue;
        give(L.lights, s.luminary ? (r.k === 'conjunction' ? 15 : 10) : 10, aspText(X, b, r));
      }
      if (L.eclipse) {
        const sm = asp('sun', 'moon'), node = (['north-node', 'south-node'] as BodyCode[]).map(n => ({ n, r: asp('sun', n) })).find(x => x.r?.k === 'conjunction');
        if (sm && node && (sm.k === 'conjunction' || sm.k === 'opposition'))
          give(L.eclipse, 10, `${sm.k === 'conjunction' ? 'Sinh vào thời điểm nhật thực' : 'Sinh vào ngày nguyệt thực'}: Mặt Trời ${sm.k === 'conjunction' ? 'đồng vị' : 'xung'} Mặt Trăng và đồng vị ${BODY[node.n].name}`);
      }
      for (const b of others) {
        const r = asp(X, b);
        if (r && STRONG.includes(r.k)) give(L.strong, s.luminary ? 6 : 5, aspText(X, b, r));
      }
      for (const b of [...lights, 'asc', 'mc', ...others] as BodyCode[]) {
        if ((b === 'asc' || b === 'mc') && !time) continue;
        const r = asp(X, b);
        if (r && !STRONG.includes(r.k)) give(L.weak, s.luminary ? 4 : 2, aspText(X, b, r));
      }
    }
    // the signs of its nature
    if (s.luminary) {
      if (inSign(X, signs)) give(L.inSign, 15, `${nameOf(X)} ở ${signNames}`);
      for (const b of [...lights, 'asc', 'mc'] as BodyCode[]) {
        if ((b === 'asc' || b === 'mc') && !time) { partial = true; continue; }
        if (inSign(b, signs)) give(L.inSign, 10, `${nameOf(b)} ở ${signNames}`);
      }
    } else {
      const lightsAndMc = (s.body === 'chiron' ? ['sun', 'moon', 'asc', 'mc'] : ['sun', 'moon', 'mc']) as BodyCode[];
      const line = part === 'taurus' ? 11 : L.inSign;
      for (const b of lightsAndMc) {
        if ((b === 'asc' || b === 'mc') && !time) { partial = true; continue; }
        if (inSign(b, signs)) give(line, 5, `${nameOf(b)} ở ${signNames}`);
      }
      if (s.body !== 'chiron') {
        if (!time) partial = true;
        else {
          const why = [inSign('asc', signs) ? `AC ở ${signNames}` : null, ruler && inSign(ruler, signs) ? `chủ tinh lá số (${BODY[ruler].name}) ở ${signNames}` : null].filter(Boolean);
          if (why.length) give(line, 10, why.join('; '));
        }
      }
    }
    if (L.nodes && part === 'all') {
      const hit = (['north-node', 'south-node'] as BodyCode[]).filter(n => inSign(n, ['cancer']) || (time && inHouse(n, 4)));
      if (hit.length) give(L.nodes, 5, hit.map(n => `${BODY[n].name} ở ${inSign(n, ['cancer']) ? 'Cự Giải' : 'cung 4'}`).join('; '));
    }
    // its own place ("X ở … +5 điểm")
    if (!s.luminary) {
      const o = s.own, line = part === 'taurus' ? 12 : L.ownPlace;
      const oSigns = part === 'taurus' ? ['taurus' as SignCode] : (o.signs ?? []);
      const reasons: string[] = [];
      if (oSigns.length && inSign(X, oSigns)) reasons.push(`${nameOf(X)} ở ${SIGN[pl[X]!.sign].name}`);
      if (o.house || part === 'taurus') { if (!time) partial = true; else if (inHouse(X, house)) reasons.push(`${nameOf(X)} ở cung ${house}`); }
      if (o.cuspSign && part === 'all') { if (!time) partial = true; else if (c.houses![house - 1].sign === signs[0]) reasons.push(`${SIGN[signs[0]].name} ở nóc cung ${house}`); }
      const onMc = o.notOnMc && time && asp(X, 'mc')?.k === 'conjunction';
      if (reasons.length && !onMc) {
        if (o.each) for (const r of reasons) give(line, 5, r);
        else give(line, 5, reasons.join('; '));
      }
    }
    // the other planets in those signs (Chiron: in its region)
    const lineOS = part === 'taurus' ? 13 : L.otherInSign;
    const regionSigns = s.region ?? signs;
    for (const b of s.region ? PLANETS : others) if (inSign(b, regionSigns)) give(lineOS, s.luminary ? 5 : s.region ? 2 : 3, `${nameOf(b)} ở ${SIGN[pl[b]!.sign].name}`);
    // the house
    if (!time) partial = true;
    else {
      const lineLH = part === 'taurus' ? 14 : L.lightsInHouse, lineOH = part === 'taurus' ? 15 : L.otherInHouse;
      const near = (b: BodyCode) => s.nearMc && separation(lon(b)!, lon('mc')!) <= 10;
      const lightsHere = ['sun', 'moon'] as BodyCode[];
      if (s.luminary && X === 'sun') {
        if (inHouse('sun', house)) give(L.lightsInHouse, 10, `Mặt Trời ở cung ${house}`);
        for (const b of ['moon', ...others] as BodyCode[]) if (inHouse(b, house)) give(L.otherInHouse, 3, `${nameOf(b)} ở cung ${house}`);
      } else if (s.luminary && X === 'moon') {
        for (const b of lightsHere) if (inHouse(b, house)) give(L.lightsInHouse, 10, `${nameOf(b)} ở cung ${house}`);
        if (c.houses![3].sign === 'cancer') give(L.icCancer!, 5, 'IC ở Cự Giải');
        for (const b of PLANETS) if (inSign(b, ['cancer']) && inHouse(b, 4)) give(L.icCancer!, 5, `${nameOf(b)} ở Cự Giải, trong cung 4`);
        for (const b of others) if (inHouse(b, house)) give(L.otherInHouse, 5, `${nameOf(b)} ở cung ${house}`);
      } else {
        for (const b of lightsHere) {
          if (inHouse(b, house)) give(lineLH, 5, `${nameOf(b)} ở cung ${house}`);
          else if (near(b)) give(lineLH, 5, `${nameOf(b)} cách MC ${deg(separation(lon(b)!, lon('mc')!))}`);
        }
        for (const b of others) {
          if (inHouse(b, house) || (s.region && inSign(b, signs))) give(lineOH, 3, inHouse(b, house) ? `${nameOf(b)} ở cung ${house}` : `${nameOf(b)} ở ${SIGN[signs[0]].name}`);
          else if (near(b)) give(lineOH, 3, `${nameOf(b)} cách MC ${deg(separation(lon(b)!, lon('mc')!))}`);
        }
      }
    }
    // a structure
    if (L.pattern && part === 'all' && s.body !== 'chiron') {
      const hit = patterns.find(p => p.bodies.includes(X as PlanetCode));
      if (hit) give(L.pattern, 5, `${nameOf(X)} thuộc ${patternName(hit.kind)}`);
    }
    // "cộng 2 đến 5 điểm … nếu tự bạn cảm thấy": what the line names, for the reader to weigh
    const choices: DominantChoice[] = [];
    const feel = part === 'taurus' ? 16 : L.feel;
    if (feel) {
      if (part === 'all') {
        const toNodes = (['north-node', 'south-node'] as BodyCode[]).map(n => ({ n, r: asp(X, n) })).filter(x => x.r);
        if (toNodes.length) choices.push({ line: feel, why: `${nameOf(X)} ${toNodes.map(x => `${lowerFirst(ASPECT[x.r!.k].name)} ${BODY[x.n].name}`).join(', ')}` });
        if (X === 'sun') for (const n of ['north-node', 'south-node'] as BodyCode[]) if (inSign(n, signs)) choices.push({ line: feel, why: `${BODY[n].name} ở ${signNames}` });
      }
      if (!time) partial = true;
      else if (pl.fortune) {
        const at = [signs.includes(pl.fortune.sign) ? SIGN[pl.fortune.sign].name : null, L.feelHouse && part === 'all' && pl.fortune.house === house ? `cung ${house}` : null].filter(Boolean);
        if (at.length) choices.push({ line: feel, why: `Fortuna ở ${at.join(', ')}` });
      }
    }
    return { items, choices, partial };
  };

  const tests: DominantTest[] = [];
  for (const s of SPECS) {
    if (!pl[s.body]) continue;
    const r = run(s, s.signs, s.house, 'all');
    const total = r.items.reduce((n, x) => n + x.points, 0);
    const t: DominantTest = { body: s.body, total, level: levelOf(s.body, total), items: r.items, choices: r.choices, partial: r.partial };
    if (s.body === 'venus') {
      const v2 = run(s, ['taurus'], 2, 'taurus');
      const items = [...r.items, ...v2.items], n = items.reduce((m, x) => m + x.points, 0);
      t.withTaurus = { total: n, level: levelOf('venus', n), items, choices: [...r.choices, ...v2.choices] };
    }
    tests.push(t);
  }
  return { tests, complete: time };
}

const PATTERN_LABEL: Record<string, string> = {
  stellium: 'quạt xếp (stellium)', 't-square': 'chữ T', 'grand-trine': 'tam giác lớn', kite: 'con diều', 'grand-cross': 'đại thập tự',
  yod: 'ngón tay định mệnh (Yod)', 'grand-sextile': 'đại lục hợp', 'mystic-rectangle': 'hình chữ nhật thần bí', 'hard-rectangle': 'hình chữ nhật khó khăn',
};
const patternName = (k: string) => PATTERN_LABEL[k] ?? k;
