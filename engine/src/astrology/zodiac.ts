/* The zodiac as cô Hương Kiều teaches it ("Chiêm tinh học cơ bản", Kiều Thị Thu Hương): the twelve signs with their
   element and mode, the planets and points of a chart, the aspects with her orbs (Thuật ngữ, 4.), and her table of
   Vượng – Tướng – Tù – Tử (p. 29). Every name here is hers; the codes are the engine's. */

export type SignCode = 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio' | 'sagittarius'
  | 'capricorn' | 'aquarius' | 'pisces';
export type Element = 'fire' | 'earth' | 'air' | 'water';
export type Modality = 'cardinal' | 'fixed' | 'mutable';
export type PlanetCode = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export type PointCode = 'chiron' | 'north-node' | 'south-node' | 'lilith' | 'ziqi' | 'fortune' | 'vertex' | 'antivertex';
export type AngleCode = 'asc' | 'mc' | 'dsc' | 'ic';
export type BodyCode = PlanetCode | PointCode | AngleCode;

export interface Sign {
  code: SignCode; index: number; name: string; en: string; glyph: string; element: Element; modality: Modality;
  /** chủ tinh (Tướng in her table): the modern ruler first, then the one it shares the sign with */
  rulers: PlanetCode[];
}
export const SIGNS: Sign[] = [
  { code: 'aries', index: 0, name: 'Bạch Dương', en: 'Aries', glyph: '♈', element: 'fire', modality: 'cardinal', rulers: ['mars'] },
  { code: 'taurus', index: 1, name: 'Kim Ngưu', en: 'Taurus', glyph: '♉', element: 'earth', modality: 'fixed', rulers: ['venus'] },
  { code: 'gemini', index: 2, name: 'Song Tử', en: 'Gemini', glyph: '♊', element: 'air', modality: 'mutable', rulers: ['mercury'] },
  { code: 'cancer', index: 3, name: 'Cự Giải', en: 'Cancer', glyph: '♋', element: 'water', modality: 'cardinal', rulers: ['moon'] },
  { code: 'leo', index: 4, name: 'Sư Tử', en: 'Leo', glyph: '♌', element: 'fire', modality: 'fixed', rulers: ['sun'] },
  { code: 'virgo', index: 5, name: 'Xử Nữ', en: 'Virgo', glyph: '♍', element: 'earth', modality: 'mutable', rulers: ['mercury'] },
  { code: 'libra', index: 6, name: 'Thiên Bình', en: 'Libra', glyph: '♎', element: 'air', modality: 'cardinal', rulers: ['venus'] },
  // her table: Diêm Vương and Sao Hỏa both rule Bò Cạp; Thiên Vương and Sao Thổ Bảo Bình; Hải Vương and Sao Mộc Song Ngư
  { code: 'scorpio', index: 7, name: 'Bò Cạp', en: 'Scorpio', glyph: '♏', element: 'water', modality: 'fixed', rulers: ['pluto', 'mars'] },
  { code: 'sagittarius', index: 8, name: 'Nhân Mã', en: 'Sagittarius', glyph: '♐', element: 'fire', modality: 'mutable', rulers: ['jupiter'] },
  { code: 'capricorn', index: 9, name: 'Ma Kết', en: 'Capricorn', glyph: '♑', element: 'earth', modality: 'cardinal', rulers: ['saturn'] },
  { code: 'aquarius', index: 10, name: 'Bảo Bình', en: 'Aquarius', glyph: '♒', element: 'air', modality: 'fixed', rulers: ['uranus', 'saturn'] },
  { code: 'pisces', index: 11, name: 'Song Ngư', en: 'Pisces', glyph: '♓', element: 'water', modality: 'mutable', rulers: ['neptune', 'jupiter'] },
];
export const SIGN = Object.fromEntries(SIGNS.map(s => [s.code, s])) as Record<SignCode, Sign>;

export const ELEMENTS: { code: Element; name: string }[] = [
  { code: 'fire', name: 'Lửa' }, { code: 'earth', name: 'Đất' }, { code: 'air', name: 'Khí' }, { code: 'water', name: 'Nước' },
];
/** Thể thức: "Cốt yếu, hay còn gọi là tiên phong, khởi phát", Kiên định, Linh hoạt */
export const MODALITIES: { code: Modality; name: string }[] = [
  { code: 'cardinal', name: 'Cốt yếu' }, { code: 'fixed', name: 'Kiên định' }, { code: 'mutable', name: 'Linh hoạt' },
];
export const ELEMENT_NAME = Object.fromEntries(ELEMENTS.map(e => [e.code, e.name])) as Record<Element, string>;
export const MODALITY_NAME = Object.fromEntries(MODALITIES.map(m => [m.code, m.name])) as Record<Modality, string>;

/** her groups (Thuật ngữ, 2.): hành tinh cá nhân, xã hội, thế hệ; then the points and the angles */
export type BodyKind = 'personal' | 'social' | 'generational' | 'point' | 'angle';
export interface Body { code: BodyCode; name: string; glyph: string; kind: BodyKind; en: string }
export const BODIES: Body[] = [
  { code: 'sun', name: 'Mặt Trời', glyph: '☉', kind: 'personal', en: 'Sun' },
  { code: 'moon', name: 'Mặt Trăng', glyph: '☽', kind: 'personal', en: 'Moon' },
  { code: 'mercury', name: 'Sao Thủy', glyph: '☿', kind: 'personal', en: 'Mercury' },
  { code: 'venus', name: 'Sao Kim', glyph: '♀', kind: 'personal', en: 'Venus' },
  { code: 'mars', name: 'Sao Hỏa', glyph: '♂', kind: 'personal', en: 'Mars' },
  { code: 'jupiter', name: 'Sao Mộc', glyph: '♃', kind: 'social', en: 'Jupiter' },
  { code: 'saturn', name: 'Sao Thổ', glyph: '♄', kind: 'social', en: 'Saturn' },
  { code: 'uranus', name: 'Thiên Vương', glyph: '♅', kind: 'generational', en: 'Uranus' },
  { code: 'neptune', name: 'Hải Vương', glyph: '♆', kind: 'generational', en: 'Neptune' },
  { code: 'pluto', name: 'Diêm Vương', glyph: '♇', kind: 'generational', en: 'Pluto' },
  { code: 'north-node', name: 'La Hầu', glyph: '☊', kind: 'point', en: 'North Node' },
  { code: 'south-node', name: 'Kế Đô', glyph: '☋', kind: 'point', en: 'South Node' },
  { code: 'lilith', name: 'Nguyệt Bột', glyph: '⚸', kind: 'point', en: 'Lilith' },
  { code: 'ziqi', name: 'Tử Khí', glyph: 'TK', kind: 'point', en: 'Ziqi' },
  { code: 'chiron', name: 'Chiron', glyph: '⚷', kind: 'point', en: 'Chiron' },
  { code: 'fortune', name: 'Fortuna', glyph: '⊗', kind: 'point', en: 'Part of Fortune' },
  { code: 'vertex', name: 'Vertex', glyph: 'Vx', kind: 'point', en: 'Vertex' },
  { code: 'antivertex', name: 'Anti-Vertex', glyph: 'AVx', kind: 'point', en: 'Anti-Vertex' },
  { code: 'asc', name: 'AC', glyph: 'AC', kind: 'angle', en: 'Ascendant' },
  { code: 'mc', name: 'MC', glyph: 'MC', kind: 'angle', en: 'Midheaven' },
  { code: 'dsc', name: 'DC', glyph: 'DC', kind: 'angle', en: 'Descendant' },
  { code: 'ic', name: 'IC', glyph: 'IC', kind: 'angle', en: 'Imum Coeli' },
];
export const BODY = Object.fromEntries(BODIES.map(b => [b.code, b])) as Record<BodyCode, Body>;
/** "3/10 hành tinh": the ten she counts in a chart's structures */
export const PLANETS: PlanetCode[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const isPlanet = (b: BodyCode): b is PlanetCode => (PLANETS as string[]).includes(b);

export type AspectCode = 'conjunction' | 'semisextile' | 'semisquare' | 'sextile' | 'quintile' | 'square' | 'trine'
  | 'sesquiquadrate' | 'biquintile' | 'quincunx' | 'opposition';
export interface AspectDef {
  code: AspectCode; angle: number; name: string; en: string; glyph: string;
  /** her orb (Thuật ngữ, 4.: "độ lệch góc cho phép lên đến X hay Y độ"): X, and Y when Mặt Trời or Mặt Trăng is in it */
  orb: [number, number];
  /** the four she gives a dominant planet its weight by (đồng vị, vuông góc, tam hợp, xung) — the rest are weak ("góc chiếu yếu") */
  strong: boolean;
  /** how many signs apart the two ends naturally stand (the aspect read between whole signs); none for 45°, 72°, 135°, 144° */
  signs: number | null;
}
export const ASPECTS: AspectDef[] = [
  { code: 'conjunction', angle: 0, name: 'Đồng vị', en: 'conjunction', glyph: '☌', orb: [5, 10], strong: true, signs: 0 },
  { code: 'semisextile', angle: 30, name: 'Bán lục hợp', en: 'semisextile', glyph: '⚺', orb: [1, 3], strong: false, signs: 1 },
  { code: 'semisquare', angle: 45, name: 'Bán phương', en: 'semisquare', glyph: '∠', orb: [2, 5], strong: false, signs: null },
  { code: 'sextile', angle: 60, name: 'Lục hợp', en: 'sextile', glyph: '⚹', orb: [3, 5], strong: false, signs: 2 },
  // her glossary names the quintiles without an orb; her handout gives every weak aspect 3°
  { code: 'quintile', angle: 72, name: 'Góc Q', en: 'quintile', glyph: 'Q', orb: [3, 3], strong: false, signs: null },
  { code: 'square', angle: 90, name: 'Vuông góc', en: 'square', glyph: '□', orb: [5, 7], strong: true, signs: 3 },
  { code: 'trine', angle: 120, name: 'Tam hợp', en: 'trine', glyph: '△', orb: [5, 7], strong: true, signs: 4 },
  { code: 'sesquiquadrate', angle: 135, name: 'Tam bán phương', en: 'sesquiquadrate', glyph: '⚼', orb: [2, 5], strong: false, signs: null },
  { code: 'biquintile', angle: 144, name: 'Góc Q đúp', en: 'biquintile', glyph: 'bQ', orb: [3, 3], strong: false, signs: null },
  { code: 'quincunx', angle: 150, name: 'Bất đồng vị', en: 'quincunx', glyph: '⚻', orb: [3, 5], strong: false, signs: 5 },
  { code: 'opposition', angle: 180, name: 'Xung', en: 'opposition', glyph: '☍', orb: [5, 7], strong: true, signs: 6 },
];
export const ASPECT = Object.fromEntries(ASPECTS.map(a => [a.code, a])) as Record<AspectCode, AspectDef>;

/** Vượng (exaltation), Tử (fall), Tướng (ruler), Tù (detriment) */
export type Dignity = 'exaltation' | 'fall' | 'ruler' | 'detriment';
export const DIGNITY_NAME: Record<Dignity, string> = { exaltation: 'Vượng', fall: 'Tử', ruler: 'Tướng', detriment: 'Tù' };
/** her table on p. 29 ("Cung vượng và cung hãm của Hải vương và Diêm vương vẫn còn đang bị tranh cãi", p. 30) */
export const DIGNITIES: Record<PlanetCode, Record<Dignity, SignCode[]>> = {
  sun: { exaltation: ['aries'], fall: ['libra'], ruler: ['leo'], detriment: ['aquarius'] },
  mercury: { exaltation: ['virgo'], fall: ['pisces'], ruler: ['gemini', 'virgo'], detriment: ['sagittarius', 'pisces'] },
  venus: { exaltation: ['pisces'], fall: ['virgo'], ruler: ['taurus', 'libra'], detriment: ['scorpio', 'aries'] },
  moon: { exaltation: ['taurus'], fall: ['scorpio'], ruler: ['cancer'], detriment: ['capricorn'] },
  mars: { exaltation: ['capricorn'], fall: ['cancer'], ruler: ['aries', 'scorpio'], detriment: ['libra', 'taurus'] },
  jupiter: { exaltation: ['cancer'], fall: ['capricorn'], ruler: ['sagittarius', 'pisces'], detriment: ['gemini', 'virgo'] },
  saturn: { exaltation: ['libra'], fall: ['aries'], ruler: ['capricorn', 'aquarius'], detriment: ['cancer', 'leo'] },
  uranus: { exaltation: ['scorpio'], fall: ['taurus'], ruler: ['aquarius'], detriment: ['leo'] },
  neptune: { exaltation: ['leo', 'cancer'], fall: ['aquarius', 'capricorn'], ruler: ['pisces'], detriment: ['virgo'] },
  pluto: { exaltation: ['aries', 'pisces'], fall: ['libra', 'virgo'], ruler: ['scorpio'], detriment: ['taurus'] },
};
/** a planet's dignities in a sign: a sign can be two at once in her table (Sao Thủy in Xử Nữ is Vượng and Tướng) */
export function dignitiesOf(p: PlanetCode, s: SignCode): Dignity[] {
  const d = DIGNITIES[p];
  return (['ruler', 'exaltation', 'detriment', 'fall'] as Dignity[]).filter(k => d[k].includes(s));
}

/** houses: cung góc (1, 4, 7, 10), cung tiếp (2, 5, 8, 11), cung đuôi (3, 6, 9, 12) — her table says Angular, Succedent, Cadent */
export type HouseKind = 'angular' | 'succedent' | 'cadent';
export const houseKind = (n: number): HouseKind => (['angular', 'succedent', 'cadent'] as HouseKind[])[(n - 1) % 3];
/** her glossary (Thuật ngữ, 1.): cung đêm 1–6, cung ngày 7–12; bán cầu Đông 10–12 and 1–3, bán cầu Tây 4–9 */
export const isNightHouse = (n: number) => n >= 1 && n <= 6;
export const isEastHouse = (n: number) => n <= 3 || n >= 10;

// ── degrees ──
export const norm = (x: number) => ((x % 360) + 360) % 360;
/** the shorter way round between two longitudes, 0..180 */
export const separation = (a: number, b: number) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
export const signOf = (lon: number): SignCode => SIGNS[Math.floor(norm(lon) / 30)].code;
export const degreeInSign = (lon: number) => norm(lon) % 30;
/** 9°02' — degrees and minutes in the sign, rounded down to the minute as the ephemerides print them */
export function dm(lon: number): string {
  const d = degreeInSign(lon);
  let deg = Math.floor(d), min = Math.floor((d - deg) * 60 + 1e-9);
  if (min === 60) { deg += 1; min = 0; }
  return `${deg}°${String(min).padStart(2, '0')}'`;
}
/** "9°02' Bò Cạp" */
export const lonText = (lon: number) => `${dm(lon)} ${SIGN[signOf(lon)].name}`;
/** "Đồng vị" → "đồng vị", "Góc Q" → "góc Q" (inside a sentence) */
export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
