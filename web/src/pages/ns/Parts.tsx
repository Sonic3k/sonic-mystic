/* The pieces every Nhân số học page shares: the birth chart with its arrows, the pyramid of the four peaks, a life on
   one line, the board of numbers, and the book's passages as read for a person. */
import { useId } from 'react';
import { Link } from 'react-router';
import { ARROW_BY_CODE, TOPICS, describeWhen, label, type NumerologyChart, type Topic } from '@mystic/engine/numerology';
import type { NumerologyGroupDto, NumerologyMatchDto, NumerologyRuleDto, NumerologyTocEntryDto } from '@mystic/engine/api';
import { chainOf, dmy, unitOf } from '../../lib/ns';

const ROWS = [[3, 6, 9], [2, 5, 8], [1, 4, 7]];
const PLANE: Record<string, string> = { tri_nao: 'Trí não', tinh_than: 'Tinh thần', the_chat: 'Thể chất' };
export const L = (n: number | null | undefined) => label(n);
export const short = (s: string) => s.replace(/^Mũi tên /, '');

/** the 3 × 3 chart (3 6 9 / 2 5 8 / 1 4 7): full arrows drawn through, empty ones dashed, a name's numbers in ink */
export function NsGrid({ counts, add, full, empty = [], faint = [], isolated = [], cell = 74 }: {
  counts: number[]; add?: number[] | null; full: string[]; empty?: string[]; faint?: string[]; isolated?: number[]; cell?: number;
}) {
  const id = useId().replace(/:/g, '');
  const size = cell * 3 + 2;
  const pos = (n: number): [number, number] => { for (let r = 0; r < 3; r++) { const c = ROWS[r].indexOf(n); if (c >= 0) return [c * (cell + 1) + cell / 2, r * (cell + 1) + cell / 2]; } return [0, 0]; };
  const line = (code: string, kind: 'full' | 'faint' | 'empty') => {
    const a = ARROW_BY_CODE[code];
    if (!a) return null;
    const [x1, y1] = pos(a.nums[0]), [x2, y2] = pos(a.nums[2]);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len, ext = cell * .38;
    const style = kind === 'empty' ? { stroke: '#8E8A80', strokeWidth: 2, strokeDasharray: '5 6', opacity: .8 }
      : kind === 'faint' ? { stroke: '#5B3F8F', strokeWidth: 3, strokeDasharray: '2 7', opacity: .26 }
        : { stroke: '#5B3F8F', strokeWidth: 3, opacity: .42 };
    return <line key={`${kind}${code}`} x1={x1 - ux * ext} y1={y1 - uy * ext} x2={x2 + ux * ext} y2={y2 + uy * ext} strokeLinecap="round" {...style} markerEnd={kind === 'full' ? `url(#ah${id})` : undefined} />;
  };
  return (
    <div className="ns-grid" style={{ ['--cell' as string]: `${cell}px` }}>
      {ROWS.flat().map(n => {
        const k = counts[n] ?? 0, a = add ? add[n] ?? 0 : 0;
        if (!k && !a) return <div key={n} className="ns-cell none" aria-label={`không có số ${n}`}>{n}</div>;
        return <div key={n} className={`ns-cell${isolated.includes(n) ? ' iso' : ''}${k + a >= 4 ? ' long' : ''}`} aria-label={`${k + a} số ${n}`}><span>{String(n).repeat(k)}{a > 0 && <span className="nm">{String(n).repeat(a)}</span>}</span></div>;
      })}
      <svg className="ns-arrows" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs><marker id={`ah${id}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5B3F8F" /></marker></defs>
        {empty.map(c => line(c, 'empty'))}
        {full.map(c => line(c, faint.includes(c) ? 'faint' : 'full'))}
      </svg>
    </div>
  );
}

/** the book's pyramid: two small triangles in a larger one, all inside the outer triangle of the fourth peak */
export function Pyramid({ c }: { c: NumerologyChart }) {
  const [m, d, y] = c.pyramid.base, P = c.pyramid.peaks, now = c.now.age, next = c.now.nextPeak?.index;
  const pt: Record<string, [number, number]> = { M: [40, 214], D: [170, 214], Y: [300, 214], p1: [105, 150], p2: [235, 150], p3: [170, 86], p4: [170, 30] };
  const ln = (a: string, b: string) => <line x1={pt[a][0]} y1={pt[a][1]} x2={pt[b][0]} y2={pt[b][1]} />;
  const peak = (k: string, i: number, side: 'l' | 'r') => {
    const p = P[i], [x, yy] = pt[k], passed = p.age <= now, isNext = next === p.index;
    return (
      <g key={k}>
        <circle cx={x} cy={yy} r={16} fill={isNext ? '#5B3F8F' : passed ? '#1D1C1A' : '#FFFDF8'} stroke={isNext ? '#5B3F8F' : '#1D1C1A'} strokeWidth={1.5} />
        <text x={x} y={yy + 5.5} textAnchor="middle" fontFamily="Literata, Georgia, serif" fontSize={16} fontWeight={600} fill={isNext || passed ? '#FFFFFF' : '#1D1C1A'}>{L(p.n)}</text>
        <text x={side === 'l' ? x - 24 : x + 24} y={yy + 4} textAnchor={side === 'l' ? 'end' : 'start'} fontSize={11.5} fill="#57544D">{p.age}t · {p.year}</text>
      </g>
    );
  };
  const base = (k: string, n: number, t: string) => (
    <g key={k}><rect x={pt[k][0] - 16} y={204} width={32} height={20} fill="#FFFDF8" />
      <text x={pt[k][0]} y={pt[k][1] + 5} textAnchor="middle" fontFamily="Literata, Georgia, serif" fontSize={15} fontWeight={600} fill="#1D1C1A">{n}</text>
      <text x={pt[k][0]} y={pt[k][1] + 22} textAnchor="middle" fontSize={10.5} fill="#8E8A80">{t}</text></g>
  );
  return (
    <svg viewBox="0 0 340 250" role="img" aria-label={`Kim tự tháp: ${P.map(p => `đỉnh ${p.index} số ${L(p.n)} lúc ${p.age} tuổi`).join(', ')}`}>
      <g stroke="#CFC3AE" strokeWidth={1.5} fill="none">{ln('M', 'p4')}{ln('Y', 'p4')}{ln('M', 'p3')}{ln('Y', 'p3')}{ln('D', 'p1')}{ln('D', 'p2')}<line x1={40} y1={214} x2={300} y2={214} /></g>
      {base('M', m, 'tháng')}{base('D', d, 'ngày')}{base('Y', y, 'năm')}
      {peak('p1', 0, 'l')}{peak('p2', 1, 'r')}{peak('p3', 2, 'r')}{peak('p4', 3, 'r')}
    </svg>
  );
}

/** the three stages and four peaks on one line, with where the person is now (a narrower drawing on a phone) */
export function LifeLine({ c }: { c: NumerologyChart }) {
  const P = c.pyramid.peaks, now = c.now, span = Math.max(80, P[3].age + 22);
  const stages: [number, number, string][] = [[0, P[0].age, 'Niên thiếu'], [P[0].age, P[3].age, 'Trưởng thành'], [P[3].age, span, 'Viên mãn']];
  const fillOf = (p: typeof P[number]) => (now.nextPeak?.index === p.index ? '#5B3F8F' : p.age <= now.age ? '#1D1C1A' : '#FFFDF8');
  const inkOf = (p: typeof P[number]) => (now.nextPeak?.index === p.index || p.age <= now.age ? '#FFFFFF' : '#1D1C1A');
  const draw = (w: number, x0: number, scale: number, small: boolean) => {
    const X = (a: number) => x0 + (a / span) * scale;
    return (
      <svg className={small ? 'sm' : 'lg'} viewBox={`0 0 ${w} ${small ? 150 : 124}`} role="img" aria-label={`Ba giai đoạn và bốn đỉnh cao của đời người; bây giờ ${now.age} tuổi`}>
        {stages.map(([a, b, t], i) => (
          <g key={t}><rect x={X(a)} y={46} width={X(b) - X(a)} height={small ? 16 : 20} rx={4} fill={i === now.stage - 1 ? '#DDD2EC' : '#EEE6D8'} />
            <text x={(X(a) + X(b)) / 2} y={small ? 138 : 85} textAnchor="middle" fontSize={small ? 11 : 10.5} fontWeight={600} fill={i === now.stage - 1 ? '#5B3F8F' : '#8E8A80'}>{t}</text></g>
        ))}
        {P.map(p => (
          <g key={p.index}>
            <line x1={X(p.age)} y1={40} x2={X(p.age)} y2={small ? 68 : 72} stroke="#1D1C1A" strokeWidth={1.5} />
            <circle cx={X(p.age)} cy={24} r={13} fill={fillOf(p)} stroke={now.nextPeak?.index === p.index ? '#5B3F8F' : '#1D1C1A'} strokeWidth={1.5} />
            <text x={X(p.age)} y={29} textAnchor="middle" fontFamily="Literata, Georgia, serif" fontSize={13} fontWeight={600} fill={inkOf(p)}>{L(p.n)}</text>
            {small
              ? <><text x={X(p.age)} y={86} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1D1C1A">{p.age}t</text><text x={X(p.age)} y={100} textAnchor="middle" fontSize={10} fill="#57544D">{p.year}</text></>
              : <text x={X(p.age)} y={100} textAnchor="middle" fontSize={9.5} fill="#57544D">{p.age}t · {p.year}</text>}
          </g>
        ))}
        <line x1={X(now.age)} y1={40} x2={X(now.age)} y2={small ? 68 : 72} stroke="#B0412E" strokeWidth={2} strokeDasharray="3 3" />
        <text x={X(now.age)} y={small ? 118 : 117} textAnchor="middle" fontSize={small ? 10.5 : 9.5} fontWeight={700} fill="#B0412E">bây giờ {now.age}{small ? 't' : ' tuổi'}</text>
      </svg>
    );
  };
  return <div className="card ns-life">{draw(700, 30, 640, false)}{draw(360, 18, 324, true)}</div>;
}

export const STAGE = ['', 'niên thiếu', 'trưởng thành', 'viên mãn'];

/** the board: the birth chart (alone or with a name's numbers), the main numbers, the name's numbers, the pyramid */
export function Board({ c, nameIdx, mode, onMode, onName }: {
  c: NumerologyChart; nameIdx: number | null; mode: 'birth' | 'name'; onMode: (m: 'birth' | 'name') => void; onName: (i: number) => void;
}) {
  const nm = nameIdx !== null ? c.names[nameIdx] ?? null : null;
  const g = c.grid, withName = mode === 'name' && nm;
  const full = withName ? nm.combined.arrows : g.arrows, empty = withName ? nm.combined.empty : g.empty;
  const isolated = withName ? nm.combined.isolated : g.isolated;
  const yr = c.now.year, P = c.pyramid.peaks;
  const next = c.years.find(y => y.year === yr.year + 1);
  const st = c.now.stage === 1 ? `đến ${P[0].age} tuổi` : c.now.stage === 2 ? `${P[0].age}–${P[3].age} tuổi` : `từ ${P[3].age} tuổi`;
  return (
    <div className="card ns-board">
      <div className="ns-chart">
        <div className="tv-k">Biểu đồ ngày sinh{withName ? ` · thêm tên ${nm.text}` : ''}</div>
        <div className="ns-gridwrap">
          <NsGrid counts={g.counts} add={withName ? nm.effect.added : null} full={full} empty={empty} faint={withName ? nm.effect.newArrows : []} isolated={isolated} />
          <div className="ns-planes">{(['tri_nao', 'tinh_than', 'the_chat'] as const).map(p => <div key={p}><b>{PLANE[p]}</b>{(withName ? nm.combined.planes[p] : g.planes[p])} số</div>)}</div>
        </div>
        {nm && <div className="seg" role="group" aria-label="Biểu đồ">
          <button type="button" className={mode === 'birth' ? 'on' : ''} onClick={() => onMode('birth')}>Ngày sinh</button>
          <button type="button" className={mode === 'name' ? 'on' : ''} onClick={() => onMode('name')}>Thêm tên {nm.text}</button></div>}
        <div className="ns-legend">
          {full.map(a => <span key={a} className={`ns-pill${withName && nm.effect.newArrows.includes(a) ? ' name' : ''}`}>{short(ARROW_BY_CODE[a].full)} {a}</span>)}
          {empty.map(a => <span key={a} className="ns-pill empty">trống {a} · {short(ARROW_BY_CODE[a].empty ?? '')}</span>)}
          {isolated.map(n => <span key={n} className="ns-pill iso">số {n} cô lập</span>)}
          {!full.length && !empty.length && <span className="tv-muted" style={{ fontSize: 12.5 }}>không có mũi tên nào</span>}
        </div>
        {withName && <div className="tv-muted" style={{ fontSize: 12 }}>Chữ tím: số từ tên {nm.text}{nm.effect.newArrows.length ? '; mũi tên chấm: tên tạo thêm' : ''}.</div>}
      </div>
      <div className="ns-nums">
        <div className="ns-big"><b>{L(c.ruling)}</b><div className="tv-k">Con số chủ đạo</div><span><code>{c.digits.join(' + ')} = {chainOf(c.sum, L)}</code></span></div>
        <dl className="ns-kv">
          <div><dt>Con số ngày sinh</dt><dd><b>{L(c.birthday)}</b><span>{c.birthday === c.ruling ? 'trùng chủ đạo' : `ngày ${c.input.day}`}</span></dd></div>
          <div><dt>Năm cá nhân</dt><dd><b>{yr.n}</b><span>{dmy(yr.start)} – {dmy(yr.end)}</span></dd></div>
          <div><dt>Giai đoạn</dt><dd><b>{c.now.stage}</b><span>{STAGE[c.now.stage]}, {st}</span></dd></div>
          {next && <div><dt>Năm tới</dt><dd><b>{next.n}</b><span>từ {dmy(next.start)}</span></dd></div>}
        </dl>
        {nm && <div style={{ display: 'grid', gap: 8 }}>
          <div className="tv-k">Tên {nm.text}</div>
          <dl className="ns-kv">
            <div><dt>Linh hồn</dt><dd><b>{L(nm.soul)}</b><span>nguyên âm</span></dd></div>
            <div><dt>Biểu đạt</dt><dd><b>{L(nm.expression)}</b><span>phụ âm</span></dd></div>
            <div><dt>Tên riêng</dt><dd><b>{L(nm.nameNumber)}</b><span>{nm.relation === 'same' ? 'trùng chủ đạo' : nm.relation === 'same_plane' ? 'cùng trục chủ đạo' : 'khác trục chủ đạo'}</span></dd></div>
            <div><dt>Biểu đồ tên</dt><dd><span>{[nm.effect.compensates ? 'bù đắp' : '', nm.effect.reinforces ? 'dồn thêm' : ''].filter(Boolean).join(' và ') || 'không đổi biểu đồ'}</span></dd></div>
          </dl>
          {c.names.length > 1 && <div className="ns-names" role="group" aria-label="Đọc theo tên">
            {c.names.map((n, i) => <button key={i} type="button" className={i === nameIdx ? 'on' : ''} onClick={() => onName(i)}>{n.text}</button>)}</div>}
        </div>}
      </div>
      <div className="ns-pyr"><Pyramid c={c} /><p>Bốn đỉnh cao, mỗi đỉnh rơi vào một năm cá nhân 9. {c.now.nextPeak ? `Đỉnh tới: đỉnh ${c.now.nextPeak.index} năm ${c.now.nextPeak.year}, lúc ${c.now.nextPeak.age} tuổi.` : 'Đã qua cả bốn đỉnh.'}</p></div>
    </div>
  );
}

/** one passage of the book, as read for this person, with why it was chosen and its page */
export function Line({ m, rule, toc, hl }: { m: NumerologyMatchDto; rule: NumerologyRuleDto | undefined; toc?: NumerologyTocEntryDto[]; hl?: boolean }) {
  if (!rule) return null;
  const tag = rule.kind === 'advice' ? <span className="ns-tag adv">Lời khuyên</span> : rule.kind === 'child' ? <span className="ns-tag kid">Với trẻ nhỏ</span> : null;
  const why = m.why.length ? m.why : [describeWhen(rule.when)];
  return (
    <div className={`ns-line ${rule.kind}${hl ? ' hl' : ''}`} id={`r-${rule.code}`}>
      <p>{rule.text}</p>
      <div className="ns-why">{tag}{why.map((w, i) => <span key={i} className="w">{w}</span>)}
        {rule.page !== null && <Link to={`/nhan-so-hoc/sach/${unitOf(rule.entry, toc)}?cau=${encodeURIComponent(rule.code)}`}>tr. {rule.page}</Link>}</div>
    </div>
  );
}

/** the groups of a part of the reading: each section of the book with the passages of it that matched */
export function Groups({ groups, rules, toc, hl }: { groups: NumerologyGroupDto[]; rules: Record<string, NumerologyRuleDto>; toc?: NumerologyTocEntryDto[]; hl?: string | null }) {
  if (!groups.length) return <div className="tv-empty">Sách không có đoạn nào khớp ở phần này.</div>;
  return <>{groups.map(g => {
    const path = g.path.slice(1, -1);
    return (
      <div key={g.entry} className="tv-group">
        <div className="tv-gh"><b>{g.title}</b>{path.length > 0 && <span>{path.join(' › ')}</span>}<Link to={`/nhan-so-hoc/sach/${unitOf(g.entry, toc)}`}>Đọc trong sách ›</Link></div>
        <div className="tv-lines">{g.matches.map(m => <Line key={m.rule} m={m} rule={rules[m.rule]} toc={toc} hl={hl === m.rule} />)}</div>
      </div>
    );
  })}</>;
}

/** a part's passages split: what the book says of the person, and the book's own explanation of the part */
export function splitGroups(groups: NumerologyGroupDto[], rules: Record<string, NumerologyRuleDto>) {
  const isGeneral = (m: NumerologyMatchDto) => rules[m.rule]?.kind === 'general';
  return {
    said: groups.map(g => ({ ...g, matches: g.matches.filter(m => !isGeneral(m)) })).filter(g => g.matches.length),
    general: groups.flatMap(g => g.matches.filter(isGeneral)),
  };
}

/** the book's explanation of a part, beside the passages */
export function Explain({ general, rules, topic }: { general: NumerologyMatchDto[]; rules: Record<string, NumerologyRuleDto>; topic: Topic }) {
  const t = TOPICS.find(x => x.code === topic)!;
  return (
    <div className="ns-expl">
      <h4><span className="tv-voice ba">Sách giải thích</span></h4><small>{t.title} · Phần {t.part}</small>
      {general.length ? general.map(m => <p key={m.rule}>{rules[m.rule]?.text}</p>) : <p className="tv-muted" style={{ fontFamily: 'var(--sans)', fontSize: 12.5 }}>Phần này không có đoạn giải thích riêng.</p>}
      <Link className="tv-link" to={`/nhan-so-hoc/sach/p${t.part}`}>Đọc Phần {t.part} trong sách ›</Link>
    </div>
  );
}
