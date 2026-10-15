/** Accent-insensitive form for search: "tu vi" finds "Tử Vi", "dao hoa" finds "Đào Hoa". */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();

/** one line, no runs of white space */
export const oneLine = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** splits a list into pieces of n (bulk inserts stay under Postgres' parameter limit) */
export function chunks<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
