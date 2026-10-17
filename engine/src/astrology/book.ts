/* The Chiêm tinh bundle (kb/bundle/astrology), as kb/scripts/build-astrology.mjs writes it and the API imports it:
   every source section by section and passage by passage, and every passage that speaks of a person with its
   condition. */
import type { Topic, RuleKind } from './reading.js';

export interface BundleSource {
  code: string; file: string; title: string; author: string;
  /** how a reading names the source: "Lời cô", "Bản dịch Tierney", "Woolfolk" */
  label: string;
  translator?: string; description?: string; note?: string;
}
export interface BundlePassage {
  id: number; kind: string; role: RuleKind; page: number | null; pages?: number[]; text: string;
  voice: 'hk' | 'tierney' | 'woolfolk';
  label?: string; en?: string; labelEn?: string; items?: string[];
  /** a table (her dignities, Woolfolk's tables): its columns as [key, heading] and its rows by key; a cell's first line
      is its label when it has more than one; title: its caption (null: none; left out: the entry's title) */
  columns?: [string, string][]; rows?: Record<string, unknown>[]; title?: string | null;
  /** her sentence templates for a house */
  forms?: string[]; usage?: string;
  /** her keyword table: the sign a planet's line is written for (Sao Thủy for Song Tử and for Xử Nữ) */
  facet?: string;
}
export interface BundleEntry {
  code: string; title: string; parent: string | null; page: number | null; at: number; topic: Topic | null; symbols: string[];
  en?: string; paras: BundlePassage[];
}
export interface BundleRule {
  /** code */ i: string; /** source */ s: string; /** entry */ e: string; /** passage */ p: number; /** page */ pg: number | null;
  /** text */ t: string; /** condition */ w: string; /** kind */ k: RuleKind; /** topic */ tp: Topic; /** order */ o: number;
  /** symbols */ sy: string[]; /** voice */ v: 'hk' | 'tierney' | 'woolfolk';
  /** label */ lb?: string; /** the original (English) */ en?: string; /** list items */ it?: string[];
}
export interface AstrologyBundle {
  manifest: { discipline: 'astrology'; version: string; sources: number; entries: number; passages: number; rules: number; built: string };
  book: { books: { source: BundleSource; entries: BundleEntry[] }[] };
  rules: BundleRule[];
}
