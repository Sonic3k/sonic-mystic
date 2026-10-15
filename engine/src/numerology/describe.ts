/* A condition of the book in words — what a reader sees under a passage of the book: "Con số chủ đạo 9",
   "Hai số 1 · Mũi tên Thực tế", "Năm cá nhân 7". */
import { parse, type Node } from './dsl.js';
import { ARROW_BY_CODE, PLANES, findArrow, label, parseNumber } from './numbers.js';

const COUNT = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const STAGE = ['', 'niên thiếu', 'trưởng thành', 'viên mãn'];
const PLANE_NAME: Record<string, string> = Object.fromEntries(PLANES.map(p => [p.code, p.name.replace(/^Trục ngang /, '')]));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function spec(s: string): [number, number] {
  const t = s.trim();
  let m = /^(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[1])];
  m = /^(\d+)\+$/.exec(t); if (m) return [Number(m[1]), Infinity];
  m = /^(\d+)-(\d+)$/.exec(t); return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}
const word = (n: number) => COUNT[n] ?? String(n);
const many = ([lo, hi]: [number, number]) => (hi === lo ? word(lo) : hi === Infinity ? `từ ${word(lo)}` : `${word(lo)} đến ${word(hi)}`);
const nums = (a: string[]) => a.map(x => label(parseNumber(x))).join(' hoặc ');
const arrow = (code: string) => ARROW_BY_CODE[findArrow(code)?.code ?? ''];

function call(fn: string, a: string[]): string {
  switch (fn) {
    case 'ruling': return `Con số chủ đạo ${nums(a)}`;
    case 'day': return `Con số ngày sinh ${nums(a)}`;
    case 'day_is_ruling': return 'Con số ngày sinh trùng Con số chủ đạo';
    case 'count': { const s = spec(a[1]); return s[0] === 0 && s[1] === 0 ? `Không có số ${a[0]}` : cap(`${many(s)} số ${a[0].trim()}`); }
    case 'has': return `Có số ${a.join(', ')}`;
    case 'lacks': return `Không có số ${a.join(', ')}`;
    case 'arrow': return arrow(a[0])?.full ?? a[0];
    case 'empty': return arrow(a[0])?.empty ?? a[0];
    case 'double': return `${arrow(a[0])?.full ?? a[0]} kép`;
    case 'isolated': return `Số ${a[0].trim()} bị cô lập`;
    case 'arrows': { const s = spec(a[0]); return s[0] === 0 && s[1] === 0 ? 'Không có mũi tên nào' : cap(`${many(s)} mũi tên`); }
    case 'empties': { const s = spec(a[0]); return s[0] === 0 && s[1] === 0 ? 'Không có mũi tên trống' : cap(`${many(s)} mũi tên trống`); }
    case 'plane': return `Trục ${PLANE_NAME[a[0].trim()] ?? a[0]} có ${many(spec(a[1]))} số`;
    case 'pyear': return `Năm cá nhân ${nums(a)}`;
    case 'stage': return `Giai đoạn ${a.map(x => STAGE[Number(x)] ?? x).join(' hoặc ')}`;
    case 'peak': return `Đỉnh cao mang số ${nums(a)}`;
    case 'peak_at': return `Đỉnh thứ ${a[0].trim()} mang số ${nums(a.slice(1))}`;
    case 'soul': return `Con số linh hồn ${nums(a)}`;
    case 'expression': return `Con số biểu đạt ${nums(a)}`;
    case 'name_number': return `Con số tên riêng ${nums(a)}`;
    case 'name_is_ruling': return 'Tên riêng trùng Con số chủ đạo';
    case 'name_same_plane': return 'Tên riêng cùng trục với Con số chủ đạo';
    case 'name_other_plane': return 'Tên riêng khác trục với Con số chủ đạo';
    case 'name_compensates': return 'Tên bù đắp cho Biểu đồ ngày sinh';
    case 'name_reinforces': return 'Tên dồn thêm vào Biểu đồ ngày sinh';
    case 'name_breaks': return `Tên phá thế ${arrow(a[0])?.empty ?? a[0]}`;
    case 'name_has': return `Tên có số ${a.join(', ')}`;
    case 'male': return 'Nam';
    case 'female': return 'Nữ';
    case 'any': return 'Ai cũng vậy';
  }
  return fn;
}

function walk(n: Node, top: boolean): string {
  if (n.t === 'call') return call(n.fn, n.args);
  if (n.t === 'not') return `không phải: ${walk(n.a, false)}`;
  const s = n.a.map(x => walk(x, false)).join(n.t === 'and' ? ' · ' : ' hoặc ');
  return top || n.t === 'and' ? s : `(${s})`;
}

/** a condition of the book in words (the condition itself when it does not parse) */
export function describeWhen(when: string): string {
  const p = parse(when);
  return p.node ? walk(p.node, true) : when;
}
