/* The contract between the Mystic API and the webs that use it: what each endpoint takes and returns.
   Types only — the API builds these objects, every web reads them. */
import type { BirthInput, Chart, ChartOptions, Principle, Tone, View } from './tuvi/index.js';
import type { NumerologyChart, ParaRole, RuleKind, Topic } from './numerology/index.js';

/** grandma's voice (a family source) or anything added on top of it (supplement, other books, AI) */
export type Layer = 'primary' | 'added';
export type SourceKind = 'family' | 'book' | 'supplement';
export type Gender = 'male' | 'female';

export interface DisciplineDto { code: string; name: string; description: string | null; ready: boolean }

export interface SourceDto {
  code: string; discipline: string; title: string; author: string | null; kind: SourceKind;
  description: string | null; note: string | null; sourceFile: string | null;
  /** who may read its text: anyone, or the owner only (a published book) */
  access: 'public' | 'owner';
  entries: number; passages: number; rules: number; reviewNotes: number;
}

export interface RuleDto {
  code: string; source: 'ba' | 'bo-sung'; sourceCode: string;
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
  counts: { ba: number; boSung: number; cat: number; hung: number };
  ba: GroupDto[]; boSung: GroupDto[];
}
export interface HanReadingDto {
  year: number; age: number; canChi: string;
  dai: { branch: number; from: number; to: number; ba: GroupDto[]; boSung: GroupDto[] } | null;
  tieu: { branch: number; dong: boolean; ba: GroupDto[]; boSung: GroupDto[] };
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
export interface ProfileSummaryDto { id: string; discipline: string; label: string | null; viewYear: number | null; createdAt: string; updatedAt: string; aiReadings: number }
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
export interface AiItemDto { layer: Layer; text: string; refs: { code: string; quoted: string }[] }
export interface AiSectionDto { title: string; items: AiItemDto[] }
export interface AiReadingDto {
  id: string; profileId: string; scope: string; viewYear: number;
  /** who wrote it: 'ai' (the app's AI call) or 'claude' (written with Claude and saved here) */
  author: string;
  model: string | null; inputHash: string | null;
  caution: string | null; sections: AiSectionDto[]; createdAt: string;
  /** the chart, the settings or the matched lines have changed since this reading was written */
  stale: boolean;
  /** on saving a written reading: the refs it cited that its chart did not match (left out) */
  dropped?: string[];
}
export interface AiStatusDto { ai: boolean; model: string }
/** a reading written elsewhere (with Claude) and saved to a profile: each idea that retells the book cites its passages */
export interface WrittenReadingInput {
  viewYear?: number; author?: string; model?: string | null; caution?: string | null;
  sections: { title: string; items: { layer: Layer; text: string; refs?: string[] }[] }[];
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
