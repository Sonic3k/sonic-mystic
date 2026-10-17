/* What a written Tử vi reading is made from: the scopes one can ask for, grandma's matched lines (and the added ones,
   labelled) for a scope, and the hash that tells when a stored reading no longer matches its chart. */
import {
  PALACES, chartSummary, hashOf, lineOf, principlesFor, readHan, readView,
  type BirthInput, type Chart, type Group, type ReadingLine, type View,
} from '@mystic/engine/tuvi';
import type { TuViSettings } from '@mystic/engine/api';
import type { Knowledge } from '../kb/knowledge.service.js';
import { chartOf, optionsOf } from '../tuvi/tuvi.service.js';

export const MAX_LINES = 400;
const KEY_VIEWS: View[] = ['Mệnh', 'Thân', 'Phúc Đức', 'Quan Lộc', 'Tài Bạch', 'Phu Thê'];

/** the scopes one can ask for: the overview, a palace or Thân, the hạn of a year */
export function scopeOk(scope: string): boolean {
  return scope === 'overview' || scope === 'Thân' || (PALACES as readonly string[]).includes(scope) || /^han-\d{4}$/.test(scope);
}

/** the matched lines a scope is written from — grandma's and the added ones, labelled */
export function linesFor(chart: Chart, k: Knowledge, scope: string, year: number): ReadingLine[] {
  const of = (gs: Group[], palace: string) => gs.flatMap(g => g.matches.map(m => lineOf(m, palace)));
  const principle = (id: string, palace: string): ReadingLine[] => { const p = k.kb.principles[id]; return p ? [{ ref: p.id, palace, source: 'supplement', text: `${p.title}: ${p.text}`, why: '' }] : []; };
  if (scope === 'overview') {
    return [...KEY_VIEWS.flatMap(v => { const r = readView(chart, k.kb, v, year); return [...of(r.grandma, v), ...of(r.supplement, v)]; }),
      ...principlesFor(chart, k.kb).flatMap(p => principle(p.id, 'Tổng quan'))];
  }
  const han = /^han-(\d{4})$/.exec(scope);
  if (han) {
    const h = readHan(chart, k.kb, Number(han[1]));
    const dai = h.dai ? chart.palaces[h.dai.branch].role : '', tieu = chart.palaces[h.tieu.branch].role;
    return [...(h.dai ? [...of(h.dai.grandma, `Đại hạn ${dai}`), ...of(h.dai.supplement, `Đại hạn ${dai}`)] : []),
      ...of(h.tieu.grandma, `Tiểu hạn ${tieu}`), ...of(h.tieu.supplement, `Tiểu hạn ${tieu}`), ...principle('dai_han', 'Hạn'), ...principle('tieu_han', 'Hạn')];
  }
  const v = scope as View, r = readView(chart, k.kb, v, year);
  return [...of(r.grandma, v), ...of(r.supplement, v), ...(v === 'Mệnh' ? principlesFor(chart, k.kb).flatMap(p => principle(p.id, v)) : [])];
}

/** what a reading of one scope is written from, and the hash that tells when a stored reading no longer matches */
export function tuviInput(birth: BirthInput, settings: TuViSettings, k: Knowledge, scope: string, year: number) {
  const chart = chartOf(birth, optionsOf(settings, year));
  const lines = linesFor(chart, k, scope, year).slice(0, MAX_LINES);
  return { chart, lines, hash: hashOf(`${JSON.stringify(birth)}|${JSON.stringify(settings)}|${scope}|${year}|${lines.map(l => l.ref).join(',')}`) };
}

export { chartSummary };
