/* The links of before the names in the code became English (/nguoi/…, /tu-vi/la-so?ngay=…, /nhan-so-hoc/sach/…,
   ?xem=tong…) keep working: each is sent once to the address it has now. Sonic Hub's briefs, bookmarks and links
   sent earlier still hold them. */

/** a parameter as it is named now, its value too when that changed */
type Rename = (v: string) => [string, string];
const as = (key: string, values?: Record<string, string>): Rename => v => [key, values?.[v] ?? v];

const GENDER = { nam: 'male', nu: 'female' };
const TOPIC = { chu_dao: 'ruling', ngay_sinh: 'birthday', bieu_do: 'grid', mui_ten: 'arrows', ten: 'name', dinh: 'peaks', giai_doan: 'stages', nam: 'year' };
const SYMBOL: Record<string, string> = {
  'chu-dao': 'ruling', 'ngay-sinh': 'birthday', so: 'digit', muiten: 'arrow', 'muiten-trong': 'empty-arrow', nam: 'year', dinh: 'peak',
  'linh-hon': 'soul', 'bieu-dat': 'expression', 'ten-rieng': 'name-number', 'giai-doan': 'stage',
};

/** a Tử vi chart: the birth and the settings (a link), what is looked at (a link or a profile) */
const TUVI: Record<string, Rename> = {
  n: as('name'), g: as('gender', GENDER), c: as('calendar', { d: 'solar', a: 'lunar' }), ngay: as('date'), gio: as('time'), nhuan: as('leap'),
  noi: as('place'), mui: as('utc'), an: as('variant', { ba: 'grandma', sach: 'books' }), thangnhuan: as('leapmonth', { 15: 'split15' }),
  ty: as('ty', { 'cung-ngay': 'same-day' }), lich: as('lunar', { 7: 'utc7', 8: 'utc8' }), 'gio-mat-troi': as('solartime'), nam: as('year'),
  xem: as('view', { tong: 'overview' }), nguoi: as('person'),
};
const NUMEROLOGY: Record<string, Rename> = {
  n: as('name'), ngay: as('date'), c: as('calendar', { d: 'solar', a: 'lunar' }), nhuan: as('leap'), g: as('gender', GENDER),
  ten: as('names'), chinh: as('primary'), nam: as('year'),
  xem: as('view', { tong: 'synthesis', tinh: 'traits', van: 'time' }), phan: as('part', TOPIC), dinh: as('peak'), bd: as('board', { ten: 'name' }),
  nguoi: as('person'),
};
/** a saved profile's ?ten= is the name it is read by, not the list of names */
const NUMEROLOGY_PROFILE: Record<string, Rename> = { ...NUMEROLOGY, ten: as('name') };
const ASTROLOGY: Record<string, Rename> = {
  n: as('name'), ngay: as('date'), gio: as('time'), uoc: as('approx'), noi: as('place'), g: as('gender', GENDER),
  xem: as('view', { tong: 'synthesis', luan: 'reading', laso: 'chart' }), phan: as('part'), muc: as('item'), nguoi: as('person'),
};
const BOOK: Record<string, Rename> = { cau: as('rule'), doan: as('passage') };
const NUMEROLOGY_LOOKUP: Record<string, Rename> = {
  so: v => { const i = v.indexOf(':'); return ['symbol', i < 0 ? v : `${SYMBOL[v.slice(0, i)] ?? v.slice(0, i)}${v.slice(i)}`]; },
};
const ASTROLOGY_LOOKUP: Record<string, Rename> = { sao: as('body'), dh: as('sign'), cung: as('house'), goc: as('aspect'), ct: as('pattern') };

interface Moved {
  path: string; params?: Record<string, Rename>; hash?: Record<string, string>;
  /** a book's section, whose code may have changed with the rest: the book ('numerology' or a source of chiêm tinh)
      and the old code */
  section?: [string, string];
}
type Route = [RegExp, (m: RegExpExecArray) => Moved];
const ROUTES: Route[] = [
  [/^\/nguoi$/, () => ({ path: '/people' })],
  [/^\/nguoi\/([^/]+)$/, m => ({ path: `/people/${m[1]}` })],
  [/^\/tu-vi\/la-so$/, () => ({ path: '/tu-vi/chart', params: TUVI })],
  [/^\/tu-vi\/sach$/, () => ({ path: '/tu-vi/books' })],
  [/^\/tu-vi\/sach\/([^/]+)$/, m => ({ path: `/tu-vi/books/${m[1]}` })],
  [/^\/tu-vi\/tra-cuu$/, () => ({ path: '/tu-vi/lookup' })],
  [/^\/tu-vi\/phan-1$/, () => ({ path: '/tu-vi/setup', hash: { '#mo-dau': '#preface', '#khac': '#differences' } })],
  [/^\/nhan-so-hoc$/, () => ({ path: '/numerology', params: NUMEROLOGY, hash: { '#da-luu': '#saved' } })],
  [/^\/nhan-so-hoc\/xem$/, () => ({ path: '/numerology/view', params: NUMEROLOGY })],
  [/^\/nhan-so-hoc\/profile\/([^/]+)$/, m => ({ path: `/numerology/profile/${m[1]}`, params: NUMEROLOGY_PROFILE })],
  [/^\/nhan-so-hoc\/sach$/, () => ({ path: '/numerology/books' })],
  [/^\/nhan-so-hoc\/sach\/([^/]+)$/, m => ({ path: '/numerology/books', params: BOOK, section: ['numerology', m[1]] })],
  [/^\/nhan-so-hoc\/tra-cuu$/, () => ({ path: '/numerology/lookup', params: NUMEROLOGY_LOOKUP })],
  [/^\/chiem-tinh$/, () => ({ path: '/astrology', params: ASTROLOGY, hash: { '#da-luu': '#saved' } })],
  [/^\/chiem-tinh\/xem$/, () => ({ path: '/astrology/view', params: ASTROLOGY })],
  [/^\/chiem-tinh\/profile\/([^/]+)$/, m => ({ path: `/astrology/profile/${m[1]}`, params: ASTROLOGY })],
  [/^\/chiem-tinh\/sach$/, () => ({ path: '/astrology/books' })],
  [/^\/chiem-tinh\/sach\/([^/]+)\/([^/]+)$/, m => ({ path: `/astrology/books/${m[1]}`, params: BOOK, section: [m[1], m[2]] })],
  [/^\/chiem-tinh\/tra-cuu$/, () => ({ path: '/astrology/lookup', params: ASTROLOGY_LOOKUP })],
];
/** the pages whose address did not change, whose parameters did: a Tử vi chart set up again or a profile */
const SAME: [RegExp, Record<string, Rename>][] = [[/^\/tu-vi$/, TUVI], [/^\/tu-vi\/profile\/[^/]+$/, TUVI]];

function moved(path: string, search: string): Moved | null {
  for (const [re, to] of ROUTES) { const m = re.exec(path); if (m) return to(m); }
  const sp = new URLSearchParams(search);
  for (const [re, params] of SAME) {
    if (!re.test(path)) continue;
    const old = [...sp.keys()].some(k => k in params && k !== 'ty') || sp.get('ty') === 'cung-ngay';
    return old ? { path, params } : null;
  }
  return null;
}

/** whether an address is one of the old ones */
export const isLegacy = (path: string, search: string): boolean => moved(path, search) !== null;

/** the address an old link has now */
export async function legacyUrl(path: string, search: string, hash: string): Promise<string> {
  const m = moved(path, search);
  if (!m) return path + search + hash;
  let to = m.path;
  if (m.section) {
    const [book, code] = m.section;
    const old = decodeURIComponent(code);
    const codes = await import('./legacy-codes');
    const now = (book === 'numerology' ? codes.NUMEROLOGY : codes.ASTROLOGY[book])?.[old];
    to += `/${encodeURIComponent(now ?? old)}`;
  }
  const out = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(search)) {
    const [k2, v2] = m.params?.[k]?.(v) ?? [k, v];
    out.append(k2, v2);
  }
  const q = out.toString();
  return `${to}${q ? `?${q}` : ''}${m.hash?.[hash] ?? hash}`;
}
