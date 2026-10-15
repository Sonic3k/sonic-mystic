/* Names shared by the chart, the condition language and the pages: branches, stems, palaces, stars, groups.
   The star catalogue (stars.json) is part of the engine: placements and the condition language depend on its ids.
   The API copies it into the database for descriptions; computing never reads it from there. */
import kb from './stars.json' with { type: 'json' };

export const BRANCHES = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'] as const;
export const STEMS = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const;
export const ELEMENTS = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'] as const;
export type Element = (typeof ELEMENTS)[number];

/** element of each earthly branch (Dần Mão Mộc · Tỵ Ngọ Hỏa · Thân Dậu Kim · Hợi Tý Thủy · Thìn Tuất Sửu Mùi Thổ) */
export const BRANCH_ELEMENT: Element[] = ['Thủy', 'Thổ', 'Mộc', 'Mộc', 'Thổ', 'Hỏa', 'Hỏa', 'Thổ', 'Kim', 'Kim', 'Thổ', 'Thủy'];

/** the twelve palaces, counted thuận from Mệnh — "Mệnh, Phụ mẫu, Phúc đức, Điền trạch, Quan Lộc, Nô bộc, Thiên di, Giải ách, Tài bạch, Tử tức, Phu thê, Huynh đệ" */
export const PALACES = ['Mệnh', 'Phụ Mẫu', 'Phúc Đức', 'Điền Trạch', 'Quan Lộc', 'Nô Bộc', 'Thiên Di', 'Tật Ách', 'Tài Bạch', 'Tử Tức', 'Phu Thê', 'Huynh Đệ'] as const;
export type Palace = (typeof PALACES)[number];
/** a rule targets a palace, the palace where Thân sits, or a hạn palace */
export type Target = Palace | 'Thân' | 'Hạn';
export const SHORT: Record<Target, string> = {
  'Mệnh': 'Mệnh', 'Phụ Mẫu': 'Phụ', 'Phúc Đức': 'Phúc', 'Điền Trạch': 'Điền', 'Quan Lộc': 'Quan', 'Nô Bộc': 'Nô', 'Thiên Di': 'Di',
  'Tật Ách': 'Ách', 'Tài Bạch': 'Tài', 'Tử Tức': 'Tử', 'Phu Thê': 'Phu Thê', 'Huynh Đệ': 'Huynh', 'Thân': 'Thân', 'Hạn': 'Hạn',
};

export const mod12 = (n: number) => ((n % 12) + 12) % 12;
export const mod10 = (n: number) => ((n % 10) + 10) % 10;

/**
 * Folds the spellings grandma mixes so names compare equal: old tone placement (Hoá/Hóa, Toạ/Tọa, Thuỷ/Thủy),
 * Sương/Xương, Tí/Tý, Tị/Tỵ, Riêu/Diêu, Sỹ/Sĩ. Only for comparing — never shown.
 */
export function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().trim().replace(/\.$/, '').replace(/\s+/g, ' ')
    .replace(/o([áàảãạ])(?![\p{L}])/gu, (_, v: string) => ({ 'á': 'óa', 'à': 'òa', 'ả': 'ỏa', 'ã': 'õa', 'ạ': 'ọa' } as Record<string, string>)[v])
    .replace(/u([ýỳỷỹỵ])(?![\p{L}])/gu, (_, v: string) => ({ 'ý': 'úy', 'ỳ': 'ùy', 'ỷ': 'ủy', 'ỹ': 'ũy', 'ỵ': 'ụy' } as Record<string, string>)[v])
    .replace(/(^|[^\p{L}])sương(?![\p{L}])/gu, '$1xương')
    .replace(/(^|[^\p{L}])tí(?![\p{L}])/gu, '$1tý')
    .replace(/(^|[^\p{L}])tị(?![\p{L}])/gu, '$1tỵ')
    .replace(/(^|[^\p{L}])riêu(?![\p{L}])/gu, '$1diêu')
    .replace(/(^|[^\p{L}])sỹ(?![\p{L}])/gu, '$1sĩ');
}

export type Level = 'M' | 'V' | 'D' | 'B' | 'H';
export const LEVEL_NAME: Record<Level, string> = { M: 'miếu', V: 'vượng', D: 'đắc', B: 'bình', H: 'hãm' };
export const LEVEL_MARK: Record<Level, string> = { M: 'M', V: 'V', D: 'Đ', B: 'B', H: 'H' };

export interface StarDef {
  id: string; name: string; aliases?: string[];
  /** chinh = one of the 14 main stars; khong = Tuần / Triệt (they sit on the line between two palaces) */
  kind: 'chinh' | 'phu' | 'khong';
  tone?: 'cat' | 'hung' | 'trung';
  ring?: 'loc' | 'tue' | 'sinh';
  bright?: Partial<Record<Level, string[]>>;
  /** 'bo-sung' when grandma's notes have no entry for the star */
  source?: 'bo-sung';
}
export interface GroupDef { name: string; aliases?: string[]; mode: 'all' | 'any' | 'min'; min?: number; stars: string[]; note?: string }

export const STARS: StarDef[] = kb.stars as StarDef[];
export const GROUPS: GroupDef[] = kb.groups as GroupDef[];
export const STAR_BY_ID: Record<string, StarDef> = Object.fromEntries(STARS.map(s => [s.id, s]));

const starIndex = new Map<string, StarDef>();
for (const s of STARS) for (const n of [s.name, ...(s.aliases ?? [])]) starIndex.set(norm(n), s);
const groupIndex = new Map<string, GroupDef>();
for (const g of GROUPS) for (const n of [g.name, ...(g.aliases ?? [])]) groupIndex.set(norm(n), g);

export const findStar = (name: string): StarDef | undefined => starIndex.get(norm(name)) ?? STAR_BY_ID[name.trim()];
export const findGroup = (name: string): GroupDef | undefined => groupIndex.get(norm(name));

const branchIndex = new Map(BRANCHES.map((b, i) => [norm(b), i] as const));
export const findBranch = (name: string): number | undefined => branchIndex.get(norm(name));
/** "Tứ Mộ", "Tứ Sinh", "Tứ Chính" — the branch sets grandma names */
export const BRANCH_SETS: Record<string, number[]> = { [norm('Tứ Mộ')]: [4, 10, 1, 7], [norm('Tứ Sinh')]: [2, 8, 5, 11], [norm('Tứ Chính')]: [0, 6, 3, 9] };

const palaceAlias: [string, Target][] = [
  ['mệnh', 'Mệnh'], ['phụ mẫu', 'Phụ Mẫu'], ['phụ', 'Phụ Mẫu'], ['phúc đức', 'Phúc Đức'], ['phúc', 'Phúc Đức'], ['điền trạch', 'Điền Trạch'], ['điền', 'Điền Trạch'],
  ['quan lộc', 'Quan Lộc'], ['quan', 'Quan Lộc'], ['nô bộc', 'Nô Bộc'], ['nô', 'Nô Bộc'], ['thiên di', 'Thiên Di'], ['di', 'Thiên Di'],
  ['tật ách', 'Tật Ách'], ['giải ách', 'Tật Ách'], ['ách', 'Tật Ách'], ['tài bạch', 'Tài Bạch'], ['tài', 'Tài Bạch'], ['tử tức', 'Tử Tức'], ['tử', 'Tử Tức'],
  ['phu thê', 'Phu Thê'], ['thê', 'Phu Thê'], ['phu', 'Phu Thê'], ['huynh đệ', 'Huynh Đệ'], ['huynh', 'Huynh Đệ'], ['bào', 'Huynh Đệ'],
  ['thân', 'Thân'], ['hạn', 'Hạn'],
];
const palaceIndex = new Map(palaceAlias.map(([k, v]) => [norm(k), v]));
export const findTarget = (name: string): Target | undefined => palaceIndex.get(norm(name));

/** grandma's miếu/vượng/đắc/bình/hãm table, star id → level at each of the twelve branches */
const BRIGHT = new Map<string, (Level | undefined)[]>();
for (const s of STARS) {
  const row: (Level | undefined)[] = Array(12).fill(undefined);
  for (const l of ['H', 'B', 'D', 'V', 'M'] as Level[]) for (const b of s.bright?.[l] ?? []) { const i = findBranch(b); if (i !== undefined) row[i] = l; }
  BRIGHT.set(s.id, row);
}
export const brightOf = (star: StarDef | undefined, branch: number): Level | undefined => (star ? BRIGHT.get(star.id)?.[branch] : undefined);
