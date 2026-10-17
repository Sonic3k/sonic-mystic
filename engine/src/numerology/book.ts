/* Lê Đỗ Quỳnh Hương's book as data: its source code, the shape of the bundle the knowledge base builds from it (and
   the API imports), and the book's figures read back into the birth charts they draw. */
import type { RuleKind, Topic } from './reading.js';

export const BOOK_SOURCE = 'numerology.ldqh';

/** what a paragraph is to the person read — rule: the book describing them; advice; child: its words about a child;
    general: an explanation of the part read; method: how to compute; example: someone else's chart; figure; note */
export type ParaRole = RuleKind | 'method' | 'example' | 'figure' | 'note';

export interface BookPara {
  /** the block of the proofread book (stable: passages are keyed "b{id}") */
  id: number;
  /** para · item · figure · note */
  kind: string;
  role: ParaRole;
  /** the page of the PDF it starts on, and every page when it runs over */
  page: number; pages?: number[];
  text: string;
}
export interface BookEntry {
  code: string; title: string; parent: string | null; kind: 'part' | 'section';
  page: number;
  /** the block of its heading */
  at: number;
  /** the part of a reading it belongs to */
  topic: Topic | null;
  /** the numbers and arrows the whole entry is about ("ruling:9", "empty-arrow:4-5-6"…) */
  symbols: string[];
  paras: BookPara[];
}
export interface BookSource {
  code: string; title: string; author: string;
  basedOn?: string; publisher?: string; file?: string; note?: string;
}
/** a paragraph that speaks of a person, with the condition under which it does */
export interface BundleRule {
  /** code ("ldqh.b412") */ i: string;
  /** entry code */ e: string;
  /** paragraph id */ p: number;
  /** page */ pg: number;
  /** text */ t: string;
  /** condition */ w: string;
  /** kind */ k: RuleKind;
  /** topic */ tp: Topic;
  /** order in the book */ o: number;
  /** symbols the condition speaks of */ s: string[];
}
export interface BundleTable { entry: string; key: string; title: string | null; columns: string[]; rows: string[][] }
export interface BundleManifest { discipline: 'numerology'; version: string; entries: number; passages: number; rules: number; built: string }
/** everything kb/bundle/numerology holds, as the API takes it (from disk, or uploaded) */
export interface NumerologyBundle {
  manifest: BundleManifest;
  book: { source: BookSource; entries: BookEntry[] };
  rules: BundleRule[];
  tables: { about?: string; tables: BundleTable[] };
}

/** a figure of the book: its caption, the birth chart it draws (rows top to bottom: 3 6 9 / 2 5 8 / 1 4 7, "-" for
    an empty cell), and what else the picture shows */
export interface Figure { caption: string | null; grid: string[][] | null; notes: string | null }

const GRID = /^[\d\-()]+(\s*\|\s*[\d\-()]+){2}(\s*\/\s*[\d\-()]+(\s*\|\s*[\d\-()]+){2}){2}$/;

/** "[Hình] Hình 4: Biểu đồ ngày sinh 27/5/1983 || 3 | - | 9 / 2 | 5 | 8 / 1 | - | 7 || notes" → caption, grid, notes */
export function figureOf(text: string): Figure {
  const parts = text.split('||').map(s => s.trim());
  const caption = parts[0] || null;
  let grid: string[][] | null = null, notes = parts.slice(1);
  if (parts[1] && GRID.test(parts[1])) {
    grid = parts[1].split('/').map(r => r.split('|').map(c => c.trim()));
    notes = parts.slice(2);
  }
  return { caption, grid, notes: notes.filter(Boolean).join(' · ') || null };
}
