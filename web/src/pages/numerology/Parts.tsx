/* The pieces of the Nhân số học room, drawn like a geometry plate on squared paper: the ruling number worked out in
   boxed digits and set in a double circle when it is a master number, the 3 × 3 chart with its arrows (an empty one
   dashed red, a full one inked, one a name makes in blue), the pyramid of the four peaks, a name letter by letter,
   the nine-year ruler. Shapes say what a number is: ○ chủ đạo, □ ngày sinh and the name's, △ the years and peaks.
   And how the book's passages and a written reading are drawn here. */
import { Link } from 'react-router';
import { ARROW_BY_CODE, TOPICS, describeWhen, label, type NumerologyChart, type Topic } from '@mystic/engine/numerology';
import type { AiSectionDto, NumerologyGroupDto, NumerologyMatchDto, NumerologyReadingDto, NumerologyRuleDto, NumerologyTocEntryDto } from '@mystic/engine/api';
import { highlight, type Ref, type RoomReading } from '../../components/Reading';
import { dmy, unitOf } from '../../lib/numerology';

export const L = (n: number | null | undefined) => label(n);
export const short = (s: string) => s.replace(/^Mũi tên /, '');
export const STAGE = ['', 'niên thiếu', 'trưởng thành', 'viên mãn'];
const ORDER = [3, 6, 9, 2, 5, 8, 1, 4, 7];
const CELL: Record<number, [number, number]> = { 3: [0, 0], 6: [0, 1], 9: [0, 2], 2: [1, 0], 5: [1, 1], 8: [1, 2], 1: [2, 0], 4: [2, 1], 7: [2, 2] };
const PLANE_NAME: Record<string, string> = { mind: 'Trí não', spirit: 'Tinh thần', physical: 'Thể chất' };
const isMaster = (n: number | null | undefined) => n === 11 || n === 22;
export const planeOf = (n: number) => { const d = n === 10 ? 1 : n === 11 ? 2 : n === 22 ? 4 : n > 9 ? n % 9 || 9 : n; return [3, 6, 9].includes(d) ? 'mind' : [2, 5, 8].includes(d) ? 'spirit' : 'physical'; };
const arrowName = (code: string, kind: 'full' | 'empty') => short((kind === 'full' ? ARROW_BY_CODE[code]?.full : ARROW_BY_CODE[code]?.empty) ?? code);

export const Tri = () => <svg viewBox="0 0 48 44" aria-hidden="true"><path className="s" d="M24 3 45 41H3Z" /></svg>;

/** the 3 × 3 chart: each number as many times as it comes, a name's in blue; empty arrows dashed red, full ones inked, new ones blue */
export function G3({ counts, arrows, empty = [], fresh = [], name = null, size, isolated = [] }: {
  counts: number[]; arrows: string[]; empty?: string[]; fresh?: string[]; name?: number[] | null; size?: number; isolated?: number[];
}) {
  const ctr = (n: number) => { const [r, c] = CELL[n]; return [((c + 0.5) / 3) * 100, ((r + 0.5) / 3) * 100]; };
  const line = (code: string, cls: string) => {
    const a = ARROW_BY_CODE[code];
    if (!a) return null;
    let [x1, y1] = ctr(a.nums[0]), [x2, y2] = ctr(a.nums[2]);
    const dx = (x2 - x1) * 0.16, dy = (y2 - y1) * 0.16;
    x1 -= dx; y1 -= dy; x2 += dx; y2 += dy;
    return <line key={`${cls}${code}`} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} vectorEffect="non-scaling-stroke" />;
  };
  return (
    <div className="g3" style={size ? { width: size, height: size } : undefined} role="img"
      aria-label={`Biểu đồ: ${ORDER.filter(n => counts[n]).map(n => `${counts[n]} số ${n}`).join(', ') || 'trống'}`}>
      {ORDER.map(n => {
        const c = counts[n] ?? 0, nm = name ? name[n] ?? 0 : 0, own = c - nm;
        if (!c) return <div key={n} className="empty">{n}</div>;
        return <div key={n} className={[c >= 4 ? 'long' : '', isolated.includes(n) ? 'iso' : ''].filter(Boolean).join(' ') || undefined}>
          <span>{String(n).repeat(Math.max(0, own))}{nm > 0 && <span className="nm">{String(n).repeat(nm)}</span>}</span></div>;
      })}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{empty.map(c => line(c, 'empty'))}{arrows.map(c => line(c, fresh.includes(c) ? 'new' : 'full'))}</svg>
    </div>
  );
}

/** the book's own figures of a chart (Book pages), in the room's drawing */
export function NumerologyGrid({ counts, add, full, empty = [], faint = [], isolated = [], cell = 74 }: {
  counts: number[]; add?: number[] | null; full: string[]; empty?: string[]; faint?: string[]; isolated?: number[]; cell?: number;
}) {
  const all = add ? counts.map((k, n) => k + (add[n] ?? 0)) : counts;
  return <G3 counts={all} arrows={full} empty={empty} fresh={faint} name={add ?? null} size={cell * 3} isolated={isolated} />;
}

const ArrowChip = ({ code, kind }: { code: string; kind: 'empty' | 'full' | 'new' }) => (
  <span className={`arw ${kind}`}><svg viewBox="0 0 18 10"><line x1="1" y1="5" x2="17" y2="5" /></svg><b>{code}</b>{kind === 'empty' ? ` trống: ${arrowName(code, 'empty')}` : ` ${arrowName(code, 'full')}`}</span>
);

// ── the plate ──

/** the digits of the date added, then added again until the book's ruling number */
export function Ruling({ c, nameIdx }: { c: NumerologyChart; nameIdx: number | null }) {
  const steps: number[] = [c.sum];
  for (let x = c.sum; x !== c.ruling && x >= 10 && steps.length < 4;) { x = String(x).split('').reduce((a, d) => a + Number(d), 0); steps.push(x); }
  const y = c.now.year, next = c.now.nextPeak, nm = nameIdx !== null ? c.names[nameIdx] : null;
  const digits = (ds: number[], sm: boolean) => ds.map((x, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className="op">+</span>}<span className={`dgt${sm ? ' sm' : ''}`}>{x}</span></span>);
  return <>
    <h3>Con số chủ đạo <small>cộng các chữ số của ngày sinh</small></h3>
    <div className="derive">
      <div className="ln1">{digits(c.digits, false)}<span className="op">=</span><span className="res">{steps[0]}</span></div>
      {steps.slice(1).map((s, k) => <div key={k} className="ln1">{digits(String(steps[k]).split('').map(Number), true)}<span className="op">=</span><span className="res">{s === 22 ? '22/4' : s}</span></div>)}
    </div>
    <div className="ruling"><div className={`big${isMaster(c.ruling) ? ' master' : ''}`}><b>{c.ruling}</b></div>
      <div className="cap"><b>Số chủ đạo {L(c.ruling)}</b><span>Trục {PLANE_NAME[planeOf(c.ruling)]}. Con số đi suốt đời, là phần chính của mọi bài đọc.</span></div></div>
    <div className="minis">
      <div className="mini"><span className="shape square">{c.birthday}</span><div><b className="l">Ngày sinh {L(c.birthday)}</b><small>sinh ngày {c.input.day}{c.birthday === c.ruling ? ', trùng chủ đạo' : ''}</small></div></div>
      <div className="mini now"><span className="shape tri"><Tri /><b>{y.n}</b></span><div><b className="l">Năm cá nhân {y.n}</b><small>{dmy(y.start)} – {dmy(y.end)}</small></div></div>
      <div className="mini">{next ? <><span className="shape tri"><Tri /><b>{next.n}</b></span><div><b className="l">Đỉnh tới: số {L(next.n)}</b><small>năm {next.year}, {next.age} tuổi</small></div></>
        : <><span className="shape tri"><Tri /><b>4</b></span><div><b className="l">Đã qua bốn đỉnh</b><small>giai đoạn {STAGE[c.now.stage]}</small></div></>}</div>
      {nm && nm.soul !== null && <div className="mini"><span className="shape square">{nm.soul}</span><div><b className="l">Linh hồn {L(nm.soul)}</b><small>nguyên âm của tên {nm.text}</small></div></div>}
    </div>
  </>;
}

export function GridFig({ c, nameIdx, mode, onMode }: { c: NumerologyChart; nameIdx: number | null; mode: 'birth' | 'name'; onMode?: (m: 'birth' | 'name') => void }) {
  const nm = nameIdx !== null ? c.names[nameIdx] ?? null : null;
  const withName = mode === 'name' && !!nm;
  const G = withName ? nm.combined : c.grid, fresh = withName ? nm.effect.newArrows : [];
  const pl = G.planes;
  return <>
    <h3>Biểu đồ ngày sinh <small>{c.grid.planes.mind} Trí não, {c.grid.planes.spirit} Tinh thần, {c.grid.planes.physical} Thể chất</small></h3>
    {nm && onMode && <div className="switch" role="group" aria-label="Biểu đồ">
      <button type="button" className={withName ? '' : 'on'} onClick={() => onMode('birth')}>Ngày sinh</button>
      <button type="button" className={withName ? 'on' : ''} onClick={() => onMode('name')}>Thêm tên {nm.text}</button></div>}
    <div className="grid3"><G3 counts={G.counts} arrows={G.arrows} empty={G.empty} fresh={fresh} name={withName ? nm.effect.added : null} isolated={G.isolated} />
      <div className="g3-rows">{(['mind', 'spirit', 'physical'] as const).map(k => <div key={k}><i className={`plane-${k}`} /><span><b>{PLANE_NAME[k]}</b><small>{pl[k]} số</small></span></div>)}</div></div>
    <div className="arrows">
      {G.empty.map(a => <ArrowChip key={`e${a}`} code={a} kind="empty" />)}
      {G.arrows.map(a => <ArrowChip key={`f${a}`} code={a} kind={fresh.includes(a) ? 'new' : 'full'} />)}
      {G.isolated.map(n => <span key={`i${n}`} className="arw iso"><b>số {n}</b> cô lập</span>)}
      {!G.empty.length && !G.arrows.length && <span className="arw">Không có mũi tên nào</span>}
    </div>
    {withName && <p className="fig-note">Số màu xanh là số do tên thêm vào.{nm.effect.filled.length ? ` Tên ${nm.text} lấp đầy ô ${nm.effect.filled.join(', ')}` : ` Tên ${nm.text} không lấp ô trống nào`}{nm.effect.broken.length ? ` và phá ${nm.effect.broken.length} mũi tên trống.` : '.'}</p>}
  </>;
}

export function PyramidFig({ c, title = true, onPeak, sel }: { c: NumerologyChart; title?: boolean; onPeak?: (i: number) => void; sel?: number | null }) {
  const py = c.pyramid, now = c.now, [m, d, y] = py.base;
  const nodes: Record<string, [number, number]> = { M: [56, 236], D: [176, 236], Y: [296, 236], 1: [116, 168], 2: [236, 168], 3: [176, 100], 4: [176, 34] };
  const pk = Object.fromEntries(py.peaks.map(p => [p.index, p]));
  const line = (a: string, b: string) => <line key={a + b} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} className="edge" />;
  const tri = (a: string, b: string, cc: string, fill: string) => <path key={a + b + cc} d={`M${nodes[a].join(' ')} L${nodes[b].join(' ')} L${nodes[cc].join(' ')}Z`} className="tri-f" fill={fill} />;
  const node = (k: string) => {
    const p = pk[Number(k)], isNow = now.lastPeak?.index === Number(k), isNext = now.nextPeak?.index === Number(k);
    const [x, yy] = nodes[k], side = k === '1' ? -1 : k === '2' ? 1 : 0;
    const lx = side ? x + side * 30 : x + 40, anchor = side < 0 ? 'end' : 'start';
    const cls = [isNow ? 'now' : '', isNext ? 'next' : '', sel === Number(k) ? 'sel' : ''].filter(Boolean).join(' ');
    return (
      <g key={k} className={onPeak ? 'pick' : undefined} onClick={onPeak ? () => onPeak(Number(k)) : undefined}>
        <circle cx={x} cy={yy} r={19} className={`node ${cls}`} /><text x={x} y={yy + 1} className={`nv${isNow ? ' now' : ''}`}>{L(p.n)}</text>
        <text x={lx} y={yy - 4} className={`lab${isNow ? ' now' : ''}`} style={{ textAnchor: anchor }}>đỉnh {k} · {p.age} tuổi</text>
        <text x={lx} y={yy + 10} className={`lab${isNow ? ' now' : ''}`} style={{ textAnchor: anchor }}>{p.year}{isNow ? ' · đang ở' : isNext ? ' · sắp tới' : ''}</text>
      </g>
    );
  };
  const base = (k: string, v: number, lab: string) => <g key={k}><rect x={nodes[k][0] - 17} y={nodes[k][1] - 17} width={34} height={34} fill="#fff" stroke="#151515" strokeWidth={1.5} /><text x={nodes[k][0]} y={nodes[k][1] + 6} className="bv">{v}</text><text x={nodes[k][0]} y={nodes[k][1] + 32} className="lab">{lab}</text></g>;
  const last = now.lastPeak, next = now.nextPeak;
  return <>
    {title && <h3>Bốn đỉnh cao <small>tháng, ngày, năm sinh</small></h3>}
    <svg viewBox="0 0 352 276" role="img" aria-label={`Kim tự tháp: ${py.peaks.map(p => `đỉnh ${p.index} số ${L(p.n)} lúc ${p.age} tuổi`).join(', ')}`}>
      {tri('1', '3', '2', '#F6E2AE')}{tri('M', '1', 'D', '#F6E0DA')}{tri('D', '2', 'Y', '#E0E8F3')}
      {line('M', 'D')}{line('D', 'Y')}{line('M', '1')}{line('1', 'D')}{line('D', '2')}{line('2', 'Y')}{line('1', '3')}{line('3', '2')}{line('3', '4')}
      {base('M', m, 'tháng')}{base('D', d, 'ngày')}{base('Y', y, 'năm')}{node('1')}{node('2')}{node('3')}{node('4')}
    </svg>
    <p className="pyr-note">{last ? `Đang ở đỉnh ${last.index} (số ${L(last.n)}, từ ${last.year})` : `Chưa tới đỉnh đầu (năm ${py.peaks[0].year})`}{next ? `; đỉnh ${next.index} mang số ${L(next.n)}, đến năm ${next.year}, lúc ${next.age} tuổi.` : '; đã qua cả bốn đỉnh.'}</p>
  </>;
}

export function NameFig({ c, nameIdx }: { c: NumerologyChart; nameIdx: number | null }) {
  const nm = nameIdx !== null ? c.names[nameIdx] : null;
  if (!nm) return <><h3>Tên</h3><p className="fig-note">Chưa có tên để đọc: thêm tên ở «Sửa tên».</p></>;
  let lastWord = -1;
  const rel = nm.relation === 'same' ? 'trùng số chủ đạo' : nm.relation === 'same_plane' ? 'cùng trục với số chủ đạo' : 'khác trục với số chủ đạo';
  return <>
    <h3>Tên {nm.text} <small>chữ cái đổi ra số; nền vàng là nguyên âm</small></h3>
    <div className="letters">
      <div className="lt">{nm.letters.map((l, i) => { const gap = lastWord >= 0 && l.word !== lastWord; lastWord = l.word; return <span key={i} style={{ display: 'contents' }}>{gap && <span className="gap" />}<span className={l.vowel ? 'v' : undefined}><i>{l.ch}</i><b>{l.n}</b></span></span>; })}</div>
      <div className="nres">
        <span><span className="shape square">{nm.soul ?? '–'}</span>Linh hồn: nguyên âm, {nm.soulSum}</span>
        <span><span className="shape square">{nm.expression ?? '–'}</span>Biểu đạt: phụ âm, {nm.expressionSum}</span>
        <span><span className="shape square">{nm.nameNumber ?? '–'}</span>Tên riêng: {rel}</span>
      </div>
    </div>
  </>;
}

export function YearsFig({ c, sel, onYear }: { c: NumerologyChart; sel: number; onYear?: (y: number | null) => void }) {
  const now = c.now, ys = c.years, cur = now.year;
  let start = ys.findIndex(y => y.n === 1 && y.year <= cur.year && y.year >= cur.year - 8);
  if (start < 0) start = Math.max(0, ys.findIndex(y => y.year === cur.year) - 4);
  const cycle = ys.slice(start, start + 9);
  const peakYears = new Set(c.pyramid.peaks.map(p => p.year));
  return <>
    <h3>Năm cá nhân <small>chu kỳ 9 năm, năm cá nhân tính từ sinh nhật năm trước</small></h3>
    <div className="ruler"><div className="ruler-row">{cycle.map(y => {
      const cls = [y.year === cur.year ? 'now' : y.year < cur.year ? 'past' : '', peakYears.has(y.year) ? 'peak' : '', y.year === sel && y.year !== cur.year ? 'sel' : ''].filter(Boolean).join(' ');
      return onYear
        ? <button key={y.year} type="button" className={cls || undefined} aria-pressed={y.year === sel} onClick={() => onYear(y.year === cur.year ? null : y.year)} title={`${dmy(y.start)} – ${dmy(y.end)}`}><b>{y.n}</b><small>{y.year}</small></button>
        : <div key={y.year} className={cls || undefined}><b>{y.n}</b><small>{y.year}</small></div>;
    })}</div>
      <div className="ruler-note"><span><i style={{ background: 'var(--red)' }} />Năm cá nhân {cur.n}: {dmy(cur.start)} – {dmy(cur.end)}</span>
        {now.transition && <span>Đang chuyển từ năm {now.transition.from} sang năm {now.transition.to}, đến {dmy(now.transition.until)}</span>}
        <span><i style={{ background: 'var(--yel)', clipPath: 'polygon(50% 0,100% 100%,0 100%)' }} />năm có đỉnh cao</span></div></div>
  </>;
}

// ── a written reading in this room ──

export function numHighlighter() {
  return (text: string) => highlight(text, [
    { re: /(?<![\p{L}\d-])(\d-\d-\d)(?![\d-])/gu, draw: (m, k) => <span key={k} className="e-arw">{m}</span>, once: false },
    { re: /(?<![\p{L}])((?:[Ss]ố|[Nn]ăm cá nhân|[Đđ]ỉnh(?: thứ)?)\s\d{1,2})(?!\d)/gu, draw: (m, k) => <span key={k} className="e-n">{m}</span>, once: false },
  ]);
}

/** what a section of a reading is about, from its title: its figure, and its number */
export function nsParse(s: AiSectionDto, c: NumerologyChart, primary: number | null) {
  const t = s.title;
  let m: RegExpExecArray | null;
  if ((m = /Con số chủ đạo (\d+)/.exec(t))) return { kind: 'circle', n: +m[1], topic: 'ruling' } as const;
  if ((m = /Con số ngày sinh (\d+)/.exec(t))) return { kind: 'square', n: +m[1], topic: 'birthday' } as const;
  if (/Biểu đồ/.test(t)) return { kind: 'grid', n: 0, topic: 'grid' } as const;
  if (/mũi tên/i.test(t) && !/^Tên/.test(t)) return { kind: 'arrow', n: 0, topic: 'arrows' } as const;
  if (/^Tên /.test(t)) return { kind: 'square', n: (primary !== null ? c.names[primary]?.nameNumber : null) ?? 0, topic: 'name' } as const;
  if ((m = /năm cá nhân (\d+)/.exec(t))) return { kind: 'tri', n: +m[1], topic: 'time' } as const;
  if (/Luận thêm/.test(t)) return { kind: 'add', n: 0, topic: 'added' } as const;
  return { kind: 'square', n: 0, topic: '' } as const;
}

export function NsEmblem({ s, c, primary }: { s: AiSectionDto; c: NumerologyChart; primary: number | null }) {
  const p = nsParse(s, c, primary);
  if (p.kind === 'circle') return <span className={`ns-em circle${isMaster(p.n) ? ' master' : ''}`}><b>{p.n}</b></span>;
  if (p.kind === 'square') return <span className="ns-em square"><b>{p.n || ''}</b></span>;
  if (p.kind === 'tri') return <span className="ns-em tri"><Tri /><b>{p.n}</b></span>;
  if (p.kind === 'grid') return <span className="ns-em"><svg viewBox="0 0 50 50" aria-hidden="true"><rect className="s" x="6" y="6" width="38" height="38" /><path className="s" d="M18.7 6v38M31.3 6v38M6 18.7h38M6 31.3h38" /></svg></span>;
  if (p.kind === 'arrow') return <span className="ns-em"><svg viewBox="0 0 50 50" aria-hidden="true"><rect className="s" x="6" y="6" width="38" height="38" /><path d="M10 10 40 40" stroke="var(--red)" strokeWidth="2.4" strokeDasharray="5 4" fill="none" /></svg></span>;
  return <span className="ns-em add"><svg viewBox="0 0 50 50" aria-hidden="true"><circle className="s" cx="25" cy="25" r="18" /><path className="s" d="M25 16v18M16 25h18" /></svg></span>;
}

export function numRoom(r: NumerologyReadingDto, hl: (t: string) => React.ReactNode, who: string, primary: number | null, goTo: (code: string) => void): RoomReading {
  return {
    hl,
    emblem: s => <NsEmblem s={s} c={r.chart} primary={primary} />,
    srcLabel: refs => { const pages = [...new Set(refs.map(x => r.rules[x.code]?.page).filter((p): p is number => p != null))].sort((a, b) => a - b); return `${refs.length} đoạn sách${pages.length ? `, tr. ${pages.join(', ')}` : ''}`; },
    srcList: (refs: Ref[]) => refs.map(x => {
      const rule = r.rules[x.code];
      return <blockquote key={x.code}>{rule?.text ?? x.quoted}<cite>Sách{rule?.page != null ? `, trang ${rule.page}` : ''}{rule ? <button type="button" onClick={() => goTo(x.code)}>xem trong bài đọc theo sách ›</button> : ' · đoạn này không có trong bài đọc đang xem'}</cite></blockquote>;
    }),
    added: <><span style={{ fontWeight: 700 }}>+</span> Luận thêm của {who}, không phải lời sách</>,
  };
}

export function NsCompanion({ r, s, primary }: { r: NumerologyReadingDto; s: AiSectionDto | undefined; primary: number | null }) {
  const c = r.chart, p = s ? nsParse(s, c, primary) : { topic: 'ruling' };
  const nm = primary !== null ? c.names[primary] : null;
  if (p.topic === 'grid' || p.topic === 'arrows') return (
    <div className="cmp-card"><h4>Biểu đồ ngày sinh</h4><div className="cmp-fig"><G3 counts={c.grid.counts} arrows={c.grid.arrows} empty={c.grid.empty} size={200} isolated={c.grid.isolated} />
      <div className="arrows">{c.grid.empty.map(a => <ArrowChip key={a} code={a} kind="empty" />)}{c.grid.arrows.map(a => <ArrowChip key={a} code={a} kind="full" />)}</div></div></div>
  );
  if (p.topic === 'name' && nm) return (
    <div className="cmp-card"><h4>Thêm tên {nm.text}</h4><div className="cmp-fig"><G3 counts={nm.combined.counts} arrows={nm.combined.arrows} empty={nm.combined.empty} fresh={nm.effect.newArrows} name={nm.effect.added} size={200} /></div></div>
  );
  if (p.topic === 'time') return <div className="cmp-card pyr"><h4>Bốn đỉnh cao</h4><PyramidFig c={c} title={false} /></div>;
  return (
    <div className="cmp-card"><h4>Các số chính</h4><div className="minis one">
      <div className="mini"><span className={`shape circle${isMaster(c.ruling) ? ' master' : ''}`}>{c.ruling}</span><div><b className="l">Chủ đạo {L(c.ruling)}</b><small>{c.digits.join(' + ')} = {c.sum}</small></div></div>
      <div className="mini"><span className="shape square">{c.birthday}</span><div><b className="l">Ngày sinh {L(c.birthday)}</b></div></div>
      <div className="mini now"><span className="shape tri"><Tri /><b>{c.now.year.n}</b></span><div><b className="l">Năm cá nhân {c.now.year.n}</b><small>đến {dmy(c.now.year.end)}</small></div></div>
    </div></div>
  );
}

// ── the book's passages, as read for the person ──

/** a part's passages split: what the book says of the person, and the book's own explanation of the part */
export function splitGroups(groups: NumerologyGroupDto[], rules: Record<string, NumerologyRuleDto>) {
  const isGeneral = (m: NumerologyMatchDto) => rules[m.rule]?.kind === 'general';
  return {
    said: groups.map(g => ({ ...g, matches: g.matches.filter(m => !isGeneral(m)) })).filter(g => g.matches.length),
    general: groups.flatMap(g => g.matches.filter(isGeneral)),
  };
}

/** one block of the book: a part's explanation, then each passage that matched with its heading and its page */
export function BookBlock({ id, emblem, title, sub, groups, rules, toc, hl, focus, topic, children }: {
  id?: string; emblem?: React.ReactNode; title: string; sub?: string; groups: NumerologyGroupDto[]; rules: Record<string, NumerologyRuleDto>;
  toc?: NumerologyTocEntryDto[]; hl: (t: string) => React.ReactNode; focus: string | null; topic?: Topic; children?: React.ReactNode;
}) {
  const { said, general } = splitGroups(groups, rules);
  const t = topic ? TOPICS.find(x => x.code === topic) : undefined;
  const n = said.reduce((k, g) => k + g.matches.length, 0);
  return (
    <section className="bkn" id={id}>
      <div className="bkn-h">{emblem}<h3>{title}</h3><span>{sub ? `${sub} · ` : ''}{n} đoạn</span>
        {t && <Link className="bkn-part" to={`/numerology/books/p${t.part}`}>Phần {t.part} trong sách ›</Link>}</div>
      <div className="bkn-g">
        {children}
        {general.length > 0 && <div className="bkn-x"><h4>Sách giải thích</h4>{general.map(m => <p key={m.rule}>{rules[m.rule]?.text}</p>)}</div>}
        {said.flatMap(g => g.matches.map(m => {
          const r = rules[m.rule];
          if (!r) return null;
          const why = (m.why.length ? m.why : [describeWhen(r.when)]).join(' · ');
          const head = g.path.slice(1).join(' · ') || g.title;
          return (
            <div key={m.rule} className={`bkn-e${focus === m.rule ? ' hl' : ''}`} id={`r-${r.code}`}>
              <h4>{head}</h4>
              <p>{r.kind === 'advice' && <><span className="adv">Lời khuyên</span><br /></>}{r.kind === 'child' && <><span className="adv kid">Với trẻ nhỏ</span><br /></>}{hl(r.text)}</p>
              {r.page !== null ? <Link className="pg" to={`/numerology/books/${unitOf(r.entry, toc)}?rule=${encodeURIComponent(r.code)}`} title="Đọc trong sách">tr. {r.page}</Link> : <span className="pg" />}
              {why && why !== head && why !== g.title && <div className="why">{why}</div>}
            </div>
          );
        }))}
        {!n && !general.length && <p className="bkn-none">Sách không có đoạn nào khớp ở phần này.</p>}
      </div>
    </section>
  );
}
