/* The contract between the Mystic API and the webs that use it: what each endpoint takes and returns.
   Types only — the API builds these objects, every web reads them. */
import type { BirthInput, Chart, ChartOptions, Principle, Tone, View } from './tuvi/index.js';
import type { NumerologyChart, ParaRole, RuleKind, Topic } from './numerology/index.js';
import type { AstroChart, RuleKind as AstrologyRuleKind, Topic as AstrologyTopic, Transits, WeighRule, Weighing } from './astrology/index.js';

/** grandma's voice (a family source) or anything added on top of it (supplement, other books, AI) */
export type Layer = 'primary' | 'added';
export type SourceKind = 'family' | 'book' | 'supplement';
export type Gender = 'male' | 'female';

export interface DisciplineDto { code: string; name: string; description: string | null; ready: boolean }

export interface SourceDto {
  code: string; discipline: string; title: string; author: string | null; kind: SourceKind;
  description: string | null; note: string | null; sourceFile: string | null;
  entries: number; passages: number; rules: number; reviewNotes: number;
}

export interface RuleDto {
  code: string; source: 'grandma' | 'supplement'; sourceCode: string;
  text: string; ctx: string | null; when: string | null; tone: Tone; review: string | null;
  at: string[]; star: string | null; entryRef: number | null; paraRef: number | null;
  edited: boolean; active: boolean;
}

// ── book ──
export interface EntrySummaryDto {
  id: number; code: string; ref: number | null; kind: string; title: string; symbols: string[];
  /** the entry it sits under (a book's sections), null at the top */
  parent: string | null;
  passages: number; rules: number; reviewNotes: number; firstLine: string | null;
}
export interface PassageDto {
  id: number; key: string; kind: string; section: string | null; ref: number | null; text: string;
  /** set only when the text was reworded in the database: what was imported */
  originalText: string | null;
  rules: RuleDto[];
}
export interface TableDto { key: string; title: string | null; columns: string[]; rows: string[][] }
export interface SymbolDto {
  code: string; name: string; kind: string; tone: string | null; ring: string | null; description: string | null;
  aliases: string[]; dignities: Record<string, string[]>; sourceCode: string | null;
}
export interface EntryDto {
  id: number; code: string; ref: number | null; kind: string; title: string; ordinal: number;
  source: SourceDto; symbols: SymbolDto[]; passages: PassageDto[]; tables: TableDto[];
  /** the added layer about the same symbols, from the supplement source — never grandma's */
  supplement: { symbol: string; name: string; about: string | null; rules: RuleDto[] }[];
  prev: { ref: number | null; code: string; title: string } | null;
  next: { ref: number | null; code: string; title: string } | null;
}
export interface SearchHitDto { passageId: number; passageRef: number | null; sourceCode: string; sourceKind: SourceKind; entryRef: number | null; entryCode: string; entryTitle: string; section: string | null; text: string }
export interface SearchResultDto { query: string; total: number; hits: SearchHitDto[] }
export interface LookupResultDto { total: number; rules: RuleDto[]; entryTitles: Record<string, string> }
export interface VariantDto { code: string; title: string; primaryText: string; alternativeText: string }
export interface SetupDto {
  source: SourceDto; note: string | null;
  steps: { code: string; title: string; lines: string[]; appNote: string | null; table: TableDto | null }[];
  hoaGiap: TableDto | null; triet: TableDto | null;
  /** grandma's own opening of the Luận notebook: Tuần, trung tinh, the rings, hạn */
  preface: string[];
  variants: VariantDto[];
  /** where Tử Vi sits for each cục and lunar day (grandma's five tables): days[branch] = the days that put it there */
  tuViTable: { cuc: number; name: string; days: number[][] }[];
}
export interface CatalogDto {
  stars: { code: string; name: string; kind: string; tone: string | null; ring: string | null; aliases: string[]; hasEntry: boolean }[];
  groups: { code: string; name: string; aliases: string[]; mode: string; stars: string[] }[];
}

// ── Tử vi readings ──
export type TuViSettings = Pick<ChartOptions, 'variant' | 'leapMonth' | 'tyNextDay' | 'lunarCalendar' | 'hourBasis'>;
export interface TuViRequest { birth: BirthInput; settings?: Partial<TuViSettings>; viewYear?: number }
export interface MatchDto { rule: string; why: string[] }
export interface GroupDto { key: string; star: string | null; name: string; entryRef: number | null; inPalace: boolean; matches: MatchDto[] }
export interface ViewReadingDto {
  view: View; branch: number; about: string | null;
  counts: { grandma: number; supplement: number; cat: number; hung: number };
  grandma: GroupDto[]; supplement: GroupDto[];
}
export interface HanReadingDto {
  year: number; age: number; canChi: string;
  dai: { branch: number; from: number; to: number; grandma: GroupDto[]; supplement: GroupDto[] } | null;
  tieu: { branch: number; dong: boolean; grandma: GroupDto[]; supplement: GroupDto[] };
  months: number[];
}
export interface TuViReadingDto {
  engineVersion: string; knowledgeVersion: string; viewYear: number;
  chart: Chart;
  views: Record<View, ViewReadingDto>;
  han: HanReadingDto;
  /** the added-layer principles that apply to this chart (thân cư, mệnh–cục…) */
  principles: Principle[];
  /** added-layer notes on reading any chart (mệnh chủ, tam phương, miếu hãm, đại hạn, tiểu hạn) */
  general: Record<string, Principle>;
  /** every rule the groups above mention, by code */
  rules: Record<string, RuleDto>;
  /** source code → title, for naming books once there are several */
  sources: Record<string, { title: string; kind: SourceKind }>;
}

// ── people and profiles ──
export interface BirthDto {
  calendar: 'solar' | 'lunar'; year: number | null; month: number | null; day: number | null; leapMonth: boolean;
  /** clock time "HH:MM" (solar), when known */
  time: string | null;
  /** the giờ branch 0 Tý … 11 Hợi, when only that is known (lunar records) */
  hourBranch: number | null;
  timeApprox: boolean; timeZone: string | null; utcOffsetMinutes: number | null;
  place: string | null; latitude: number | null; longitude: number | null;
}
export interface LinkDto { system: string; externalId: string; ownsIdentity: boolean; syncedAt: string | null }
export interface ProfileSummaryDto {
  id: string; discipline: string; label: string | null; viewYear: number | null; createdAt: string; updatedAt: string; aiReadings: number;
  /** the birth this profile reads (kept as it was saved: it may differ from the person's) */
  gender: Gender | null; birth: BirthDto;
  /** nhân số học: the name the profile reads (null for other disciplines) */
  name: string | null;
}
export interface SubjectDto {
  id: string; displayName: string; gender: Gender | null; birth: BirthDto; note: string | null;
  links: LinkDto[]; profiles: ProfileSummaryDto[]; createdAt: string; updatedAt: string;
}
export interface ProfileDto {
  id: string; discipline: string; label: string | null; viewYear: number | null; note: string | null;
  subject: { id: string; displayName: string; links: LinkDto[] };
  /** the birth exactly as this profile read it — later edits of the person do not change an old profile */
  gender: Gender | null; birth: BirthDto;
  /** tử vi: how the stars are placed (null for other disciplines) */
  settings: TuViSettings | null;
  /** nhân số học: the names read, the primary one first in importance (null for other disciplines) */
  names: NumerologyNameDto[] | null;
  engineVersion: string; knowledgeVersion: string;
  /** set when the knowledge has changed since the profile was made */
  knowledgeChanged: boolean;
  createdAt: string; updatedAt: string;
}
export interface SonicHubPersonDto { id: string; name: string; displayName: string | null; nickname: string | null; avatarUrl: string | null; isSelf: boolean }

// ── AI readings ──
/**
 * How much a section of a reading weighs on the chart, by the source's own rules (brightness, Tuần Triệt, dignity, orb,
 * the book's order of the numbers): intro = how it was weighed; key = what governs the chart; normal = has an effect,
 * does not govern; current = the period being lived; minor = weakened or too small (one short line each).
 */
export type Weight = 'intro' | 'key' | 'normal' | 'current' | 'minor';
export const WEIGHTS: readonly Weight[] = ['intro', 'key', 'normal', 'current', 'minor'];
/** where a cited passage stands in its source — sent for every ref, so one the chart did not match (a passage on how to
    weigh, say) can be shown and linked too */
export interface RefSourceDto {
  /** the source's code ("grandma", "astrology.hk", "ldqh"…) and its kind */
  source: string; kind: SourceKind;
  /** whose words (chiêm tinh: hk, tierney, woolfolk), the run-in label of the passage */
  voice: string | null; label: string | null;
  /** the entry it is under: its code and title, and where it starts in the source (a line of grandma's notes; a page) */
  entry: string; entryTitle: string; entryRef: number | null;
  /** where the passage itself is (a line of grandma's notes; a page of a book) */
  paraRef: number | null;
}
export interface AiRefDto { code: string; quoted: string; src: RefSourceDto | null }
export interface AiItemDto { layer: Layer; text: string; refs: AiRefDto[] }
export interface AiSectionDto {
  title: string; items: AiItemDto[];
  /** null: a reading written before readings were weighed */
  weight: Weight | null;
  /** why it weighs what it does ("Triệt ở Mùi chỉ 3 phần", "Vuông AC, lệch 0°17′") */
  basis: string[];
}
export interface AiReadingDto {
  id: string;
  /** the profile it reads; null for one written of the person as a whole (the Nhận định) */
  profileId: string | null;
  subjectId: string;
  /** a profile: tử vi "overview", a palace, "Thân", "han-YYYY"; nhân số học, chiêm tinh "synthesis" (the Căn cứ); any
      "summary" (the Luận giải given to the person, read first). The person: "summary" (the Nhận định) */
  scope: string; viewYear: number;
  /** who wrote it: 'ai' (the app's AI call) or 'claude' (written with Claude and saved here) */
  author: string;
  model: string | null; inputHash: string | null;
  caution: string | null; sections: AiSectionDto[]; createdAt: string;
  /** the chart, the settings or the matched lines have changed since this reading was written */
  stale: boolean;
  /** on saving a written reading: the refs it cited that its chart did not match (left out) */
  dropped?: string[];
  /** on saving a written reading: what goes against how readings are written and weighed (it is saved all the same) */
  warnings?: string[];
}
/** what whoever writes a profile's readings needs beside the chart: how they are written, and (chiêm tinh) how the chart weighs */
export interface ReadingPlanDto {
  discipline: string;
  spec: string;
  /** chiêm tinh: the rules every chart is weighed by, and this chart's weighing (each factor's level and why) */
  rules: WeighRule[] | null;
  weights: Weighing | null;
  /** chiêm tinh: the minutes around the birth time within which the houses and signs read stay the same */
  window: { from: string; to: string; before: number; after: number; capped: boolean } | null;
  timeApprox: boolean;
  /** chiêm tinh: the slow planets over the chart from the start of the year read to the end of the next (the period
      a reading's "năm nay" speaks of) */
  transits: Transits | null;
}
export interface AiStatusDto { ai: boolean; model: string }
/** a reading written elsewhere (with Claude) and saved to a profile: each idea that retells the book cites its passages */
export interface WrittenReadingInput {
  viewYear?: number; author?: string; model?: string | null; caution?: string | null;
  /** factors: chiêm tinh, the ids of the chart's factors a section reads (checked against the weighing, not stored) */
  sections: { title: string; weight?: Weight | null; basis?: string[]; factors?: string[]; items: { layer: Layer; text: string; refs?: string[] }[] }[];
}

// ── the brief Sonic Hub keeps beside a person ──
export interface BriefDto {
  discipline: string; title: string; subjectId: string; profileId: string | null; profileLabel: string | null; url: string | null;
  facts: { label: string; value: string }[];
  lines: { layer: Layer; text: string; source: string }[];
  updatedAt: string;
}

// ── Nhân số học (Lê Đỗ Quỳnh Hương's book) ──
export interface NumerologyNameDto {
  /** what the name is to the person ("Tên gọi", "Họ tên đầy đủ", "Tên ở nhà"…) */
  label: string | null;
  text: string;
  /** the name the reading speaks of */
  primary: boolean;
}
export interface NumerologyBirthDto {
  calendar: 'solar' | 'lunar'; year: number; month: number; day: number;
  leapMonth?: boolean;
  /** decides the lunar calendar of 1968–1975 (the South used UTC+8 until 13/6/1975) */
  latitude?: number | null;
}
export interface NumerologyRequest {
  birth: NumerologyBirthDto; gender?: Gender | null; names?: NumerologyNameDto[];
  /** the personal year to read (default: the one lived today) */
  viewYear?: number;
}
export interface NumerologyRuleDto {
  code: string; text: string; page: number | null;
  /** rule: the book describing the person · advice · child: words about a child · general: the book's explanation of
      the part read, shown once at its top */
  kind: RuleKind;
  topic: Topic;
  /** the section of the book it stands in */
  entry: string;
  when: string;
  edited: boolean; active: boolean;
}
export interface NumerologySourceDto { code: string; title: string; author: string | null; description: string | null; note: string | null }
export interface NumerologyMatchDto { rule: string; why: string[] }
export interface NumerologyGroupDto { entry: string; title: string; path: string[]; matches: NumerologyMatchDto[] }
export interface NumerologySectionDto { topic: Topic; title: string; focus: string | null; groups: NumerologyGroupDto[] }
export interface NumerologyReadingDto {
  engineVersion: string; knowledgeVersion: string;
  /** the date read, and how it was found when the birth was written in the lunar calendar */
  solar: { year: number; month: number; day: number; fromLunar: boolean; note: string | null };
  chart: NumerologyChart;
  /** the personal year read, and the calendar year it is asked for (null: the one lived today) */
  pyear: number; viewYear: number | null;
  /** the name read: its index in chart.names (null: no name) */
  name: number | null;
  sections: NumerologySectionDto[];
  /** every rule the sections cite, by code */
  rules: Record<string, NumerologyRuleDto>;
  source: NumerologySourceDto;
}
export interface NumerologyTocEntryDto {
  code: string; title: string; parent: string | null; depth: number; kind: string; page: number | null;
  topic: Topic | null; passages: number; rules: number;
}
export interface NumerologyBookDto {
  source: NumerologySourceDto;
  toc: NumerologyTocEntryDto[];
  /** the parts of a reading, each with the part of the book it reads */
  topics: { code: Topic; title: string; part: number; entry: string | null }[];
}
export interface NumerologyPassageDto {
  id: number; key: string; kind: string; role: ParaRole; page: number | null; text: string;
  /** set only when the text was reworded in the database: what was imported */
  originalText: string | null;
  /** the condition under which the book says this of a person (null: method, example, figure, note) */
  rule: NumerologyRuleDto | null;
}
export interface NumerologyEntryTextDto { code: string; title: string; depth: number; page: number | null; passages: NumerologyPassageDto[]; tables: TableDto[] }
export interface NumerologyEntryDto {
  code: string; title: string; page: number | null; topic: Topic | null;
  path: { code: string; title: string }[];
  /** the entry and every section under it, in the book's order */
  sections: NumerologyEntryTextDto[];
  prev: { code: string; title: string } | null; next: { code: string; title: string } | null;
  source: NumerologySourceDto;
}
export interface NumerologySymbolDto { code: string; name: string; kind: string; rules: number }
export interface NumerologyLookupDto {
  symbols: NumerologySymbolDto[]; total: number;
  groups: { entry: string; title: string; path: string[]; rules: NumerologyRuleDto[] }[];
}
export interface NumerologyCatalogDto {
  symbols: NumerologySymbolDto[];
  topics: { code: Topic; title: string; part: number }[];
  tables: (TableDto & { entry: string })[];
}

// ── Chiêm tinh (cô Hương Kiều's materials, the class's Tierney, Woolfolk in Claude's translation) ──
/** whose words a passage is: cô Hương Kiều's own, her class's notes, Bil Tierney's (the class's translation), Woolfolk's
    (Claude's translation), the other books on weighing a chart (Claude's translation), the weighting rules Claude drew
    from all of them */
export type AstrologyVoice = 'hk' | 'notes' | 'tierney' | 'woolfolk' | 'books' | 'claude';
export interface AstrologyBirthDto {
  year: number; month: number; day: number;
  /** clock time "HH:MM", null when not known (the chart then has no AC, MC or houses) */
  time: string | null;
  /** the time is only roughly known: the reading shows the span of times that give the same chart */
  timeApprox?: boolean;
  utcOffsetMinutes: number | null; timeZone: string | null;
  place: string | null; latitude: number | null; longitude: number | null;
}
export interface AstrologyRequest { birth: AstrologyBirthDto; gender?: Gender | null }
export interface AstrologyChartDto {
  chart: AstroChart;
  /** the UTC offset used, and what the reader should know about how the chart was set up */
  offsetMinutes: number; notes: string[];
  /** the span of birth times around the one given that read the same (same AC, same sign of the Moon, every planet
      in the same house); null without a time or a place */
  window: { from: string; to: string; before: number; after: number; capped: boolean } | null;
}
export interface AstrologySourceDto {
  code: string; title: string; author: string | null; description: string | null; note: string | null;
  /** how a reading names it: "Lời cô", "Ghi chép lớp", "Bản dịch Tierney", "Woolfolk", "Sách khác", "Claude tổng hợp" */
  label: string | null;
  translator: string | null;
}
export interface AstrologyRuleDto {
  code: string; source: string; voice: AstrologyVoice;
  text: string;
  /** the original of a translated passage (Woolfolk's English, the other books') */
  en: string | null;
  label: string | null; items: string[] | null; page: number | null;
  /** rule: the source speaking of the person · general: its explanation of the part read, shown once at its top */
  kind: AstrologyRuleKind;
  topic: AstrologyTopic;
  entry: string; when: string;
  edited: boolean; active: boolean;
}
export interface AstrologyMatchDto { rule: string; why: string[] }
export interface AstrologyGroupDto { entry: string; source: string; title: string; path: string[]; matches: AstrologyMatchDto[] }
export interface AstrologySectionDto { topic: AstrologyTopic; title: string; focus: string | null; groups: AstrologyGroupDto[] }
export interface AstrologyReadingDto extends AstrologyChartDto {
  engineVersion: string; knowledgeVersion: string;
  sections: AstrologySectionDto[];
  /** every rule the sections cite, by code */
  rules: Record<string, AstrologyRuleDto>;
  sources: AstrologySourceDto[];
}
export interface AstrologyTocEntryDto {
  code: string; title: string; parent: string | null; depth: number; page: number | null;
  topic: AstrologyTopic | null; passages: number; rules: number;
}
export interface AstrologyBookDto {
  sources: { source: AstrologySourceDto; toc: AstrologyTocEntryDto[] }[];
  topics: { code: AstrologyTopic; title: string }[];
}
export interface AstrologyPassageDto {
  id: number; key: string; kind: string; role: string; voice: AstrologyVoice | null; page: number | null;
  text: string; en: string | null; label: string | null; items: string[] | null;
  /** set only when the text was reworded in the database: what was imported */
  originalText: string | null;
  rule: AstrologyRuleDto | null;
}
export interface AstrologyEntryTextDto { code: string; title: string; depth: number; page: number | null; passages: AstrologyPassageDto[]; tables: TableDto[] }
export interface AstrologyEntryDto {
  code: string; title: string; page: number | null; topic: AstrologyTopic | null;
  path: { code: string; title: string }[];
  sections: AstrologyEntryTextDto[];
  prev: { code: string; title: string } | null; next: { code: string; title: string } | null;
  source: AstrologySourceDto;
}
export interface AstrologySymbolDto { code: string; name: string; kind: string; rules: number }
export interface AstrologyLookupDto {
  symbols: AstrologySymbolDto[]; total: number;
  groups: { entry: string; source: string; title: string; path: string[]; rules: AstrologyRuleDto[] }[];
}
export interface AstrologyCatalogDto {
  symbols: AstrologySymbolDto[];
  topics: { code: AstrologyTopic; title: string }[];
  sources: AstrologySourceDto[];
}
