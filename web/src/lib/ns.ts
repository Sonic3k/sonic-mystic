/* Nhân số học as a link: a birth date and the names read live in the URL, so a reading can be opened again,
   bookmarked or sent; and the small helpers every numerology page shares. */
import { nameVariants } from '@mystic/engine/numerology';
import type { Gender, NumerologyBirthDto, NumerologyNameDto, NumerologyRequest, NumerologyTocEntryDto } from '@mystic/engine/api';

export interface NsParams {
  /** the person's full name, as typed (the names read come from it unless edited) */
  full: string;
  birth: NumerologyBirthDto & { leapMonth: boolean };
  gender: Gender | null;
  names: NumerologyNameDto[];
  /** the calendar year whose personal year is read (null: the one lived today) */
  viewYear: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** the names a full name is read by: the given name first (what people are called by), then the fuller forms */
export function defaultNames(full: string): NumerologyNameDto[] {
  return nameVariants(full).map((v, i) => ({ label: v.label, text: v.text, primary: i === 0 }));
}

/** exactly one primary name */
export function withPrimary(names: NumerologyNameDto[], i: number): NumerologyNameDto[] {
  return names.map((n, k) => ({ ...n, primary: k === i }));
}

export function toNsSearch(p: NsParams): string {
  const s = new URLSearchParams();
  if (p.full) s.set('n', p.full);
  s.set('ngay', `${p.birth.year}-${pad(p.birth.month)}-${pad(p.birth.day)}`);
  if (p.birth.calendar === 'lunar') { s.set('c', 'a'); if (p.birth.leapMonth) s.set('nhuan', '1'); }
  if (p.gender) s.set('g', p.gender === 'female' ? 'nu' : 'nam');
  const auto = defaultNames(p.full);
  const same = auto.length === p.names.length && auto.every((n, i) => n.text === p.names[i].text && n.label === p.names[i].label);
  if (!same) for (const n of p.names) s.append('ten', `${n.label ?? ''}:${n.text}`);
  const pi = p.names.findIndex(n => n.primary);
  if (pi > 0) s.set('chinh', String(pi));
  if (p.viewYear) s.set('nam', String(p.viewYear));
  return s.toString();
}

export function fromNsSearch(sp: URLSearchParams): NsParams | null {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(sp.get('ngay') ?? '');
  if (!d) return null;
  const full = sp.get('n') ?? '';
  const listed = sp.getAll('ten').map(t => { const i = t.indexOf(':'); return i < 0 ? { label: null, text: t.trim(), primary: false } : { label: t.slice(0, i).trim() || null, text: t.slice(i + 1).trim(), primary: false }; }).filter(n => n.text);
  const names = listed.length ? listed : defaultNames(full);
  const pi = Math.min(Math.max(0, Number(sp.get('chinh')) || 0), Math.max(0, names.length - 1));
  const nam = Number(sp.get('nam'));
  return {
    full,
    birth: { calendar: sp.get('c') === 'a' ? 'lunar' : 'solar', year: +d[1], month: +d[2], day: +d[3], leapMonth: sp.get('nhuan') === '1', latitude: null },
    gender: sp.get('g') === 'nu' ? 'female' : sp.get('g') === 'nam' ? 'male' : null,
    names: withPrimary(names, pi),
    viewYear: Number.isInteger(nam) && nam > 1800 ? nam : null,
  };
}

export const nsRequest = (p: NsParams): NumerologyRequest => ({ birth: p.birth, gender: p.gender, names: p.names, ...(p.viewYear ? { viewYear: p.viewYear } : {}) });

/** how the sum of the digits comes down to the ruling number: 27 → 9, 29 → 11, 22 → 22/4 */
export function chainOf(sum: number, label: (n: number) => string): string {
  const out = [sum];
  for (let x = sum; !(x >= 2 && x <= 11) && x !== 22 && x >= 10;) { x = String(x).split('').reduce((a, c) => a + Number(c), 0); out.push(x); }
  return out.map((x, i) => (i === out.length - 1 ? label(x) : String(x))).join(' → ');
}

export const dmy = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${y}`; };
export const dmShort = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${String(y).slice(2)}`; };

/**
 * The page of the book a passage is read on: the highest section above it that is short enough to read whole
 * (Con số chủ đạo 9, Số 1 trong biểu đồ, Mũi tên Quyết tâm…), never a whole part.
 */
export function unitOf(code: string, toc: NumerologyTocEntryDto[] | undefined): string {
  if (!toc) return code;
  const by = new Map(toc.map(e => [e.code, e]));
  const size = new Map<string, number>();
  for (const e of [...toc].reverse()) {
    size.set(e.code, (size.get(e.code) ?? 0) + e.passages);
    if (e.parent) size.set(e.parent, (size.get(e.parent) ?? 0) + (size.get(e.code) ?? 0));
  }
  const path: string[] = [];
  for (let c: string | null = code; c; c = by.get(c)?.parent ?? null) path.unshift(c);
  return path.find((c, i) => i >= 1 && (size.get(c) ?? 0) <= 60) ?? path[Math.min(1, path.length - 1)] ?? code;
}

/** "Lê Đỗ Quỳnh Hương" sinh 1/5/1974 → the request of the book's own example */
export const SAMPLE: NsParams = {
  full: 'Lê Đỗ Quỳnh Hương',
  birth: { calendar: 'solar', year: 1974, month: 5, day: 1, leapMonth: false, latitude: null },
  gender: 'female',
  names: [
    { label: 'Tên gọi', text: 'Quỳnh', primary: true },
    { label: 'Tên đệm và tên', text: 'Quỳnh Hương', primary: false },
    { label: 'Họ tên đầy đủ', text: 'Lê Đỗ Quỳnh Hương', primary: false },
  ],
  viewYear: null,
};
