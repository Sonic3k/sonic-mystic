/* Reads a chart with the knowledge base: which of grandma's sentences hold for each palace, and, kept apart,
   which "bổ sung" sentences (common Tử Vi knowledge, not hers) hold too. Nothing here invents text: every line shown
   is a rule's own text, and every rule says why it matched. */
import { ageIn, daiHanAt, nguyetHan, tieuHanAt, type Chart } from './chart.js';
import { evaluate, parse, starsOf, type Node } from './dsl.js';
import { BRANCHES, BRANCH_ELEMENT, PALACES, STAR_BY_ID, findTarget, mod12, type Element, type Palace, type Target } from './names.js';

export type Tone = 'cat' | 'hung' | 'trung' | 'mixed';
/** the voice of a rule: 'ba' = a family source (grandma's notes); 'bo-sung' = anything else (supplement, other books) */
export type Source = 'ba' | 'bo-sung';

export interface Rule {
  id: string; source: Source;
  /** which knowledge source the rule comes from (a book code) — lets readings name the book once there are several */
  sourceCode?: string;
  /** grandma's rules: the book entry and paragraph the text comes from */
  entry?: number; para?: number;
  /** the star the rule is listed under (the entry's star, or the supplement star) */
  star?: string;
  at: string[]; text: string; ctx?: string; when?: string; tone: Tone; review?: string;
  node?: Node; stars: Set<string>;
}
export interface Match { rule: Rule; why: string[] }
export interface Group { key: string; star?: string; name: string; entry?: number; inPalace: boolean; matches: Match[] }

export interface Principle { id: string; title: string; text: string }
export interface Kb {
  rules: Rule[];
  supplement: Rule[];
  palaceAbout: Record<string, string>;
  principles: Record<string, Principle>;
  starAbout: Record<string, string>;
  entryName: Record<number, string>;
}

export type View = Palace | 'Thân';
export const VIEWS: View[] = [...PALACES, 'Thân'];

/** the branch a view reads */
export const branchOfView = (chart: Chart, v: View): number =>
  v === 'Thân' ? chart.than : chart.palaces.find(p => p.role === v)!.branch;

const targets = (r: Rule): Set<Target | '*'> => new Set(r.at.map(t => (t === '*' ? '*' : findTarget(t))).filter((t): t is Target | '*' => !!t));
const cache = new WeakMap<Rule, Set<Target | '*'>>();
const targetsOf = (r: Rule) => { let t = cache.get(r); if (!t) { t = targets(r); cache.set(r, t); } return t; };

export function compile(raw: Omit<Rule, 'node' | 'stars'>[]): Rule[] {
  return raw.map(r => {
    const p = r.when ? parse(r.when) : undefined;
    return { ...r, node: p?.node, stars: starsOf(p?.node) };
  });
}

function hanOf(chart: Chart, year: number) {
  const dai = daiHanAt(chart, ageIn(chart, year));
  return { dai, tieu: tieuHanAt(chart, year).branch };
}

function matchRules(chart: Chart, rules: Rule[], p: number, want: (t: Set<Target | '*'>) => boolean, year: number, inHan = false): Match[] {
  const han = hanOf(chart, year), out: Match[] = [];
  for (const r of rules) {
    if (!r.node || !want(targetsOf(r))) continue;
    const res = evaluate(r.node, { chart, p, han, inHan });
    if (res.ok) out.push({ rule: r, why: [...new Set(res.why)] });
  }
  return out;
}

/** groups by the star the rules are listed under; stars sitting in the palace first (main stars before the rest) */
function group(chart: Chart, p: number, matches: Match[], kb: Kb): Group[] {
  const by = new Map<string, Group>();
  for (const m of matches) {
    const key = m.rule.source === 'ba' ? `e${m.rule.entry}` : `s${m.rule.star}`;
    let g = by.get(key);
    if (!g) {
      const star = m.rule.star;
      g = { key, star, entry: m.rule.entry, name: m.rule.entry !== undefined ? kb.entryName[m.rule.entry] : STAR_BY_ID[star ?? '']?.name ?? '', inPalace: false, matches: [] };
      by.set(key, g);
    }
    g.matches.push(m);
  }
  const order = new Map(chart.palaces[p].stars.map((s, i) => [s.id, (s.kind === 'chinh' ? 0 : 100) + i]));
  if (chart.tuan.includes(p)) order.set('tuan', 200); if (chart.triet.includes(p)) order.set('triet', 201);
  const groups = [...by.values()];
  for (const g of groups) {
    g.inPalace = !!g.star && order.has(g.star);
    g.matches.sort((a, b) => (a.rule.para ?? 0) - (b.rule.para ?? 0));
  }
  return groups.sort((a, b) => (order.get(a.star ?? '') ?? 1000) - (order.get(b.star ?? '') ?? 1000) || (a.entry ?? 0) - (b.entry ?? 0));
}

export interface PalaceReading {
  view: View; branch: number;
  ba: Group[]; boSung: Group[];
  about?: string;
  counts: { ba: number; boSung: number; cat: number; hung: number };
}

export function readView(chart: Chart, kb: Kb, view: View, year = chart.options.viewYear): PalaceReading {
  const p = branchOfView(chart, view);
  /* a palace shows the rules written for it and the "any palace" ones; the Thân view, the rules written for Thân */
  const want = (t: Set<Target | '*'>) => (view === 'Thân' ? t.has('Thân') : t.has(view) || t.has('*'));
  const ba = matchRules(chart, kb.rules, p, want, year), bs = matchRules(chart, kb.supplement, p, want, year);
  const tone = (t: Tone) => ba.filter(m => m.rule.tone === t).length;
  return {
    view, branch: p, ba: group(chart, p, ba, kb), boSung: group(chart, p, bs, kb), about: kb.palaceAbout[view],
    counts: { ba: ba.length, boSung: bs.length, cat: tone('cat'), hung: tone('hung') },
  };
}

export interface HanReading {
  year: number; age: number; canChi: string;
  dai: { branch: number; from: number; to: number; ba: Group[]; boSung: Group[] } | null;
  tieu: { branch: number; dong: boolean; ba: Group[]; boSung: Group[] };
  months: number[];
}

const STEMS_VI = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const yearCanChi = (year: number) => `${STEMS_VI[(((year - 4) % 10) + 10) % 10]} ${BRANCHES[mod12(year - 4)]}`;

/** grandma's sentences "về hạn", read at the đại hạn and the tiểu hạn palace of a year */
export function readHan(chart: Chart, kb: Kb, year: number): HanReading {
  const age = ageIn(chart, year), d = daiHanAt(chart, age), t = tieuHanAt(chart, year);
  const want = (s: Set<Target | '*'>) => s.has('Hạn');
  const at = (b: number) => ({
    ba: group(chart, b, matchRules(chart, kb.rules, b, want, year, true), kb),
    boSung: group(chart, b, matchRules(chart, kb.supplement, b, want, year, true), kb),
  });
  const cell = d === null ? null : chart.palaces[d];
  return {
    year, age, canChi: yearCanChi(year),
    dai: cell ? { branch: cell.branch, from: cell.daiHan[0], to: cell.daiHan[1], ...at(cell.branch) } : null,
    tieu: { branch: t.branch, dong: t.dong, ...at(t.branch) },
    months: nguyetHan(chart, year),
  };
}

// ── the "bổ sung" principles that apply to a chart (common knowledge, written for the app; never grandma's) ─

const GEN: Record<Element, Element> = { 'Kim': 'Thủy', 'Thủy': 'Mộc', 'Mộc': 'Hỏa', 'Hỏa': 'Thổ', 'Thổ': 'Kim' };
const CTRL: Record<Element, Element> = { 'Kim': 'Mộc', 'Mộc': 'Thổ', 'Thổ': 'Thủy', 'Thủy': 'Hỏa', 'Hỏa': 'Kim' };
/** a vs b: 'same' | 'a_sinh_b' | 'b_sinh_a' | 'a_khac_b' | 'b_khac_a' */
export function relation(a: Element, b: Element) {
  if (a === b) return 'same';
  if (GEN[a] === b) return 'a_sinh_b';
  if (GEN[b] === a) return 'b_sinh_a';
  if (CTRL[a] === b) return 'a_khac_b';
  return 'b_khac_a';
}

export function principlesFor(chart: Chart, kb: Kb): Principle[] {
  const ids: string[] = [];
  ids.push(`than_cu.${chart.palaces[chart.than].role}`);
  const mc = relation(chart.napAm.element, chart.cuc.element);
  ids.push(`menh_cuc.${({ same: 'binh_hoa', a_sinh_b: 'menh_sinh_cuc', b_sinh_a: 'cuc_sinh_menh', a_khac_b: 'menh_khac_cuc', b_khac_a: 'cuc_khac_menh' } as const)[mc]}`);
  ids.push(chart.yang === (chart.menh % 2 === 0) ? 'am_duong.thuan' : 'am_duong.nghich');
  const cm = relation(BRANCH_ELEMENT[chart.menh], chart.napAm.element);
  ids.push(`cung_menh.${({ same: 'dong_hanh', a_sinh_b: 'cung_sinh_menh', b_sinh_a: 'menh_sinh_cung', a_khac_b: 'cung_khac_menh', b_khac_a: 'menh_khac_cung' } as const)[cm]}`);
  if (!chart.palaces[chart.menh].stars.some(s => s.kind === 'chinh')) ids.push('menh_vcd');
  return ids.map(id => kb.principles[id]).filter((x): x is Principle => !!x);
}

/** Tuần / Triệt weight on a palace, from grandma's note: "Dương hành Tam Thất - Âm quy Nhị Bát" */
export function khongWeight(chart: Chart, b: number): { tuan?: number; triet?: number } {
  const w = (pair: [number, number]) => {
    if (!pair.includes(b)) return undefined;
    const yangPalace = b % 2 === 0;
    return chart.yang ? (yangPalace ? 7 : 3) : (yangPalace ? 2 : 8);
  };
  return { tuan: w(chart.tuan), triet: w(chart.triet) };
}

// ── what the AI reading is given: grandma's matched lines and the bổ sung lines, kept apart by source ─────────

export interface ReadingLine { ref: string; palace: string; source: Source; text: string; why: string }

export const lineOf = (m: Match, palace: string): ReadingLine => ({
  ref: m.rule.id, palace, source: m.rule.source,
  text: m.rule.ctx ? `(${m.rule.ctx}) ${m.rule.text}` : m.rule.text,
  why: m.why.join('; '),
});

export function chartSummary(chart: Chart, year: number): string {
  const S = (b: number) => {
    const c = chart.palaces[b];
    const main = c.stars.filter(s => s.kind === 'chinh').map(s => `${s.name}${s.level ? ` (${s.level})` : ''}${s.hoa ? ` [${s.hoa}]` : ''}`);
    const other = c.stars.filter(s => s.kind !== 'chinh').map(s => s.name);
    const k = [chart.tuan.includes(b) ? 'Tuần' : '', chart.triet.includes(b) ? 'Triệt' : ''].filter(Boolean).join(', ');
    return `- ${c.role}${c.isThan ? ' (Thân)' : ''} tại ${BRANCHES[b]}: chính tinh ${main.join(', ') || 'vô chính diệu'}; phụ tinh ${other.join(', ')}${k ? `; ${k}` : ''}; đại hạn ${c.daiHan[0]}–${c.daiHan[1]}`;
  };
  const h = hanOf(chart, year), age = ageIn(chart, year);
  const i = chart.input;
  return [
    `Giới tính: ${i.gender === 'nam' ? 'Nam' : 'Nữ'} · ${chart.amDuong}`,
    `Sinh ngày âm lịch ${chart.lunar.day}/${chart.lunar.month}${chart.lunar.leap ? ' nhuận' : ''} năm ${STEMS_VI[chart.stem]} ${BRANCHES[chart.branch]} (${chart.lunar.year}), giờ ${BRANCHES[chart.hour]}`,
    `Mệnh: ${chart.napAm.name} · Cục: ${chart.cuc.name} · Mệnh chủ: ${chart.menhChu} · Thân chủ: ${chart.thanChu} · Thân cư ${chart.palaces[chart.than].role}`,
    ...chart.palaces.map(c => c.branch).sort((a, b) => mod12(a - chart.menh) - mod12(b - chart.menh)).map(S),
    `Năm xem ${year} (${yearCanChi(year)}): tuổi ${age}; đại hạn ${h.dai === null ? 'chưa vào' : `cung ${chart.palaces[h.dai].role}`}; tiểu hạn cung ${chart.palaces[h.tieu].role}`,
  ].join('\n');
}

/** a short stable hash, to know when a stored AI reading no longer matches the chart */
export function hashOf(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2246822519); }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
}
