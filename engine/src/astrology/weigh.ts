/* How much each part of a chart weighs in a reading, by one set of rules for every chart:
   - Trọng điểm (key): what governs the chart;
   - Tô thêm (normal): has an effect, does not govern;
   - Ít tác dụng (minor): weakened or too small.
   Each rule rests on passages of the sources ("<source>.b<line>", as the knowledge base numbers them), and says so
   when it is the writer's application of a passage rather than the passage's own words. Her test of the dominant
   planets names the planetary type and is one sign of strength among others: it never ranks a chart, and a low score,
   a planet's Tù or Tử alone, "not a planet" or "the test does not score it" never make anything minor.
   Pure computation: what in the chart meets which rule — never a score. */
import type { AstroChart } from './chart.js';
import { LEVEL_NAME } from './dominant.js';
import {
  ASPECT, BODY, DIGNITY_NAME, PLANETS, SIGN, lowerFirst, norm, separation,
  type AspectCode, type BodyCode, type PlanetCode, type SignCode,
} from './zodiac.js';

export type WeighLevel = 'key' | 'normal' | 'minor';
export const WEIGH_LEVEL_NAME: Record<WeighLevel, string> = { key: 'Trọng điểm', normal: 'Tô thêm', minor: 'Ít tác dụng' };

export interface WeighRule {
  code: string; level: WeighLevel; name: string;
  /** the rule in words, as a reading's "Cách cân" may state it */
  text: string;
  /** the passages it rests on: hers first, then the class's notes, then the other books ("books.b<n>") */
  refs: string[];
  /** passages that say otherwise, kept beside the rule rather than hidden */
  against?: string[];
  /** set when the rule applies a passage beyond its own words: how */
  applied?: string;
}

/** what the rules rest on, before any one of them: why a chart is weighed, in what order, and how far the weighing goes */
export const WEIGH_PRINCIPLES: { text: string; refs: string[] }[] = [
  { text: 'Cân lá số là để biết điều gì nói trước, nói kỹ: ảnh hưởng chính cho âm chủ đạo, ảnh hưởng phụ chỉ điều chỉnh nó. Không cộng điểm để một hành tinh «thắng» các hành tinh khác: mỗi yếu tố vẫn giữ phần nghĩa của nó, cân chỉ để xếp thứ tự ưu tiên.',
    refs: ['books.b86', 'books.b23', 'books.b66', 'books.b68'] },
  { text: 'Thứ tự xét: Mặt Trời, Mặt Trăng, cung Mọc và chủ tinh lá số trước; rồi khung lá số (cung ngày – cung đêm, bán cầu Đông – Tây); rồi các yếu tố nổi lên theo các luật trọng điểm; rồi các cung lĩnh vực đời, La Hầu – Kế Đô và các điểm; sau cùng đọc cả lá số như một con người, giữ cả chỗ các yếu tố kéo nhau.',
    refs: ['hk.b60', 'hk.b61', 'hk.b62', 'hk.b63', 'books.b3', 'books.b6', 'books.b9', 'books.b26', 'books.b29', 'books.b71', 'books.b81'] },
  { text: 'Thường chỉ hai ba hành tinh nổi hẳn lên. Luật nào cũng là chỗ dựa cho phán đoán, không thay phán đoán.',
    refs: ['books.b22', 'books.b78', 'books.b30'] },
  { text: 'Lời cô đi trước; ghi chép của lớp và các sách khác dùng để hiểu rõ lời cô hay lấp chỗ cô không nói. Chỗ sách nói khác cô, hay các sách nói khác nhau, thì ghi ra cạnh luật, không giấu.',
    refs: [] },
  { text: 'Khi giờ sinh chỉ là ước lượng, cung Mọc, MC và nóc các cung có thể lệch vài độ: những gì đổi trong khoảng giờ ấy được ghi riêng cho từng yếu tố.',
    refs: ['books.b56'] },
];

/** the rules, in the order a reading's "Cách cân" states them */
export const WEIGH_RULES: WeighRule[] = [
  { code: 'K1', level: 'key', name: 'Nguồn sáng, cung Mọc, chủ tinh lá số',
    text: 'Mặt Trời, Mặt Trăng, cung Mọc (AC) và chủ tinh lá số luôn là trọng điểm.',
    refs: ['hk-dominant.b2', 'hk-aries.b7', 'hk-notes.b4', 'woolfolk.b4', 'woolfolk.b1492', 'woolfolk.b2285', 'woolfolk.b2286', 'books.b3', 'books.b11', 'books.b40', 'books.b46', 'books.b72', 'books.b81'],
    against: ['books.b51'],
    applied: 'Heindel cho một hành tinh khác mạnh hơn hẳn thay chủ tinh cung Mọc (books.b51); ở đây chủ tinh cung Mọc luôn là trọng điểm, còn hành tinh mạnh kia tự lên trọng điểm qua các luật khác.' },
  { code: 'K2', level: 'key', name: 'Hành tinh ở góc',
    text: 'Hành tinh (kể cả Chiron) ở cung góc 1, 4, 7, 10, hoặc cách AC, MC, DC, IC trong vòng 10°.',
    refs: ['hk-dominant.b3', 'hk-notes.b43', 'woolfolk.b2304', 'woolfolk.b2316', 'books.b18', 'books.b42', 'books.b47', 'books.b48', 'books.b73', 'books.b77', 'books.b82', 'books.b83'],
    applied: '10° là độ lệch bài test của cô cho đồng vị với AC, MC (hk-dominant.b3); hành tinh sát góc mà nằm ở cung bên cạnh vẫn tính, như bài test gốc tính hành tinh đồng vị IC dù ở cung 3 (books.b42).' },
  { code: 'K3', level: 'key', name: 'Quạt xếp',
    text: 'Từ ba hành tinh trở lên cùng một dấu hiệu hay cùng một cung: cả cụm là trọng điểm, và điều nổi lên là chất của dấu hiệu, của cung ấy; từng hành tinh trong cụm được đọc trong cụm.',
    refs: ['hk-dominant.b14', 'hk.b812', 'books.b16', 'books.b17', 'books.b64', 'books.b87'],
    applied: 'Quạt xếp theo dấu hiệu mà không có hành tinh cá nhân nào (chỉ Sao Mộc, Sao Thổ và hành tinh thế hệ) là nét chung của cả lớp người sinh cùng thời (hk.b812), nên không tự nâng.' },
  { code: 'K4', level: 'key', name: 'Ở nhà mình hay thế Vượng',
    text: 'Hành tinh ở dấu hiệu nó làm chủ (Tướng) hay ở thế Vượng.',
    refs: ['hk.b184', 'hk.b186', 'woolfolk.b2329', 'woolfolk.b2330', 'woolfolk.b2331', 'books.b13', 'books.b33', 'books.b50', 'books.b77', 'books.b84'],
    against: ['books.b13'],
    applied: 'Với Thiên Vương, Hải Vương, Diêm Vương, dấu hiệu là nét chung của cả thế hệ (hk.b812), nên Tướng hay Vượng tự nó không nâng; thế Vượng, Tử của Hải Vương và Diêm Vương còn tranh cãi (hk.b191). Forrest vẫn coi Hải Vương ở Song Ngư là tiêu điểm (books.b13); ở đây theo lời cô về hành tinh thế hệ. Điều này chỉ chặn việc nâng, không dùng để hạ.' },
  { code: 'K5', level: 'key', name: 'Cháy máy đo',
    text: 'Hành tinh được trên 40 điểm («cháy máy đo») trong bài test nhân tố trội của cô là hành tinh trội: gọi tên mẫu người.',
    refs: ['hk-dominant.b15', 'hk.b813', 'hk-dominant.b2', 'books.b43'] },
  { code: 'K6', level: 'key', name: 'Đồng vị Mặt Trời, đơn lẻ, đứng yên',
    text: 'Hành tinh đồng vị Mặt Trời trong 5°; hành tinh duy nhất ở một nửa lá số; hành tinh đứng yên mà có thêm một dấu hiệu mạnh khác.',
    refs: ['hk.b820', 'hk.b60', 'hk.b61', 'hk.b62', 'hk.b63', 'tierney.b14', 'woolfolk.b2410', 'books.b15', 'books.b19', 'books.b20', 'books.b62'],
    against: ['books.b84'],
    applied: 'Libra kể hành tinh đứng yên vào dấu hiệu yếu (books.b84), Forrest coi là mạnh khi có thế mạnh khác (books.b20): nên đứng yên chỉ nâng khi đi cùng một dấu hiệu mạnh khác, không tự nâng, không tự hạ.' },
  { code: 'K7', level: 'key', name: 'Góc chiếu chính sát',
    text: 'Đồng vị, vuông góc, tam hợp, xung trong 5° (mức thấp của cô) giữa hai yếu tố trọng điểm, hoặc với Mặt Trời, Mặt Trăng, AC: góc chiếu ấy là trọng điểm. Hành tinh ở đầu kia chỉ lên trọng điểm khi tự nó hợp một luật khác.',
    refs: ['hk.b43', 'hk.b836', 'hk.b839', 'hk.b840', 'hk.b842', 'hk-dominant.b5', 'hk-dominant.b43', 'woolfolk.b2408', 'books.b21', 'books.b32', 'books.b61', 'books.b75', 'books.b76'],
    applied: 'Góc chiếu chỉ lên trọng điểm khi cả hai đầu đều là trọng điểm, hay một đầu là Mặt Trời, Mặt Trăng, AC; nên một góc chiếu chung cả thế hệ như Thiên Vương tam hợp Hải Vương thường không lên (books.b76).' },
  { code: 'N1', level: 'normal', name: 'Khung lá số',
    text: 'Bán cầu, góc phần tư, nguyên tố, thể thức: tô thêm cho cả lá số.',
    refs: ['hk.b60', 'hk.b61', 'hk.b62', 'hk.b63', 'hk.b64', 'hk-notes.b47', 'hk-notes.b48', 'hk-notes.b49', 'hk-notes.b50', 'woolfolk.b2280', 'books.b6', 'books.b7', 'books.b63'] },
  { code: 'N2', level: 'normal', name: 'Cung lĩnh vực đời',
    text: 'Một lĩnh vực đời đọc qua cung của nó: dấu hiệu ở nóc cung, chủ tinh của dấu hiệu ấy, các sao trong cung và góc chiếu của chúng.',
    refs: ['hk.b195', 'hk.b39', 'hk-notes.b156'] },
  { code: 'N3', level: 'normal', name: 'La Hầu, Kế Đô và các điểm',
    text: 'La Hầu – Kế Đô đọc thành một trục hai cung; Nguyệt Bột, Tử Khí, Fortuna, Vertex đọc theo cung, cùng các sao chung cung và lưu ý của cô. Điểm nào đồng vị hay xung một hành tinh hay một góc trong 3° thì đọc trong phần của yếu tố ấy, như nét tô thêm cho nó, không thành yếu tố chi phối riêng. Cấu trúc dựng bằng hành tinh trước.',
    refs: ['hk.b827', 'hk.b828', 'hk.b829', 'hk.b830', 'hk.b831', 'hk.b832', 'hk.b172', 'tierney.b308', 'tierney.b309', 'woolfolk.b2342', 'books.b25', 'books.b26', 'books.b27', 'books.b38', 'books.b53', 'books.b54', 'books.b55'],
    against: ['books.b53'],
    applied: '3° là ngưỡng sách dùng cho La Hầu, Kế Đô (Heindel 2–3°, books.b53; Forrest 2–4°, books.b26, books.b27), áp sang các điểm khác. Heindel chỉ tính La Hầu, Kế Đô khi chạm một hành tinh hay AC; cô và Forrest đọc chúng cả theo cung, nên ở đây điểm không chạm gì vẫn được đọc theo cung, ở mức tô thêm.' },
  { code: 'N4', level: 'normal', name: 'Góc chiếu phụ',
    text: 'Lục hợp, bán lục hợp, góc Q, bQ, 45°, 135°, 150°: là nội dung (Q, bQ thường là năng khiếu), không nâng, không hạ mức.',
    refs: ['hk.b43', 'hk-dominant.b8', 'hk.b837', 'hk.b838', 'hk.b841', 'hk.b843', 'hk.b844', 'books.b39'] },
  { code: 'N5', level: 'normal', name: 'Bài test nhân tố trội',
    text: 'Bài test gọi tên mẫu người hành tinh; ô cộng 2–5 điểm cô để người luận tự cân dành cho góc chiếu với La Hầu, Kế Đô, hay La Hầu, Kế Đô, Fortuna ở dấu hiệu hay cung của hành tinh. Điểm test không xếp hạng, không hạ một yếu tố.',
    refs: ['hk-dominant.b2', 'hk-dominant.b13', 'books.b37', 'books.b38', 'books.b43', 'books.b23', 'books.b66', 'books.b68'] },
  { code: 'M1', level: 'minor', name: 'Góc chiếu lỏng',
    text: 'Góc chiếu có độ lệch nằm giữa mức thấp và mức cao của cô, đứng riêng, không thuộc cấu trúc nào.',
    refs: ['hk.b836', 'hk.b839', 'hk.b840', 'hk.b842', 'hk.b43', 'books.b21', 'books.b32'] },
  { code: 'M2', level: 'minor', name: 'Hành tinh yếu mọi mặt',
    text: 'Hành tinh cùng lúc ở thế Tù hay Tử, không ở góc, không có góc chiếu chính nào trong 5°, không thuộc quạt xếp. Không bao giờ xếp vào đây chỉ vì: không phải hành tinh, bài test không tính, điểm test thấp, hay Tù, Tử một mình.',
    refs: ['hk.b188', 'hk.b190', 'hk.b191', 'hk.b827', 'hk-dominant.b2', 'books.b14', 'books.b84'] },
];
export const WEIGH_RULE = Object.fromEntries(WEIGH_RULES.map(r => [r.code, r])) as Record<string, WeighRule>;

export interface WeighNote { rule?: string; why: string }
export type WeighKind = 'body' | 'point' | 'stellium' | 'pattern' | 'aspect' | 'house' | 'frame';
export interface WeighFactor {
  /** "sun", "chiron", "north-node", "stellium:sign:capricorn", "aspect:sun|pluto", "house:7", "frame" */
  id: string;
  kind: WeighKind;
  bodies: BodyCode[];
  /** how a reading names it ("Mặt Trời ở Bảo Bình, cung 11") */
  title: string;
  level: WeighLevel;
  /** the rules that set its level, each with what in the chart meets it */
  reasons: WeighNote[];
  /** what colours it without changing its level: dignity, the test, the points on it, a cusp close by… */
  notes: WeighNote[];
  /** a point read inside the part of the factor it touches: that factor's id */
  attachedTo: string | null;
  /** what is different at the ends of the birth-time window ("08:56: Nguyệt Bột ở cung 8") */
  varies: string[];
  /** an aspect's distance from exact, in degrees */
  orb?: number;
}
export interface Weighing { factors: WeighFactor[]; notes: string[] }

/** the bodies weighed as planets: the ten, and Chiron, which her test scores like one (hk-dominant, Chiron kế) */
export const WEIGHED_AS_PLANETS: BodyCode[] = [...PLANETS, 'chiron'];
const POINTS: BodyCode[] = ['north-node', 'south-node', 'lilith', 'ziqi', 'fortune', 'vertex', 'antivertex'];
const ANGLES: BodyCode[] = ['asc', 'mc', 'dsc', 'ic'];
const MAJOR: AspectCode[] = ['conjunction', 'square', 'trine', 'opposition'];
const OUTER = new Set<BodyCode>(['uranus', 'neptune', 'pluto']);
const PERSONAL = new Set<BodyCode>(['sun', 'moon', 'mercury', 'venus', 'mars']);
/** her lower orb ("lên đến 5 hay 7 độ": the 5) */
const LOWER = (k: AspectCode) => ASPECT[k].orb[0];
const CLOSE = 5;
const NEAR_ANGLE = 10;
const POINT_ORB = 3;
/** how fast each moves at most, in degrees a day: under a twentieth of it, it stands still (đứng yên) */
const MAX_SPEED: Partial<Record<BodyCode, number>> = {
  mercury: 2.2, venus: 1.26, mars: 0.79, jupiter: 0.24, saturn: 0.13, uranus: 0.062, neptune: 0.038, pluto: 0.04, chiron: 0.15,
};
const ANGLE_NAME: Record<string, string> = { asc: 'AC', mc: 'MC', dsc: 'DC', ic: 'IC' };
const nameOf = (b: BodyCode) => ANGLE_NAME[b] ?? BODY[b].name;
/** 1°17′ — degrees and minutes, the minutes rounded down as her test prints them */
export const orbText = (x: number) => { const d = Math.floor(x + 1e-9), m = Math.min(59, Math.floor((x - d) * 60 + 1e-9)); return `${d}°${String(m).padStart(2, '0')}′`; };
const pairId = (a: BodyCode, b: BodyCode) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** a factor a point is read with, by name: "Mặt Trời", "cung 7" */
export const ownerName = (id: string) => (id.startsWith('house:') ? `cung ${id.slice(6)}` : nameOf(id as BodyCode));

export interface WeighOptions {
  /** the chart again at the ends of the birth-time window, when the time is an estimate: what differs there is listed */
  alternates?: { label: string; chart: AstroChart }[];
}

export function weighChart(c: AstroChart, opts: WeighOptions = {}): Weighing {
  const pl = c.placements, time = c.timeKnown && !!c.houses;
  const lon = (b: BodyCode) => pl[b]?.lon;
  const has = (b: BodyCode) => pl[b] !== undefined;
  const notes: string[] = [];
  if (!time) notes.push('Chưa có giờ sinh: không xét được cung góc, cung Mọc, chủ tinh lá số, các cung địa bàn và các điểm theo cung.');
  const placeText = (b: BodyCode) => {
    const p = pl[b]!;
    return `${nameOf(b)} ở ${SIGN[p.sign].name}${p.house && BODY[b].kind !== 'angle' ? `, cung ${p.house}` : ''}`;
  };
  const sep = (a: BodyCode, b: BodyCode) => separation(lon(a)!, lon(b)!);
  /** the major aspect two bodies make within `orb`, with how far off exact */
  const major = (a: BodyCode, b: BodyCode, orb: number): { k: AspectCode; off: number } | null => {
    if (!has(a) || !has(b)) return null;
    const s = sep(a, b);
    let best: { k: AspectCode; off: number } | null = null;
    for (const k of MAJOR) { const off = Math.abs(s - ASPECT[k].angle); if (off <= orb && (!best || off < best.off)) best = { k, off }; }
    return best;
  };
  const rulers = c.rulers.chart ?? [];
  const test = new Map(c.dominant.tests.map(t => [t.body as BodyCode, t]));

  // ── each planet (and Chiron), on its own ──
  const bodies = WEIGHED_AS_PLANETS.filter(has);
  const own = new Map<BodyCode, { reasons: WeighNote[]; notes: WeighNote[] }>();
  const strength = new Map<BodyCode, boolean>();
  const nearAngle = (b: BodyCode): { a: BodyCode; off: number } | null => {
    if (!time) return null;
    let best: { a: BodyCode; off: number } | null = null;
    for (const a of ANGLES) { const off = sep(b, a); if (off <= NEAR_ANGLE && (!best || off < best.off)) best = { a, off }; }
    return best;
  };
  const only = (b: BodyCode): string | null => {
    const h = c.balance.hemispheres;
    if (!h || !(PLANETS as BodyCode[]).includes(b)) return null;
    const half: [keyof typeof h, string][] = [['above', 'nửa trên (cung 7–12)'], ['below', 'nửa dưới (cung 1–6)'], ['east', 'bán cầu Đông'], ['west', 'bán cầu Tây']];
    const hit = half.find(([k]) => h[k].length === 1 && h[k][0] === b);
    return hit ? hit[1] : null;
  };
  for (const b of bodies) {
    const p = pl[b]!, reasons: WeighNote[] = [], ns: WeighNote[] = [];
    if (b === 'sun' || b === 'moon') reasons.push({ rule: 'K1', why: `${nameOf(b)}, nguồn sáng` });
    if (rulers.includes(b as PlanetCode)) reasons.push({ rule: 'K1', why: `Chủ tinh lá số (AC ở ${SIGN[pl.asc!.sign].name})` });
    if (time && p.house && [1, 4, 7, 10].includes(p.house)) reasons.push({ rule: 'K2', why: `Ở cung ${p.house}, cung góc` });
    const na = nearAngle(b);
    if (na) reasons.push({ rule: 'K2', why: `Cách ${nameOf(na.a)} ${orbText(na.off)}` });
    const dig = p.dignities.filter(d => d === 'ruler' || d === 'exaltation');
    if (dig.length) {
      const what = dig.map(d => `${DIGNITY_NAME[d]} ở ${SIGN[p.sign].name}`).join(', ');
      if (OUTER.has(b)) ns.push({ rule: 'K4', why: `${what} — dấu hiệu là nét chung của cả thế hệ, tự nó không nâng (hk.b812)${b !== 'uranus' && dig.includes('exaltation') ? '; thế Vượng của nó còn tranh cãi (hk.b191)' : ''}` });
      else reasons.push({ rule: 'K4', why: what });
    }
    for (const d of p.dignities.filter(d => d === 'detriment' || d === 'fall'))
      ns.push({ rule: 'M2', why: `${DIGNITY_NAME[d]} ở ${SIGN[p.sign].name}${d === 'detriment' ? ': năng lượng ức chế hoạt động của nó (hk.b188)' : ': năng lượng khó nhất để nó biểu hiện (hk.b190)'}${(b === 'neptune' || b === 'pluto') && d === 'fall' ? ' — thế Tử của nó còn tranh cãi (hk.b191)' : ''}` });
    const t = test.get(b);
    if (t) {
      if (t.level === 'very-strong') reasons.push({ rule: 'K5', why: `Bài test nhân tố trội: ${t.total} điểm, cháy máy đo` });
      else ns.push({ rule: 'N5', why: `Bài test nhân tố trội: ${t.total} điểm (${LEVEL_NAME[t.level]})${t.withTaurus && t.withTaurus.level !== t.level ? `; tính cả Kim Ngưu: ${t.withTaurus.total} (${LEVEL_NAME[t.withTaurus.level]})` : ''}` });
      for (const ch of t.choices) ns.push({ rule: 'N5', why: `Ô cộng 2–5 điểm, cô để người luận tự cân: ${ch.why}` });
    }
    if (b !== 'sun' && has('sun')) {
      const s = sep(b, 'sun');
      if (s <= CLOSE) reasons.push({ rule: 'K6', why: `Đồng vị Mặt Trời, lệch ${orbText(s)}` });
    }
    const alone = only(b);
    if (alone) reasons.push({ rule: 'K6', why: `Hành tinh duy nhất ở ${alone}` });
    if (p.retro) ns.push({ why: 'Nghịch hành' });
    own.set(b, { reasons, notes: ns });
    strength.set(b, reasons.length > 0);
  }
  // đứng yên: counts when the planet has another sign of strength (a key rule, a strong test, a close aspect to a light or AC)
  for (const b of bodies) {
    const max = MAX_SPEED[b], sp = pl[b]!.speed;
    if (!max || sp === null || Math.abs(sp) >= max / 20) continue;
    const o = own.get(b)!;
    const turning = sp < 0 ? 'sắp thuận hành' : 'sắp nghịch hành';
    const t = test.get(b);
    const lightAspect = (['sun', 'moon', 'asc'] as BodyCode[]).some(x => x !== b && major(b, x, CLOSE));
    if (strength.get(b) || (t && t.level === 'strong') || lightAspect) o.reasons.push({ rule: 'K6', why: `Đứng yên (${turning}), lại có dấu hiệu mạnh khác` });
    else o.notes.push({ rule: 'K6', why: `Đứng yên (${turning}), nhưng không có dấu hiệu mạnh nào khác` });
  }
  const keyBody = (b: BodyCode) => b === 'asc' ? time : (own.get(b)?.reasons.length ?? 0) > 0;

  // ── quạt xếp: by sign (her structure, ≥3 of the ten) and by house ──
  type Cluster = { sign: SignCode | null; house: number | null; members: PlanetCode[] };
  const clusters: Cluster[] = [];
  for (const p of c.patterns.filter(x => x.kind === 'stellium')) clusters.push({ sign: p.sign ?? null, house: null, members: [...p.bodies] });
  if (time) for (let n = 1; n <= 12; n++) {
    const ms = PLANETS.filter(p => pl[p]?.house === n);
    if (ms.length < 3) continue;
    const same = clusters.find(x => x.members.length === ms.length && x.members.every(m => ms.includes(m)));
    if (same) same.house = n; else clusters.push({ sign: null, house: n, members: ms });
  }
  const stelliumOf = new Map<BodyCode, string[]>();
  const factors: WeighFactor[] = [];
  for (const k of clusters) {
    const id = k.sign ? `stellium:sign:${k.sign}` : `stellium:house:${k.house}`;
    const where = [k.sign ? SIGN[k.sign].name : null, k.house ? `cung ${k.house}` : null].filter(Boolean).join(', ');
    const generational = !!k.sign && !k.house && !k.members.some(m => PERSONAL.has(m));
    const reasons: WeighNote[] = [], ns: WeighNote[] = [];
    const list = k.members.map(nameOf).join(', ');
    if (generational) ns.push({ rule: 'K3', why: `${list} cùng ở ${where}: không có hành tinh cá nhân, là nét chung của cả lớp người sinh cùng thời (hk.b812)` });
    else reasons.push({ rule: 'K3', why: `Quạt xếp: ${list} cùng ở ${where}` });
    if (k.house && [1, 4, 7, 10].includes(k.house)) ns.push({ rule: 'K2', why: `Ở cung ${k.house}, cung góc` });
    if (k.members.includes('sun')) ns.push({ why: 'Có Mặt Trời trong cụm' });
    for (const m of k.members) stelliumOf.set(m, [...(stelliumOf.get(m) ?? []), id]);
    factors.push({ id, kind: 'stellium', bodies: k.members, title: `Quạt xếp ${where}: ${list}`, level: generational ? 'normal' : 'key', reasons, notes: ns, attachedTo: null, varies: [] });
  }
  for (const [b, ids] of stelliumOf) {
    const o = own.get(b);
    if (o) for (const id of ids) { const f = factors.find(x => x.id === id)!; o.notes.push({ rule: 'K3', why: `${f.level === 'key' ? 'Thành viên quạt xếp (trọng điểm)' : 'Trong một nhóm cùng dấu hiệu'}: ${f.title}` }); }
  }

  // ── aspects among the planets, Chiron, AC and MC ──
  const inPattern = (a: BodyCode, b: BodyCode) => c.patterns.some(p => p.kind !== 'stellium' && p.bodies.includes(a as PlanetCode) && p.bodies.includes(b as PlanetCode));
  const weighed = new Set<BodyCode>([...bodies, 'asc', 'mc']);
  const aspectFactors: WeighFactor[] = [];
  const closeMajor = new Map<BodyCode, number>();
  for (const x of c.aspects) {
    if (!weighed.has(x.a) || !weighed.has(x.b)) continue;
    const d = ASPECT[x.aspect], isMajor = MAJOR.includes(x.aspect);
    const title = `${nameOf(x.a)} ${lowerFirst(d.name)} ${nameOf(x.b)}, lệch ${orbText(x.orb)}`;
    const reasons: WeighNote[] = [], ns: WeighNote[] = [];
    let level: WeighLevel = 'normal';
    const loose = x.orb > LOWER(x.aspect) + 1e-9;
    if (isMajor && !loose && x.orb <= CLOSE) {
      for (const b of [x.a, x.b]) if (b !== 'asc' && b !== 'mc') closeMajor.set(b, (closeMajor.get(b) ?? 0) + 1);
      const light = [x.a, x.b].find(b => b === 'sun' || b === 'moon' || b === 'asc');
      if (keyBody(x.a) && keyBody(x.b) && x.a !== 'mc' && x.b !== 'mc') { level = 'key'; reasons.push({ rule: 'K7', why: `Góc chiếu chính trong 5° giữa hai yếu tố trọng điểm` }); }
      else if (light) { level = 'key'; reasons.push({ rule: 'K7', why: `Góc chiếu chính trong 5° với ${nameOf(light)}` }); }
    } else if (loose) {
      if (inPattern(x.a, x.b)) ns.push({ rule: 'M1', why: `Lỏng (quá mức ${LOWER(x.aspect)}° của cô) nhưng thuộc một cấu trúc` });
      else { level = 'minor'; reasons.push({ rule: 'M1', why: `Lỏng: lệch ${orbText(x.orb)}, quá mức ${LOWER(x.aspect)}° của cô (mức cao ${d.orb[1]}°)` }); }
    } else if (!isMajor) ns.push({ rule: 'N4', why: d.code === 'quintile' || d.code === 'biquintile' ? 'Góc phụ: thường là năng khiếu (hk.b43)' : 'Góc phụ: là nội dung, không nâng không hạ' });
    if (x.outOfSign) ns.push({ why: 'Góc chiếu phân tách (hai đầu không đứng đúng số dấu hiệu của góc)' });
    aspectFactors.push({ id: `aspect:${pairId(x.a, x.b)}`, kind: 'aspect', bodies: [x.a, x.b], title, level, reasons, notes: ns, attachedTo: null, varies: [], orb: x.orb });
  }

  // ── a planet weak on all counts at once ──
  for (const b of bodies) {
    const o = own.get(b)!;
    if (o.reasons.length) continue;
    const p = pl[b]!;
    const weakSign = p.dignities.some(d => d === 'detriment' || (d === 'fall' && b !== 'neptune' && b !== 'pluto'));
    // not angular can only be told with the time: without it nothing is put here
    if (time && weakSign && (closeMajor.get(b) ?? 0) === 0 && !stelliumOf.has(b) && !(p.house && [1, 4, 7, 10].includes(p.house))) {
      o.reasons.push({ rule: 'M2', why: `${p.dignities.filter(d => d === 'detriment' || d === 'fall').map(d => DIGNITY_NAME[d]).join(', ')}, không ở góc, không có góc chiếu chính nào trong 5°, không thuộc quạt xếp` });
    }
  }

  // ── the points: by house, with what they touch ──
  const pointFactors: WeighFactor[] = [];
  const targets: BodyCode[] = [...bodies, ...ANGLES.filter(has)];
  const attachedTo = new Map<BodyCode, { to: BodyCode; off: number; k: AspectCode }>();
  for (const q of POINTS.filter(has)) {
    let best: { to: BodyCode; off: number; k: AspectCode } | null = null;
    for (const t of targets) {
      const r = major(q, t, POINT_ORB);
      // the closest; on a tie the conjunction (on IC rather than across from MC)
      if (r && (r.k === 'conjunction' || r.k === 'opposition') && (!best || r.off < best.off - 1e-9 || (Math.abs(r.off - best.off) < 1e-9 && r.k === 'conjunction'))) best = { to: t, off: r.off, k: r.k };
    }
    if (best) attachedTo.set(q, best);
  }
  // La Hầu and Kế Đô are one axis: what one touches, the other touches from across
  const nn = attachedTo.get('north-node'), sn = attachedTo.get('south-node');
  if (nn && !sn) attachedTo.set('south-node', { to: nn.to, off: nn.off, k: nn.k === 'conjunction' ? 'opposition' : 'conjunction' });
  if (sn && !nn) attachedTo.set('north-node', { to: sn.to, off: sn.off, k: sn.k === 'conjunction' ? 'opposition' : 'conjunction' });
  /** the factor a point on an angle is read with: AC's part, or the house the angle opens */
  const ownerId = (t: BodyCode) => ({ asc: 'asc', dsc: 'house:7', mc: 'house:10', ic: 'house:4' } as Record<string, string>)[t] ?? t;
  for (const q of POINTS.filter(has)) {
    const p = pl[q]!, reasons: WeighNote[] = [], ns: WeighNote[] = [];
    const at = attachedTo.get(q);
    if (at) reasons.push({ rule: 'N3', why: `${ASPECT[at.k].name} ${nameOf(at.to)} trong 3° (lệch ${orbText(at.off)}): đọc trong phần của ${nameOf(at.to)}` });
    else reasons.push({ rule: 'N3', why: time ? `Đọc theo cung ${p.house}${q === 'north-node' || q === 'south-node' ? ` (trục cung ${pl['north-node']?.house} – cung ${pl['south-node']?.house})` : ''}` : 'Đọc theo dấu hiệu (chưa có giờ sinh)' });
    // what else it touches closely
    // what else it touches closely: a major aspect within 3°, a minor one within 1° (DC and IC are AC and MC across)
    for (const t of targets) {
      if ((at && t === at.to) || t === 'dsc' || t === 'ic') continue;
      const s = sep(q, t);
      for (const d of Object.values(ASPECT)) {
        const off = Math.abs(s - d.angle);
        if (off <= Math.min(MAJOR.includes(d.code) ? POINT_ORB : 1, d.orb[0])) ns.push({ rule: MAJOR.includes(d.code) ? 'N3' : 'N4', why: `${d.name} ${nameOf(t)}, lệch ${orbText(off)}` });
      }
    }
    if (time && p.house) {
      const with_ = bodies.filter(b => pl[b]!.house === p.house);
      if (with_.length) ns.push({ rule: 'N3', why: `Chung cung ${p.house} với ${with_.map(nameOf).join(', ')}` });
    }
    if (q === 'lilith') ns.push({ rule: 'N3', why: 'Cô: ý nghĩa không rõ ràng khi xét lá số gốc, ảnh hưởng rất mạnh trong vận hạn (hk.b832)' });
    if (q === 'ziqi') ns.push({ rule: 'N3', why: 'Cô: độ dày mỏng của cung phúc không thể hiện trực tiếp trên lá số, phụ thuộc cách ăn ở (hk.b172)' });
    if (q === 'north-node') ns.push({ rule: 'N3', why: 'Cô: xem và luận như Mặt Trời, nhưng yếu hơn (hk.b828)' });
    if (q === 'south-node') ns.push({ rule: 'N3', why: 'Cô: xem và luận như Mặt Trăng, nhưng yếu hơn (hk.b829)' });
    pointFactors.push({ id: q, kind: 'point', bodies: [q], title: placeText(q), level: 'normal', reasons, notes: ns, attachedTo: at ? ownerId(at.to) : null, varies: [] });
  }

  // ── the bodies' factors, with the points on them and the cusps close by ──
  const bodyFactors: WeighFactor[] = [];
  const cuspNote = (b: BodyCode): WeighNote | null => {
    if (!time || !pl[b]?.house) return null;
    const h = pl[b]!.house!, cusps = c.houses!;
    const toNext = norm(cusps[h % 12].lon - lon(b)!), fromOwn = norm(lon(b)! - cusps[h - 1].lon);
    const [off, n] = toNext < fromOwn ? [toNext, (h % 12) + 1] : [fromOwn, h];
    return off < 1 ? { why: `Cách nóc cung ${n} chỉ ${orbText(off)} (khoảng ${Math.max(1, Math.round(off * 4))} phút giờ sinh)` } : null;
  };
  const dispositorOf = (who: 'sun' | 'moon') => c.rulers[who].filter(has);
  const reception = (a: PlanetCode, b: PlanetCode) => SIGN[pl[a]!.sign].rulers.includes(b) && SIGN[pl[b]!.sign].rulers.includes(a);
  for (const b of bodies) {
    const o = own.get(b)!;
    const level: WeighLevel = o.reasons.some(r => r.rule?.startsWith('K')) ? 'key' : o.reasons.some(r => r.rule === 'M2') ? 'minor' : 'normal';
    const ns = [...o.notes];
    for (const [q, at] of attachedTo) if (at.to === b) ns.push({ rule: 'N3', why: `${BODY[q].name} ${lowerFirst(ASPECT[at.k].name)}, lệch ${orbText(at.off)}` });
    if (b === 'sun' || b === 'moon') {
      const d = dispositorOf(b);
      if (d.length) ns.push({ why: `Chủ tinh của dấu hiệu ${nameOf(b)}: ${d.map(placeText).join('; ')} (woolfolk.${b === 'sun' ? 'b2290' : 'b2297'})` });
    }
    for (const w of ['sun', 'moon'] as const) if (b !== w && dispositorOf(w).includes(b as PlanetCode)) ns.push({ why: `Chủ tinh của dấu hiệu ${nameOf(w)} (woolfolk.${w === 'sun' ? 'b2290' : 'b2297'})` });
    if ((PLANETS as BodyCode[]).includes(b)) for (const x of PLANETS) if (x !== b && has(x) && reception(b as PlanetCode, x)) ns.push({ why: `Tiếp nhận tương hỗ với ${nameOf(x)} (woolfolk.b2338)` });
    const cn = cuspNote(b);
    if (cn) ns.push(cn);
    bodyFactors.push({ id: b, kind: 'body', bodies: [b], title: placeText(b), level, reasons: o.reasons, notes: ns, attachedTo: null, varies: [] });
  }
  if (time) {
    const ns: WeighNote[] = [];
    for (const [q, at] of attachedTo) if (at.to === 'asc') ns.push({ rule: 'N3', why: `${BODY[q].name} ${lowerFirst(ASPECT[at.k].name)} ${nameOf(at.to)}, lệch ${orbText(at.off)}` });
    if (rulers.length) ns.push({ why: `Chủ tinh lá số: ${rulers.filter(has).map(placeText).join('; ')}` });
    bodyFactors.splice(2, 0, { id: 'asc', kind: 'body', bodies: ['asc'], title: `Cung Mọc ${SIGN[pl.asc!.sign].name}`, level: 'key', reasons: [{ rule: 'K1', why: 'Cung Mọc (AC)' }], notes: ns, attachedTo: null, varies: [] });
    // the chart's rulers right after it
    const rs = bodyFactors.filter(f => rulers.includes(f.id as PlanetCode));
    bodyFactors.splice(0, bodyFactors.length, ...bodyFactors.slice(0, 3), ...rs, ...bodyFactors.slice(3).filter(f => !rs.includes(f)));
  }
  for (const pf of pointFactors) { const cn = cuspNote(pf.bodies[0]); if (cn) pf.notes.push(cn); }

  // ── the other structures: as heavy as their closest links ──
  const patternFactors: WeighFactor[] = [];
  for (const p of c.patterns.filter(x => x.kind !== 'stellium')) {
    const links = aspectFactors.filter(a => p.bodies.includes(a.bodies[0] as PlanetCode) && p.bodies.includes(a.bodies[1] as PlanetCode));
    const key = links.filter(a => a.level === 'key');
    const name = PATTERN_TITLE[p.kind] ?? p.kind;
    patternFactors.push({
      id: `pattern:${p.kind}:${[...p.bodies].sort().join('|')}`, kind: 'pattern', bodies: [...p.bodies],
      title: `${name}: ${p.bodies.map(nameOf).join(', ')}${p.apex ? ` (đỉnh ${nameOf(p.apex)})` : ''}`,
      level: key.length ? 'key' : 'normal',
      reasons: key.length ? key.map(a => ({ rule: 'K7', why: a.title })) : [],
      notes: [{ rule: 'N5', why: 'Cấu trúc nổi bật (hk-dominant.b14)' }], attachedTo: null, varies: [],
    });
  }

  // ── the houses, read as areas of life ──
  const houseFactors: WeighFactor[] = [];
  if (time) for (const h of c.houses!) {
    const ns: WeighNote[] = [];
    const rs = h.rulers.filter(has);
    if (rs.length) ns.push({ rule: 'N2', why: `Chủ tinh nóc cung (${SIGN[h.sign].name}): ${rs.map(placeText).join('; ')}` });
    const inside = h.bodies.filter(b => WEIGHED_AS_PLANETS.includes(b) || POINTS.includes(b));
    ns.push({ rule: 'N2', why: inside.length ? `Trong cung: ${inside.map(nameOf).join(', ')}` : 'Không có hành tinh hay điểm nào trong cung' });
    const cusp = ({ 4: 'ic', 7: 'dsc', 10: 'mc' } as Record<number, BodyCode>)[h.n];
    if (cusp) for (const [q, at] of attachedTo) if (at.to === cusp) ns.push({ rule: 'N3', why: `${BODY[q].name} ${lowerFirst(ASPECT[at.k].name)} ${nameOf(cusp)}, lệch ${orbText(at.off)}` });
    houseFactors.push({ id: `house:${h.n}`, kind: 'house', bodies: inside, title: `Cung ${h.n}, nóc ${SIGN[h.sign].name}`, level: 'normal', reasons: [{ rule: 'N2', why: 'Lĩnh vực đời: đọc qua nóc cung, chủ tinh, các sao trong cung và góc chiếu' }], notes: ns, attachedTo: null, varies: [] });
  }

  // ── the frame ──
  const frame: WeighNote[] = [];
  const hs = c.balance.hemispheres;
  const n10 = PLANETS.filter(has).length;
  if (hs) {
    frame.push({ rule: 'N1', why: `Nửa trên (cung 7–12): ${hs.above.length}/${n10}; nửa dưới (cung 1–6): ${hs.below.length}/${n10}; bán cầu Đông: ${hs.east.length}/${n10}; bán cầu Tây: ${hs.west.length}/${n10}` });
    const q = [0, 0, 0, 0];
    for (const p of PLANETS) if (pl[p]?.house) q[Math.floor((pl[p]!.house! - 1) / 3)]++;
    const top = q.indexOf(Math.max(...q));
    frame.push({ rule: 'N1', why: `Góc phần tư (cung 1–3, 4–6, 7–9, 10–12): ${q.join(', ')}${q[top] >= 5 ? ` — dồn ở góc phần tư thứ ${top + 1}${top === 3 ? ' (woolfolk.b2280)' : ''}` : ''}` });
  }
  const el = c.balance.elements, mo = c.balance.modalities;
  const EL: Record<string, string> = { fire: 'Lửa', earth: 'Đất', air: 'Khí', water: 'Nước' }, MO: Record<string, string> = { cardinal: 'Cốt yếu', fixed: 'Kiên định', mutable: 'Linh hoạt' };
  frame.push({ rule: 'N1', why: `Nguyên tố: ${Object.entries(el).map(([k, v]) => `${EL[k]} ${v.length}`).join(', ')}${Object.entries(el).some(([, v]) => !v.length) ? ` — không có hành tinh nào ở ${Object.entries(el).filter(([, v]) => !v.length).map(([k]) => EL[k]).join(', ')}` : ''}` });
  frame.push({ rule: 'N1', why: `Thể thức: ${Object.entries(mo).map(([k, v]) => `${MO[k]} ${v.length}`).join(', ')}` });
  const frameFactor: WeighFactor = { id: 'frame', kind: 'frame', bodies: [], title: 'Khung lá số: bán cầu, góc phần tư, nguyên tố, thể thức', level: 'normal', reasons: [{ rule: 'N1', why: 'Khung của cả lá số' }], notes: frame, attachedTo: null, varies: [] };

  const LEVEL_ORDER: WeighLevel[] = ['key', 'normal', 'minor'];
  const ordered = [...bodyFactors, ...factors, ...patternFactors, ...aspectFactors.sort((a, b) => a.orb! - b.orb!), ...pointFactors, ...houseFactors, frameFactor];
  const out = LEVEL_ORDER.flatMap(l => ordered.filter(f => f.level === l));

  // what is different at the ends of the birth-time window
  for (const alt of opts.alternates ?? []) {
    const w = weighChart(alt.chart);
    const byId = new Map(w.factors.map(f => [f.id, f]));
    for (const f of out) {
      const g = byId.get(f.id);
      if (!g) { if (f.kind === 'aspect') f.varies.push(`${alt.label}: không còn góc chiếu này`); continue; }
      if (g.level !== f.level) f.varies.push(`${alt.label}: ${WEIGH_LEVEL_NAME[g.level]}`);
      const b = f.bodies[0];
      if ((f.kind === 'body' || f.kind === 'point') && b && alt.chart.placements[b]?.house !== pl[b]?.house && BODY[b].kind !== 'angle')
        f.varies.push(`${alt.label}: ${nameOf(b)} ở cung ${alt.chart.placements[b]?.house}`);
      if (f.kind === 'point' && g.attachedTo !== f.attachedTo) f.varies.push(`${alt.label}: ${g.attachedTo ? `đọc trong phần ${ownerName(g.attachedTo)}` : 'không còn chạm sát yếu tố nào'}`);
    }
    for (const g of w.factors) if (g.kind === 'aspect' && !out.some(f => f.id === g.id)) notes.push(`${alt.label}: thêm góc chiếu ${g.title}`);
  }
  return { factors: out, notes };
}

const PATTERN_TITLE: Record<string, string> = {
  't-square': 'Chữ T', 'grand-trine': 'Tam giác lớn', 'minor-grand-trine': 'Đại tam hợp phụ', kite: 'Con diều', 'grand-cross': 'Đại thập tự',
  yod: 'Ngón tay định mệnh (Yod)', 'grand-sextile': 'Đại lục hợp', 'mystic-rectangle': 'Hình chữ nhật thần bí', 'hard-rectangle': 'Hình chữ nhật khó khăn',
};

/** the level of what a reading's section speaks of: the heaviest of its factors (a point read inside another factor
    weighs as that factor's colour, never more) */
export function levelOfFactors(w: Weighing, ids: string[]): WeighLevel | null {
  const fs = ids.map(id => w.factors.find(f => f.id === id)).filter((f): f is WeighFactor => !!f);
  if (!fs.length) return null;
  return fs.some(f => f.level === 'key') ? 'key' : fs.some(f => f.level === 'normal') ? 'normal' : 'minor';
}
