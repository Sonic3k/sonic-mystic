/* The pieces of a Chiêm tinh page: the wheel, the board beside it (the positions, the chart at a glance), a passage of
   the sources as read for the person, the groups of passages, and the detail of the chart — the aspects, the
   structures, the balance and her test of the dominant planets. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ASPECT, BODY, DIGNITY_NAME, ELEMENT_NAME, LEVEL_NAME, MODALITY_NAME, PATTERN_NAME, PLANETS, SIGN, SIGNS,
  type AstroChart, type BodyCode, type DominantTest, type Element, type Modality, type Topic,
} from '@mystic/engine/astrology';
import type { AstrologyGroupDto, AstrologyMatchDto, AstrologyRuleDto, AstrologySectionDto } from '@mystic/engine/api';
import { api } from '../../api';
import { PART_TITLE, VOICE, dm, isCaps } from '../../lib/astro';

/** a glyph drawn as text, not as an emoji */
const T = (g: string) => `${g}︎`;
const BN = (b: BodyCode) => (b === 'asc' ? 'Cung Mọc' : b === 'mc' ? 'MC' : BODY[b].name);
const SN = (s: keyof typeof SIGN) => SIGN[s].name;
const short = (source: string) => source.replace(/^astrology\./, '');
/** where a passage is read in the sources */
export const bookLink = (source: string, entry: string, rule?: string) => `/astrology/books/${short(source)}/${encodeURIComponent(entry)}${rule ? `?rule=${encodeURIComponent(rule)}` : ''}`;

// ── the wheel ──

export function Wheel({ ch }: { ch: AstroChart }) {
  const W = 520, cx = 260, cy = 260, R0 = 238, R1 = 202, RP = 167, RH = 118, RA = 103;
  const pl = ch.placements;
  const asc = ch.timeKnown && pl.asc ? pl.asc.lon : 0;
  const ang = (lon: number) => Math.PI + ((lon - asc) * Math.PI) / 180;
  const pt = (lon: number, r: number): [number, number] => [cx + r * Math.cos(ang(lon)), cy - r * Math.sin(ang(lon))];
  const EL: Record<Element, string> = { fire: '#F6E3DD', earth: '#EEF0DF', air: '#F6EDDB', water: '#E2EEF4' };
  const ELI: Record<Element, string> = { fire: 'var(--fire)', earth: 'var(--earth)', air: 'var(--air)', water: 'var(--water)' };
  const P: BodyCode[] = PLANETS;
  const shown = (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'north-node', 'chiron', 'lilith'] as BodyCode[]).filter(b => pl[b]);
  /* bodies spread so their glyphs do not overlap */
  const items = shown.map(b => ({ b, lon: pl[b]!.lon, at: pl[b]!.lon })).sort((x, y) => x.lon - y.lon);
  for (let k = 0, moved = true; k < 400 && moved; k++) {
    moved = false;
    for (let i = 0; i < items.length; i++) {
      const a = items[i], b = items[(i + 1) % items.length];
      const gap = b.at - a.at + (i === items.length - 1 ? 360 : 0);
      if (gap < 7.99 && items.length > 1) { const push = (8 - gap) / 2; a.at -= push; b.at += push; moved = true; }
    }
  }
  return (
    <div className="as-wheel">
      <svg viewBox={`0 0 ${W} ${W}`} role="img" aria-label="Vòng lá số">
        <circle cx={cx} cy={cy} r={R0} fill="var(--card)" stroke="#CFC3AE" />
        {SIGNS.map(sg => {
          const a0 = sg.index * 30, a1 = a0 + 30;
          const [x0, y0] = pt(a0, R0), [x1, y1] = pt(a1, R0), [x2, y2] = pt(a1, R1), [x3, y3] = pt(a0, R1);
          const [gx, gy] = pt(a0 + 15, (R0 + R1) / 2);
          return (
            <g key={sg.code}>
              <path d={`M${x0} ${y0} A${R0} ${R0} 0 0 0 ${x1} ${y1} L${x2} ${y2} A${R1} ${R1} 0 0 1 ${x3} ${y3} Z`} fill={EL[sg.element]} stroke="#D8CDB9" strokeWidth={1} />
              <text className="gl" x={gx} y={gy} textAnchor="middle" dominantBaseline="central" fontSize={17} fill={ELI[sg.element]}>{T(sg.glyph)}<title>{sg.name}</title></text>
            </g>
          );
        })}
        {Array.from({ length: 72 }, (_, i) => i * 5).filter(d => d % 30).map(d => {
          const [a, b] = pt(d, R1), [c, e] = pt(d, R1 - (d % 10 === 0 ? 7 : 4));
          return <line key={d} x1={a} y1={b} x2={c} y2={e} stroke="#CFC3AE" />;
        })}
        <circle cx={cx} cy={cy} r={R1} fill="none" stroke="#CFC3AE" />
        <circle cx={cx} cy={cy} r={RH} fill="#FBF8F1" stroke="#D8CDB9" />
        {ch.houses?.map((h, i) => {
          const angle = [0, 3, 6, 9].includes(i);
          const [a, b] = pt(h.lon, angle ? R0 : R1), [c, e] = pt(h.lon, angle ? 30 : RH);
          const next = ch.houses![(i + 1) % 12].lon, span = ((next - h.lon) + 360) % 360;
          const [nx, ny] = pt(h.lon + span / 2, RH - 13);
          return (
            <g key={h.n}>
              <line x1={a} y1={b} x2={c} y2={e} stroke={angle ? '#57544D' : '#CFC3AE'} strokeWidth={angle ? 1.6 : 1} />
              <text x={nx} y={ny} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#8E8A80" fontWeight={600}>{i + 1}</text>
            </g>
          );
        })}
        {ch.houses && ([['asc', 'AC'], ['mc', 'MC'], ['dsc', 'DC'], ['ic', 'IC']] as [BodyCode, string][]).map(([b, label]) => {
          const p = pl[b];
          if (!p) return null;
          const [lx, ly] = pt(p.lon, R0 + 12);
          return <text key={b} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#1D1C1A">{label}</text>;
        })}
        {ch.aspects.filter(a => P.includes(a.a) && P.includes(a.b) && a.aspect !== 'conjunction').map(a => {
          const hard = a.aspect === 'square' || a.aspect === 'opposition', easy = a.aspect === 'trine' || a.aspect === 'sextile';
          const [x1, y1] = pt(pl[a.a]!.lon, RA), [x2, y2] = pt(pl[a.b]!.lon, RA);
          return <line key={`${a.a}-${a.b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hard ? 'var(--hard)' : easy ? 'var(--easy)' : 'var(--minor)'}
            strokeWidth={hard || easy ? 1.2 : 0.8} strokeDasharray={hard || easy ? undefined : '3 3'} opacity={hard || easy ? 0.75 : 0.6} />;
        })}
        {items.map(it => {
          const p = pl[it.b]!;
          const [tx, ty] = pt(it.lon, R1), [tx2, ty2] = pt(it.lon, R1 - 8);
          const [gx, gy] = pt(it.at, RP), [dx, dy] = pt(it.at, RP - 23);
          const planet = P.includes(it.b);
          return (
            <g key={it.b}>
              <line x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="#57544D" strokeWidth={1.4} />
              {Math.abs(it.at - it.lon) > 3 && (() => { const [ax, ay] = pt(it.lon, R1 - 8), [bx, by] = pt(it.at, RP + 11); return <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#CFC3AE" strokeWidth={0.8} />; })()}
              <text className="gl" x={gx} y={gy} textAnchor="middle" dominantBaseline="central" fontSize={planet ? 19 : 15} fill={planet ? '#1D1C1A' : '#57544D'}>{T(BODY[it.b].glyph)}<title>{`${BODY[it.b].name} ${dm(p.lon)} ${SN(p.sign)}`}</title></text>
              <text x={dx} y={dy} textAnchor="middle" dominantBaseline="central" fontSize={9.5} fill="#8E8A80">{Math.floor(p.deg)}°{p.retro && it.b !== 'north-node' ? '℞' : ''}</text>
            </g>
          );
        })}
      </svg>
      <p>{ch.timeKnown ? 'AC ở bên trái, ' : 'Chưa có giờ sinh: Bạch Dương ở bên trái, '}các cung hoàng đạo đi ngược chiều kim đồng hồ · đường đỏ: vuông góc, xung · xanh: tam hợp, lục hợp</p>
    </div>
  );
}

// ── the board ──

const DIG: Record<string, string> = { ruler: 'Tướng', exaltation: 'Vượng', detriment: 'Tù', fall: 'Tử' };

export function Board({ ch }: { ch: AstroChart }) {
  const pl = ch.placements;
  const rows = ([...PLANETS.map(b => [b, false]), ...(['north-node', 'lilith', 'ziqi', 'chiron', 'fortune', 'vertex'] as BodyCode[]).map(b => [b, true])] as [BodyCode, boolean][]).filter(([b]) => pl[b]);
  const firstPoint = rows.findIndex(([, point]) => point);
  const el = ch.balance.elements, mo = ch.balance.modalities;
  const chip = (name: string, list: unknown[]) => <span key={name} className={list.length ? '' : 'zero'}>{name} <b>{list.length}</b></span>;
  const asc = pl.asc, mc = pl.mc, ruler = ch.rulers.chart?.[0];
  const strong = ch.dominant.tests.filter(t => t.level === 'strong' || t.level === 'very-strong').sort((a, b) => b.total - a.total).slice(0, 4);
  return (
    <div className="tv-card as-board">
      <Wheel ch={ch} />
      <div className="as-right">
        <table className="as-pos">
          <thead><tr><th>Sao</th><th>Dấu hiệu</th><th>Độ</th><th>Cung</th><th /><th><span className="as-dig-h">Vượng · Tướng · Tù · Tử</span></th></tr></thead>
          <tbody>{rows.map(([b, point], i) => {
            const p = pl[b]!, g = BODY[b].glyph, sym = g.charCodeAt(0) > 0x2000;
            return (
              <tr key={b} className={`${point ? 'pt' : ''}${i === firstPoint ? ' sep' : ''}`}>
                <td><span className="g">{sym ? T(g) : ''}</span>{BODY[b].name}</td>
                <td><span className="g">{T(SIGN[p.sign].glyph)}</span>{SN(p.sign)}</td>
                <td>{dm(p.lon)}</td><td>{p.house ?? '—'}</td>
                <td>{p.retro && b !== 'north-node' && b !== 'south-node' ? <span className="r" title="nghịch hành">℞</span> : ''}</td>
                <td>{p.dignities.map(d => <span key={d} className={`as-dig ${d}`} title={DIGNITY_NAME[d]}>{DIG[d]}</span>).reduce<React.ReactNode[]>((a, x, k) => (k ? [...a, ' ', x] : [x]), [])}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <dl className="as-facts">
          <div><dt>Cung Mọc</dt><dd>{asc ? <>{SN(asc.sign)} {dm(asc.lon)}{ruler && pl[ruler] && <small>chủ tinh lá số: {ch.rulers.chart!.map(r => BODY[r].name).join(', ')} ({SN(pl[ruler]!.sign)}{pl[ruler]!.house ? `, cung ${pl[ruler]!.house}` : ''})</small>}</> : <>—<small>cần giờ sinh và nơi sinh</small></>}</dd></div>
          <div><dt>MC (Thiên đỉnh)</dt><dd>{mc ? <>{SN(mc.sign)} {dm(mc.lon)}{pl.ic && <small>IC {SN(pl.ic.sign)}</small>}</> : <>—<small>cần giờ sinh và nơi sinh</small></>}</dd></div>
          <div><dt>Nguyên tố</dt><dd><div className="as-elem">{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => chip(ELEMENT_NAME[k], el[k]))}</div></dd></div>
          <div><dt>Thể thức</dt><dd><div className="as-elem">{(['cardinal', 'fixed', 'mutable'] as Modality[]).map(k => chip(MODALITY_NAME[k], mo[k]))}</div></dd></div>
          <div><dt>Nhân tố trội</dt><dd>{strong.length ? strong.map((t, i) => <span key={t.body}>{i ? ' · ' : ''}{BN(t.body)} <b>{t.total}</b></span>) : 'không sao nào từ 26 điểm'}<small>theo bài test của cô · xem ở “Lá số chi tiết”</small></dd></div>
          <div><dt>Cấu trúc</dt><dd>{ch.patterns.map(p => PATTERN_NAME[p.kind]).join(' · ') || '—'}<small>{ch.patterns.map(p => p.bodies.map(b => BODY[b].name).join(' – ')).join(' · ')}</small></dd></div>
        </dl>
      </div>
    </div>
  );
}

// ── the passages ──

export const said = (s: AstrologySectionDto, rules: Record<string, AstrologyRuleDto>) =>
  s.groups.reduce((n, g) => n + g.matches.filter(m => rules[m.rule] && rules[m.rule].kind !== 'general').length, 0);

/** one passage as read for the person: the voice's bar, why it was chosen, its page, Woolfolk's English */
export function Line({ m, r, id, hl }: { m: AstrologyMatchDto; r: AstrologyRuleDto; id: string; hl?: boolean }) {
  const [en, setEn] = useState(false);
  return (
    <div className={`as-line ${r.voice}${hl ? ' hl' : ''}`} id={id}>
      {r.items ? <ul>{r.items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>{r.label && <b className="lb">{r.label}</b>}{r.text}</p>}
      {en && r.en && <div className="as-en">{r.en}</div>}
      <div className="as-why">
        {m.why.map((w, i) => <span key={i} className="w">{w}</span>)}
        {r.page !== null && <Link to={bookLink(r.source, r.entry, r.code)}>tr. {r.page}</Link>}
        {r.en && <button type="button" className="en" aria-pressed={en} onClick={() => setEn(x => !x)}>bản gốc</button>}
      </div>
    </div>
  );
}

/** the passages of a section, group by group (one group per heading of a source) */
export function Groups({ sec, rules, hl }: { sec: AstrologySectionDto; rules: Record<string, AstrologyRuleDto>; hl: string | null }) {
  const gs = sec.groups.map(g => ({ ...g, matches: g.matches.filter(m => rules[m.rule] && rules[m.rule].kind !== 'general') })).filter(g => g.matches.length);
  if (!gs.length) return <div className="tv-empty">Tài liệu không có đoạn nào khớp ở phần này.</div>;
  return <>{gs.map(g => <Group key={`${g.source}|${g.entry}`} g={g} rules={rules} hl={hl} />)}</>;
}

function Group({ g, rules, hl }: { g: AstrologyGroupDto; rules: Record<string, AstrologyRuleDto>; hl: string | null }) {
  const r0 = rules[g.matches[0].rule], v = VOICE[r0.voice];
  const path = g.path.slice(1, -1);
  return (
    <div className="tv-group as-group">
      <div className="tv-gh"><b className={isCaps(g.title) ? 'caps' : ''}>{g.title}</b><span className={`v ${r0.voice}`}>{v[1]}</span>{path.length > 0 && <span>{path.join(' › ')}</span>}
        <Link to={bookLink(g.source, g.entry)}>Đọc trong tài liệu ›</Link></div>
      <div className="tv-lines">{g.matches.map(m => <Line key={m.rule} m={m} r={rules[m.rule]} id={`r-${m.rule}`} hl={hl === m.rule} />)}</div>
    </div>
  );
}

/** the side of a part: what the sources explain of it (shown once), and where its passages come from */
export function Side({ sec, topic, rules, titleOf }: { sec: AstrologySectionDto | undefined; topic: Topic; rules: Record<string, AstrologyRuleDto>; titleOf: (source: string) => string }) {
  const general = sec ? sec.groups.flatMap(g => g.matches.filter(m => rules[m.rule]?.kind === 'general').map(m => rules[m.rule])) : [];
  const bySrc = new Map<string, number>();
  if (sec) for (const g of sec.groups) for (const m of g.matches) { const r = rules[m.rule]; if (r && r.kind !== 'general') bySrc.set(r.source, (bySrc.get(r.source) ?? 0) + 1); }
  const voices = [...new Set(general.map(r => r.voice))];
  return <>
    {voices.map(vc => (
      <div key={vc} className="as-side"><h4><span className={`tv-voice ${VOICE[vc][0]}`}>{vc === 'hk' ? 'Cô giải thích' : `${VOICE[vc][1]} giải thích`}</span></h4><small>{PART_TITLE[topic]}</small>
        {general.filter(r => r.voice === vc).map(r => <p key={r.code}>{r.label && <b style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>{r.label} </b>}{r.text}</p>)}</div>))}
    <div className="as-side"><h4>Phần này đọc từ</h4>
      {bySrc.size ? [...bySrc].map(([c, n]) => <p key={c} className="row"><span>{titleOf(c)}</span><b>{n}</b></p>) : <p className="row"><span>—</span></p>}
      <small style={{ marginTop: 8 }}>Mỗi đoạn kèm lý do nó khớp với lá số (← …). Đoạn của Woolfolk do Claude dịch, bấm “bản gốc” để xem tiếng Anh.</small></div>
  </>;
}

// ── lá số chi tiết ──

/** her test's lines, as she wrote them (the "score" passages of each test, in order) */
function useDominantLines(body: string, enabled: boolean) {
  return useQuery({
    queryKey: ['astro-entry', 'hk-dominant', body], enabled, retry: false, staleTime: 600_000,
    queryFn: () => api.astroEntry('hk-dominant', body),
    select: e => e.sections.flatMap(s => s.passages.filter(p => p.kind === 'score').map(p => p.text)),
  });
}

function DominantRow({ t, open, onToggle }: { t: DominantTest; open: boolean; onToggle: () => void }) {
  const lines = useDominantLines(t.body, open).data ?? [];
  const shown = t.withTaurus ?? t;
  const line = (n: number) => { const s = lines[n - 1] ?? ''; return s.length > 140 ? `${s.slice(0, 140)}…` : s; };
  return <>
    <button type="button" className="as-dom-row" aria-expanded={open} onClick={onToggle}>
      <span>{BN(t.body)}</span><i className={t.level} style={{ width: `${Math.min(100, t.total / 0.6)}%` }} /><b>{t.total}</b>
      <small>{LEVEL_NAME[t.level]}{t.withTaurus ? ` · bản 2: ${t.withTaurus.total}` : ''}</small>
    </button>
    {open && (
      <div className="as-dom-items">
        {shown.items.map((i, k) => <p key={k}><span>dòng {i.line}</span><span>{i.why}<br /><small className="tv-muted" style={{ fontSize: 11.5 }}>{line(i.line)}</small></span><b>+{i.points}</b></p>)}
        {shown.choices.map((c, k) => <p key={`c${k}`}><span>dòng {c.line}</span><span>{c.why}<br /><small className="tv-muted" style={{ fontSize: 11.5 }}>{line(c.line)}</small></span><b>2–5</b></p>)}
        <p><span /><span>{t.partial ? 'Thiếu giờ sinh: các dòng cần AC, MC, cung địa bàn chưa tính.' : shown.choices.length ? 'Dòng “cộng 2 đến 5 điểm” cô để người xem tự cộng: chưa tính vào tổng.' : 'Dòng “cộng 2 đến 5 điểm theo cảm nhận” cô để người xem tự cộng.'}</span><b>{shown.total}</b></p>
      </div>
    )}
  </>;
}

export function Detail({ ch }: { ch: AstroChart }) {
  const pl = ch.placements;
  const B = (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'north-node', 'lilith', 'asc', 'mc'] as BodyCode[]).filter(b => pl[b]);
  const asp = new Map(ch.aspects.map(a => [[a.a, a.b].sort().join('|'), a]));
  const kind = (k: string) => (k === 'conjunction' ? 'conj' : k === 'square' || k === 'opposition' ? 'hard' : k === 'trine' || k === 'sextile' ? 'easy' : 'minor');
  const gl = (b: BodyCode) => (b === 'asc' ? 'AC' : b === 'mc' ? 'MC' : T(BODY[b].glyph));
  const top = [...ch.dominant.tests].sort((a, b) => b.total - a.total)[0]?.body;
  const [open, setOpen] = useState<Set<string>>(new Set(top ? [top] : []));
  const toggle = (b: string) => setOpen(s => { const n = new Set(s); if (n.has(b)) n.delete(b); else n.add(b); return n; });
  const h = ch.balance.hemispheres;
  const names = (list: BodyCode[]) => list.map(b => BODY[b].name).join(', ');
  return (
    <div className="as-detail">
      <div>
        <div className="tv-phead"><h3>Góc chiếu</h3><span>độ lệch theo cô: tam hợp 5–7°, vuông góc 5–7°, đồng vị 5–10°…</span></div>
        <div className="as-asp-wrap">
          <table className="as-asp"><tbody>
            {B.map((r, i) => (
              <tr key={r}><th title={BN(r)}>{gl(r)}</th>
                {B.slice(0, -1).map((c, j) => {
                  if (j >= i) return <td key={c} className="x" />;
                  const a = asp.get([r, c].sort().join('|'));
                  return a ? <td key={c} className={kind(a.aspect)} title={`${BN(r)} ${ASPECT[a.aspect].name.toLowerCase()} ${BN(c)}, lệch ${dm(a.orb)}`}><b>{T(ASPECT[a.aspect].glyph)}</b><small>{Math.round(a.orb * 10) / 10}°</small></td> : <td key={c} />;
                })}
              </tr>
            ))}
            <tr><td className="x" />{B.slice(0, -1).map(b => <th key={b} title={BN(b)}>{gl(b)}</th>)}</tr>
          </tbody></table>
        </div>
        <p className="tv-muted" style={{ fontSize: 12.5 }}>Đỏ: vuông góc, xung · xanh: tam hợp, lục hợp · xám: góc yếu (bán lục hợp, bán phương, tam bán phương, Q, bQ, bất đồng vị). Con số là độ lệch so với góc đúng.</p>
        <div className="tv-phead" style={{ marginTop: 22 }}><h3>Các cấu trúc</h3><span>Tam giác lớn, Chữ T, Ngón tay định mệnh… trong mười hành tinh</span></div>
        <div className="as-pat">{ch.patterns.length ? ch.patterns.map((p, i) => (
          <div key={i}><b>{PATTERN_NAME[p.kind]}{p.modality ? ` · ${MODALITY_NAME[p.modality]}` : ''}{p.element && p.element in ELEMENT_NAME ? ` · ${ELEMENT_NAME[p.element as Element]}` : ''}{p.outOfSign ? ' · phân tách' : ''}{p.sign ? ` · ${SN(p.sign)}` : ''}</b>
            <span>{p.bodies.map(b => BODY[b].name).join(' – ')}{p.apex ? ` · đỉnh ${BODY[p.apex].name}` : ''}</span></div>)) : <div><span>Không có cấu trúc nào.</span></div>}</div>
        <div className="tv-phead" style={{ marginTop: 22 }}><h3>Cân bằng</h3></div>
        <dl className="as-facts">
          <div><dt>Nguyên tố</dt><dd>{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => `${ELEMENT_NAME[k]} ${ch.balance.elements[k].length}`).join(' · ')}<small>{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => names(ch.balance.elements[k])).filter(Boolean).join(' · ')}</small></dd></div>
          <div><dt>Thể thức</dt><dd>{(['cardinal', 'fixed', 'mutable'] as Modality[]).map(k => `${MODALITY_NAME[k]} ${ch.balance.modalities[k].length}`).join(' · ')}</dd></div>
          {h && <><div><dt>Nửa trên · nửa dưới</dt><dd>{h.above.length} · {h.below.length}<small>cung 7–12 · cung 1–6</small></dd></div>
            <div><dt>Đông · Tây</dt><dd>{h.east.length} · {h.west.length}<small>cung 10–3 · cung 4–9</small></dd></div></>}
          <div><dt>Chủ tinh</dt><dd>lá số: {ch.rulers.chart ? names(ch.rulers.chart) : '— (cần giờ sinh)'}<small>Mặt Trời: {names(ch.rulers.sun)} · Mặt Trăng: {names(ch.rulers.moon)}</small></dd></div>
        </dl>
      </div>
      <div>
        <div className="tv-phead"><h3>Nhân tố trội</h3><span>bài test “Đi tìm nhân tố trội” của cô</span></div>
        <p className="tv-muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>Điểm 0–15 thấp, 16–25 trung bình, 26–40 mạnh, trên 40 “cháy máy đo”. Độ lệch: 8° đồng vị, xung · 6° vuông góc, tam hợp · 3° góc yếu · đồng vị, xung với AC, MC đến 10°. Bấm một hàng để xem từng dòng được cộng.</p>
        <div className="as-dom">{ch.dominant.tests.map(t => <DominantRow key={t.body} t={t} open={open.has(t.body)} onToggle={() => toggle(t.body)} />)}</div>
      </div>
    </div>
  );
}
