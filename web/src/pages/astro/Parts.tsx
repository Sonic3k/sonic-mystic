/* The pieces of the Chiêm tinh room. The chart is read for its numbers, so it is drawn clean: ink lines on a white
   sheet, a tick for every degree, each body's degree and minute beside it, colour only where it means something
   (the element of a sign, a hard or a soft aspect). Around it: the chart at a glance, a written reading's emblems and
   companion, the sources' passages body by body, the table of positions and the grid of aspects. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ASPECT, BODY, DIGNITY_NAME, ELEMENT_NAME, LEVEL_NAME, MODALITY_NAME, PATTERN_NAME, PLANETS, SIGN, SIGNS,
  type AstroChart, type BodyCode, type DominantTest, type Element, type Modality, type Pattern, type SignCode,
} from '@mystic/engine/astrology';
import type { AiSectionDto, AstrologyGroupDto, AstrologyMatchDto, AstrologyReadingDto, AstrologyRuleDto, AstrologySectionDto, AstrologyVoice } from '@mystic/engine/api';
import { api } from '../../api';
import { highlight, parseTitle, wordsRe, type Ref, type RoomReading } from '../../components/Reading';
import { PART_TITLE, dm, isCaps } from '../../lib/astro';

const VS = '︎';
/** a glyph drawn as text, not as an emoji */
export const T = (g: string) => `${g}${VS}`;
const norm = (x: number) => ((x % 360) + 360) % 360;
const BN = (b: BodyCode) => (b === 'asc' ? 'Cung Mọc' : b === 'mc' ? 'Thiên đỉnh' : BODY[b].name);
const short = (source: string) => source.replace(/^astrology\./, '');
/** where a passage is read in the sources */
export const bookLink = (source: string, entry: string, rule?: string) => `/astrology/books/${short(source)}/${encodeURIComponent(entry)}${rule ? `?rule=${encodeURIComponent(rule)}` : ''}`;
const ASP_CLASS: Record<string, string> = { conjunction: 'conj', square: 'hard', opposition: 'hard', trine: 'soft', sextile: 'soft' };
const aspClass = (k: string) => ASP_CLASS[k] ?? 'weak';
const DIGN: Record<string, [string, string]> = { ruler: ['Tướng', 'up'], exaltation: ['Vượng', 'up'], detriment: ['Tù', 'down'], fall: ['Tử', 'down'] };
export const VOICE_NAME: Record<AstrologyVoice | 'other', string> = { hk: 'Lời cô', woolfolk: 'Woolfolk', tierney: 'Tierney', other: 'Tài liệu' };
const voiceOfCode = (code: string): AstrologyVoice | 'other' => { const p = code.split('.')[0]; return p.startsWith('hk') ? 'hk' : p === 'woolfolk' ? 'woolfolk' : p === 'tierney' ? 'tierney' : 'other'; };
const patternName = (p: Pattern) => PATTERN_NAME[p.kind].replace(/ \(.*\)$/, '');

/** a body's emblem: its glyph on a lapis medal (AC, MC and the like in letters) */
export function BodyDot({ b, sm }: { b: BodyCode; sm?: boolean }) {
  const g = BODY[b]?.glyph ?? '?', txt = !/[^\x00-\x7F]/.test(g);
  return <span className={`gl-dot${sm ? ' sm' : ''}${txt ? ' txt' : ''}`} aria-hidden="true">{txt ? g : T(g)}</span>;
}
const Sym = ({ g, cls = '' }: { g: string; cls?: string }) => <span className={`sym ${cls}`}>{T(g)}</span>;

// ── the wheel ──

export function Wheel({ ch, hi = null, mini = false }: { ch: AstroChart; hi?: Set<BodyCode> | null; mini?: boolean }) {
  const P = ch.placements, C = 320, ac = ch.timeKnown && P.asc ? P.asc.lon : 0;
  const ang = (lon: number) => ((180 + (lon - ac)) * Math.PI) / 180;
  const pt = (lon: number, r: number): [number, number] => [C + r * Math.cos(ang(lon)), C - r * Math.sin(ang(lon))];
  const f = (n: number) => n.toFixed(1);
  const R = { bo: 304, bi: 262, sg: 287, pl: mini ? 234 : 232, dg: 211, mn: 198, rt: 186, hn: mini ? 166 : 150, inner: 126 };
  const ln = (lon: number, r1: number, r2: number, cls: string, key: string) => { const [x1, y1] = pt(lon, r1), [x2, y2] = pt(lon, r2); return <line key={key} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} className={cls} />; };
  const tx = (lon: number, r: number, cls: string, body: React.ReactNode, key: string, style?: React.CSSProperties) => { const [x, y] = pt(lon, r); return <text key={key} x={f(x)} y={f(y)} textAnchor="middle" dominantBaseline="central" className={cls} style={style}>{body}</text>; };
  const out: React.ReactNode[] = [<circle key="band" cx={C} cy={C} r={(R.bo + R.bi) / 2} style={{ fill: 'none', stroke: '#F5F1E8', strokeWidth: R.bo - R.bi }} />];
  for (let d = 0; d < 360; d += 1) {
    if (mini && d % 5) continue;
    const L = d % 10 === 0 ? 10 : d % 5 === 0 ? 6.5 : 3.5;
    out.push(ln(d, R.bi, R.bi + L, d % 10 === 0 ? 'wh-t10' : d % 5 === 0 ? 'wh-t5' : 'wh-t1', `t${d}`));
  }
  SIGNS.forEach((s, i) => {
    out.push(ln(i * 30, R.bi, R.bo, 'wh-signline', `sl${i}`));
    out.push(tx(i * 30 + 15, R.sg, `wh-sign ${s.element}`, <>{T(s.glyph)}<title>{s.name}</title></>, `sg${i}`, mini ? { fontSize: 27 } : undefined));
  });
  out.push(<circle key="r1" cx={C} cy={C} r={R.bo} className="wh-ring" />, <circle key="r2" cx={C} cy={C} r={R.bi} className="wh-ring" />, <circle key="r3" cx={C} cy={C} r={R.inner} className="wh-ring" style={{ strokeWidth: 0.9 }} />);
  ch.houses?.forEach((h, i) => {
    const angle = [1, 4, 7, 10].includes(h.n);
    out.push(ln(h.lon, R.inner, angle ? R.bo + 12 : R.bi, angle ? 'wh-angle' : 'wh-house', `h${i}`));
    const next = ch.houses![(i + 1) % 12].lon, mid = h.lon + norm(next - h.lon) / 2;
    out.push(tx(mid, R.hn, 'wh-hn', h.n, `hn${i}`, mini ? { fontSize: 17 } : undefined));
  });
  if (ch.houses) ([['asc', 'AC'], ['mc', 'MC'], ['dsc', 'DC'], ['ic', 'IC']] as [BodyCode, string][]).forEach(([k, lab]) => {
    const p = P[k];
    if (!p) return;
    const [x, y] = pt(p.lon, R.bo + 26), cx = Math.cos(ang(p.lon));
    const anchor = cx < -0.5 ? 'end' : cx > 0.5 ? 'start' : 'middle';
    out.push(<text key={`ax${k}`} x={f(x)} y={f(y - (mini ? 0 : 6))} textAnchor={anchor} dominantBaseline="central" className="wh-axl" style={mini ? { fontSize: 19 } : undefined}>{lab}</text>);
    if (!mini) out.push(<text key={`ad${k}`} x={f(x)} y={f(y + 9)} textAnchor={anchor} dominantBaseline="central" className="wh-axd">{dm(p.lon)} {SIGN[p.sign].name}</text>);
  });
  const on = (k: BodyCode) => !hi || hi.has(k);
  ch.aspects.filter(a => PLANETS.includes(a.a as never) && PLANETS.includes(a.b as never) && ['opposition', 'square', 'trine', 'sextile'].includes(a.aspect)).forEach(a => {
    const [x1, y1] = pt(P[a.a]!.lon, R.inner), [x2, y2] = pt(P[a.b]!.lon, R.inner);
    const dim = hi && !(hi.has(a.a) || hi.has(a.b));
    out.push(<line key={`as${a.a}${a.b}`} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} className={`wh-asp ${aspClass(a.aspect)}${dim ? ' wh-dim' : ''}`} />);
  });
  /* crowded glyphs are laid out as groups, evenly spaced around the middle of where they really are */
  const bodies = ([...PLANETS, 'north-node', 'chiron'] as BodyCode[]).filter(k => P[k]);
  const items = bodies.map(k => ({ k, lon: P[k]!.lon, pos: P[k]!.lon })).sort((a, b) => a.lon - b.lon);
  const gap = mini ? 12.5 : 9.6;
  let G = items.map(x => ({ m: [x], c: x.lon }));
  for (let guard = 0; guard < 200 && G.length > 1; guard++) {
    let merged = false;
    for (let i = 0; i < G.length; i++) {
      const j = (i + 1) % G.length, a = G[i], b = G[j];
      const aEnd = a.c + ((a.m.length - 1) / 2) * gap, bStart = b.c - ((b.m.length - 1) / 2) * gap;
      if (((bStart - aEnd + 540) % 360) - 180 < gap) {
        const base = a.m[0].lon, m = [...a.m, ...b.m];
        const c = norm(m.reduce((t, x) => t + base + norm(x.lon - base), 0) / m.length);
        if (j > i) G.splice(i, 2, { m, c }); else { G.splice(i, 1, { m, c }); G.splice(0, 1); }
        merged = true;
        break;
      }
    }
    if (!merged) break;
  }
  G.forEach(g => g.m.forEach((x, i) => { x.pos = norm(g.c + (i - (g.m.length - 1) / 2) * gap); }));
  for (const { k, lon, pos } of items) {
    const p = P[k]!, isHi = !!hi?.has(k);
    const g: React.ReactNode[] = [ln(lon, R.bi, R.bi - 8, 'wh-pos', 'p')];
    if (Math.abs(norm(pos - lon + 180) - 180) > 0.6) { const [x1, y1] = pt(lon, R.bi - 8), [x2, y2] = pt(pos, R.pl + 14); g.push(<line key="l" x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} className="wh-lead" />); }
    if (isHi) { const [hx, hy] = pt(pos, R.pl); g.push(<circle key="hb" cx={f(hx)} cy={f(hy)} r={mini ? 21 : 17} className="wh-hibg" />); }
    g.push(tx(pos, R.pl, 'wh-pl', <>{T(BODY[k].glyph)}<title>{`${BODY[k].name} ${dm(p.lon)} ${SIGN[p.sign].name}${p.house ? `, cung ${p.house}` : ''}`}</title></>, 'g', mini ? { fontSize: 30 } : undefined));
    if (!mini) {
      const d = Math.floor(p.deg), m = Math.floor((p.deg - d) * 60 + 1e-6);
      g.push(tx(pos, R.dg, 'wh-deg', `${d}°`, 'd'), tx(pos, R.mn, 'wh-min', `${String(m).padStart(2, '0')}′`, 'm'));
      if (p.retro && k !== 'north-node') g.push(tx(pos, R.rt, 'wh-r', 'R', 'r'));
    }
    const [px, py] = pt(lon, R.inner);
    g.push(<circle key="pt" cx={f(px)} cy={f(py)} r={2.3} className="wh-pt" />);
    out.push(<g key={`b${k}`} className={`${on(k) ? '' : 'wh-dim'}${isHi ? ' wh-hi' : ''}`}>{g}</g>);
  }
  out.push(<circle key="c" cx={C} cy={C} r={4} className="wh-ring" />);
  return <svg viewBox={mini ? '-44 -44 728 728' : '-104 -48 848 736'} role="img" aria-label="Lá số chiêm tinh">{out}</svg>;
}

// ── the chart at a glance ──

const ELEM_ICON: Record<Element, React.ReactNode> = {
  fire: <svg viewBox="0 0 16 16"><path d="M8 2 14 13H2Z" fill="none" stroke="var(--verm)" strokeWidth="1.5" /></svg>,
  earth: <svg viewBox="0 0 16 16"><path d="M8 14 14 3H2Z M4.2 7.5h7.6" fill="none" stroke="var(--mala)" strokeWidth="1.5" /></svg>,
  air: <svg viewBox="0 0 16 16"><path d="M8 2 14 13H2Z M4.2 8.5h7.6" fill="none" stroke="var(--ochre)" strokeWidth="1.5" /></svg>,
  water: <svg viewBox="0 0 16 16"><path d="M8 14 14 3H2Z" fill="none" stroke="var(--ultra)" strokeWidth="1.5" /></svg>,
};

function Medal({ ch, k, label }: { ch: AstroChart; k: BodyCode; label: string }) {
  const p = ch.placements[k];
  const who = k === 'asc' ? <b className="ac">AC</b> : <Sym g={BODY[k].glyph} />;
  if (!p) return <div className="med none"><span className="who">{who}{label}</span><span className="big">–</span><b className="nm">chưa có</b><span className="dg">cần giờ và nơi sinh</span></div>;
  const s = SIGN[p.sign];
  return (
    <div className="med"><span className="who">{who}{label}</span>
      <span className={`big ${s.element}`}>{T(s.glyph)}</span><b className="nm">{s.name}</b><span className="dg"><b>{dm(p.lon)}</b>{p.house ? ` · cung ${p.house}` : ''}</span></div>
  );
}

export function AstroGlance({ ch }: { ch: AstroChart }) {
  const B = ch.balance, P = ch.placements;
  const dom = [...ch.dominant.tests].sort((a, b) => b.total - a.total);
  const ruler = ch.rulers.chart?.[0], rp = ruler ? P[ruler] : undefined;
  const sat = (p: Pattern) => {
    const hs = [...new Set(p.bodies.map(b => P[b]?.house))];
    const one = hs.length === 1 && hs[0] ? hs[0] : null;
    const near = p.angular && one ? ({ 1: 'sát AC', 4: 'sát IC', 7: 'sát DC', 10: 'sát MC' } as Record<number, string>)[one] : null;
    return <>{patternName(p)}{p.sign ? ` ở ${SIGN[p.sign].name}` : ''}: {p.bodies.map(b => <Sym key={b} g={BODY[b].glyph} />)}{one ? `, ${p.bodies.length > 2 ? `cả ${p.bodies.length}` : 'cùng'} ở cung ${one}` : ''}{near ? `, ${near}` : ''}</>;
  };
  return (
    <aside className="as-glance">
      <div><h3>Ba trụ chính <small>Mặt Trời, Mặt Trăng, cung Mọc</small></h3>
        <div className="trio"><Medal ch={ch} k="sun" label="Mặt Trời" /><Medal ch={ch} k="moon" label="Mặt Trăng" /><Medal ch={ch} k="asc" label="Cung Mọc" /></div></div>
      <div><h3>Nguyên tố <small>của 10 hành tinh</small></h3>
        <div className="elems">{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => {
          const list = B.elements[k] ?? [];
          return <div key={k} className={`el${list.length ? '' : ' none'}`}><span className="el-h">{ELEM_ICON[k]}{ELEMENT_NAME[k]}</span><b className="el-n">{list.length}</b>
            <span className="el-g">{list.map(b => T(BODY[b].glyph)).join('')}</span></div>;
        })}</div></div>
      <div><h3>Thể thức</h3>
        <div className="modes">{(['cardinal', 'fixed', 'mutable'] as Modality[]).map(k => {
          const c = (B.modalities[k] ?? []).length;
          return <div key={k} className={`mode${c ? '' : ' none'}`}><span>{MODALITY_NAME[k]}</span><b>{c}</b></div>;
        })}</div></div>
      <dl className="facts">
        <dt>Chủ tinh lá số</dt><dd>{ruler && rp ? <><Sym g={BODY[ruler].glyph} /> {BODY[ruler].name} ở {SIGN[rp.sign].name}{rp.house ? `, cung ${rp.house}` : ''}</> : 'cần giờ sinh và nơi sinh'}</dd>
        {ch.patterns.length > 0 && <><dt>Cấu trúc</dt><dd>{ch.patterns.map((p, i) => <span key={i} className="pat">{sat(p)}</span>)}</dd></>}
        <dt>Nhân tố trội</dt><dd className="meter">{dom.slice(0, 5).map(t => (
          <span key={t.body} className={t.level === 'strong' ? '' : t.level === 'very-strong' ? 'hot' : 'low'} title={`${BN(t.body)}: ${t.total} điểm, ${LEVEL_NAME[t.level]}`}><Sym g={BODY[t.body].glyph} />{t.total}</span>))}</dd>
      </dl>
    </aside>
  );
}

// ── a written reading in this room ──

const SIGN_BY_NAME = Object.fromEntries(SIGNS.map(s => [s.name, s.code])) as Record<string, SignCode>;
export function astroHighlighter() {
  const re = wordsRe([...Object.values(BODY).map(b => b.name).filter(n => n.length > 2), ...SIGNS.map(s => s.name)]);
  return (text: string) => highlight(text, [{
    re, draw: (m, k) => { const sc = SIGN_BY_NAME[m]; return sc ? <span key={k} className={`e-sg ${SIGN[sc].element}`}>{m}</span> : <span key={k} className="e-pl">{m}</span>; },
  }]);
}

/** the bodies and signs a text names, in the order it names them */
function named(t: string) {
  const bodies: [number, BodyCode][] = [], signs: [number, SignCode][] = [];
  for (const b of Object.values(BODY)) { const i = t.indexOf(b.name); if (i >= 0 && b.name.length > 2) bodies.push([i, b.code]); }
  if (/\bMC\b/.test(t)) bodies.push([t.indexOf('MC'), 'mc']);
  if (t.includes('Cung Mọc')) bodies.push([t.indexOf('Cung Mọc'), 'asc']);
  for (const sg of SIGNS) { const i = t.indexOf(sg.name); if (i >= 0) signs.push([i, sg.code]); }
  bodies.sort((a, b) => a[0] - b[0]); signs.sort((a, b) => a[0] - b[0]);
  return { bodies: bodies.map(x => x[1]).filter(k => k !== 'mc' || bodies.length === 1), signs: signs.map(x => x[1]) };
}

/** what a section of a reading is about: the bodies and signs its title names (and the body its basis names first,
    for a title that names a sign or a house but no body — «Sáu hành tinh Ma Kết», read as Sao Thổ's) */
export function asParse(s: AiSectionDto) {
  const t = named(s.title), b = named((s.basis ?? []).join(' · '));
  return {
    bodies: t.bodies, signs: t.signs, focus: t.bodies[0] ?? b.bodies.find(x => x !== 'mc') ?? null,
    aspect: /^Góc chiếu/.test(s.title), added: /^Luận thêm/.test(s.title),
  };
}

export function astroRoom(r: AstrologyReadingDto, hl: (t: string) => React.ReactNode, who: string, goTo: (code: string) => void): RoomReading {
  const rules = r.rules;
  const voiceOf = (x: Ref): AstrologyVoice | 'other' => (rules[x.code]?.voice ?? (x.src?.voice as AstrologyVoice | null) ?? voiceOfCode(x.code));
  return {
    hl,
    emblem: (s, _t, added, small) => {
      const P = asParse(s);
      if (P.added || added) return <span className="as-em"><span className={`gl-dot manicule${small ? ' sm' : ''}`}>{T('☞')}</span></span>;
      if (P.aspect) return <span className="as-em"><span className={`gl-dot${small ? ' sm' : ''}`}>{T('□')}</span></span>;
      const b = P.focus, sg = P.signs[0];
      if (!b && sg) return <span className="as-em"><span className={`gl-dot${small ? ' sm' : ''}`}><span style={{ color: '#FFF6DF' }}>{T(SIGN[sg].glyph)}</span></span></span>;
      return <span className="as-em"><BodyDot b={b ?? 'sun'} sm={small} />{!small && sg && <span className={`sg ${SIGN[sg].element}`}>{T(SIGN[sg].glyph)}</span>}</span>;
    },
    srcLabel: refs => `${refs.length} đoạn · ${[...new Set(refs.map(x => VOICE_NAME[voiceOf(x)]))].join(', ')}`,
    srcList: (refs: Ref[]) => refs.map(x => {
      /* a passage the chart matched is read from the reading; one on how a chart is weighed (orbs, the test of the
         dominant planets…), from where it stands in its source */
      const rule = rules[x.code], v = voiceOf(x), page = rule ? rule.page : x.src?.paraRef ?? null, label = rule ? rule.label : x.src?.label ?? null;
      return (
        <blockquote key={x.code}>{rule?.items ? rule.items.join(' · ') : rule?.text ?? x.quoted}
          <cite><span className={`vl ${v}`}>{VOICE_NAME[v]}</span>{label ? ` · ${label}` : !rule && x.src ? ` · ${x.src.entryTitle}` : ''}{page != null ? `, trang ${page}` : ''}
            {rule ? <button type="button" onClick={() => goTo(x.code)}>xem trong phần Theo tài liệu ›</button>
              : x.src && <Link to={bookLink(x.src.source, x.src.entry, x.code)}>đọc trong tài liệu ›</Link>}</cite></blockquote>
      );
    }),
    added: <><span className="sym" style={{ fontSize: 17 }}>{T('☞')}</span>Luận thêm của {who}, không phải lời cô hay sách</>,
  };
}

export const astroVoices = (who: string) => <>
  <span><i className="vc hk" />Lời cô</span><span><i className="vc woolfolk" />Woolfolk, Claude dịch</span>
  <span><i className="vc tierney" />Bản dịch Tierney</span><span><i className="vc claude" />{who} luận thêm</span>
</>;

/** the bodies a section of the reading is about (or the planets in the sign it names, or the body its basis names) */
export function hiOf(ch: AstroChart, s: AiSectionDto | undefined): Set<BodyCode> | null {
  if (!s) return null;
  const P = asParse(s), set = new Set<BodyCode>(P.bodies.filter(b => PLANETS.includes(b as never)));
  if (!set.size && P.signs.length) for (const k of PLANETS) if (ch.placements[k]?.sign === P.signs[0]) set.add(k);
  if (!set.size && P.focus && PLANETS.includes(P.focus as never)) set.add(P.focus);
  return set.size ? set : null;
}

export function AstroCompanion({ ch, s }: { ch: AstroChart; s: AiSectionDto | undefined }) {
  const hi = hiOf(ch, s), focus = s ? asParse(s).focus : null;
  const first = hi ? (focus && hi.has(focus) ? focus : [...hi][0]) : null;
  let card: React.ReactNode = null;
  if (first && ch.placements[first]) {
    const p = ch.placements[first]!, sg = SIGN[p.sign];
    const asps = ch.aspects.filter(a => (a.a === first || a.b === first) && ['conjunction', 'opposition', 'square', 'trine', 'sextile'].includes(a.aspect)).slice(0, 6);
    card = (
      <div className="cmp-card cmp-now"><h4>Đang đọc</h4><span className="t">{BODY[first].name} ở {sg.name}</span>
        <dl><dt>Vị trí</dt><dd>{dm(p.lon)} {sg.name}{p.house ? `, cung ${p.house}` : ''}{p.retro ? ', nghịch hành' : ''}</dd>
          <dt>Nguyên tố</dt><dd><span className={sg.element}>{ELEMENT_NAME[sg.element]}</span></dd>
          {p.dignities.length > 0 && <><dt>Vị thế</dt><dd>{p.dignities.map(d => <span key={d} className={`dig ${DIGN[d][1]}`}>{DIGN[d][0]}</span>)}</dd></>}
          {asps.length > 0 && <><dt>Góc chiếu</dt><dd>{asps.map(a => { const o = a.a === first ? a.b : a.a; return <span key={o} className="cmp-asp"><Sym g={ASPECT[a.aspect].glyph} cls={aspClass(a.aspect)} /> {BN(o)}</span>; })}</dd></>}</dl></div>
    );
  } else if (s) card = <div className="cmp-card cmp-now"><h4>Đang đọc</h4><span className="t">{parseTitle(s.title).subj}</span></div>;
  return <><div className="cmp-wheel"><Wheel ch={ch} hi={hi} mini /></div>{card}</>;
}

// ── the sources' passages, part by part ──

export const said = (s: AstrologySectionDto, rules: Record<string, AstrologyRuleDto>) =>
  s.groups.reduce((n, g) => n + g.matches.filter(m => rules[m.rule] && rules[m.rule].kind !== 'general').length, 0);

const FACT_ICON: Record<string, React.ReactNode> = {
  'Âm dương': <><circle cx="8" cy="8" r="6" /><path d="M8 2a3 3 0 0 1 0 6 3 3 0 0 0 0 6" /></>,
  'Nhóm ba': <path d="M8 2.5 13.5 13h-11Z" />, 'Nhóm bốn': <rect x="3" y="3" width="10" height="10" />,
  'Hành tinh chủ quản': <><circle cx="8" cy="8" r="3.5" /><ellipse cx="8" cy="8" rx="7" ry="2.6" /></>,
  'Biểu tượng': <path d="M3 4h10M4 4l1 9h6l1-9" />, 'Ký hiệu': <path d="M2 7c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0 2.5-1.5 4 0M2 11c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0 2.5-1.5 4 0" />,
  'Từ khóa chủ đạo': <path d="M4 5h8M4 8h8M4 11h5" />, 'Cặp đối cực': <><circle cx="4.5" cy="8" r="2.5" /><circle cx="11.5" cy="8" r="2.5" /><path d="M7 8h2" /></>,
  'Bộ phận cơ thể': <><circle cx="8" cy="3.5" r="2" /><path d="M8 6v5M5 8h6M8 11l-2.5 3.5M8 11l2.5 3.5" /></>, 'Ngày may mắn': <><rect x="2.5" y="3.5" width="11" height="10" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
  'Đá hộ mệnh': <path d="M4 3h8l2.5 3.5L8 14 1.5 6.5Z M1.5 6.5h13" />, 'Màu đặc biệt': <circle cx="8" cy="8" r="6" />,
  'Thành phố': <><path d="M8 14s5-4.6 5-8.2A5 5 0 0 0 3 5.8C3 9.4 8 14 8 14Z" /><circle cx="8" cy="6" r="1.8" /></>, 'Hoa': <><circle cx="8" cy="6.5" r="2" /><path d="M8 8.5V14M8 6.5c-3-4-5-1-3 1M8 6.5c3-4 5-1 3 1" /></>,
  'Kim loại': <path d="M3 11h10l-2-5H5Z" />, 'Con vật': <><path d="M3 9c2-4 8-4 10 0-2 3-8 3-10 0Z" /><circle cx="10" cy="8.5" r=".8" /></>, 'Mối nguy': <path d="M8 2.5 14 13H2Z M8 6.5v3.5M8 11.6v.4" />,
};
const COLOR_WORDS: [string, string][] = [['xanh điện', '#2F6BFF'], ['xanh lục bảo', '#1E8C66'], ['xanh lá', '#3E8E41'], ['xanh dương', '#2E5AA4'], ['xanh lam', '#2E5AA4'], ['bạc', '#BFC3CA'], ['đỏ', '#C0392B'], ['đen', '#222222'], ['nâu', '#7A5230'], ['vàng', '#E1B12C'], ['tím', '#6B3FA0'], ['hồng', '#E58FA8'], ['trắng', '#F4F1EA'], ['xám', '#9AA0A6'], ['cam', '#E67E22'], ['xanh', '#3E7FB8']];

/** one of Woolfolk's short labelled lines as a tile: its label with an icon, the gist big, the rest small */
function Fact({ r }: { r: AstrologyRuleDto }) {
  const label = r.label ?? '', key = Object.keys(FACT_ICON).find(k => label.startsWith(k));
  const i = r.text.indexOf(': '), cut = i > 0 && i < 60, head = cut ? r.text.slice(0, i) : r.text, rest = cut ? r.text.slice(i + 2) : '';
  const sw = key === 'Màu đặc biệt' ? COLOR_WORDS.find(([w]) => head.toLowerCase().includes(w))?.[1] : undefined;
  const brief = head.length <= 48, wide = (brief ? rest.length : r.text.length) > 170;
  return (
    <div className={`fact${wide ? ' wide' : ''}`}>
      <dt><svg viewBox="0 0 16 16" aria-hidden="true">{(key && FACT_ICON[key]) || <circle cx="8" cy="8" r="2" />}</svg>{label}</dt>
      {brief ? <dd>{sw && <span className="swatch" style={{ background: sw }} />}{head}{rest && <small>{rest}</small>}</dd> : <dd className="long">{r.text}</dd>}
    </div>
  );
}

/** a passage as read for the person: its words, why it was chosen, its page, and Woolfolk's English beside */
function Passage({ m, r, hl, focus }: { m: AstrologyMatchDto; r: AstrologyRuleDto; hl: (t: string) => React.ReactNode; focus: boolean }) {
  const [en, setEn] = useState(false);
  return (
    <div className={`bk-p${focus ? ' hl' : ''}`} id={`r-${r.code}`}>
      {r.items ? <><p>{r.label && <span className="lbl">{r.label}</span>}</p><ul className="bk-items">{r.items.map((x, i) => <li key={i}>{x}</li>)}</ul></>
        : <p>{r.label && <span className="lbl">{r.label}</span>}{hl(r.text)}</p>}
      {en && r.en && <div className="as-en">{r.en}</div>}
      <div className="why">{m.why.join(' · ')}{r.page !== null && <>{m.why.length ? ' · ' : ''}<Link to={bookLink(r.source, r.entry, r.code)}>trang {r.page}</Link></>}
        {r.en && <> · <button type="button" className="en" aria-pressed={en} onClick={() => setEn(x => !x)}>{en ? 'ẩn bản gốc' : 'bản gốc'}</button></>}</div>
    </div>
  );
}

/** a heading of a source with the passages of it that matched */
function Group({ g, rules, hl, focus, title }: { g: AstrologyGroupDto; rules: Record<string, AstrologyRuleDto>; hl: (t: string) => React.ReactNode; focus: string | null; title?: string }) {
  const ms = g.matches.filter(m => rules[m.rule]);
  if (!ms.length) return null;
  const v = rules[ms[0].rule].voice, page = rules[ms[0].rule].page;
  return (
    <div className="bk">
      <div className="bk-h"><h3 className={isCaps(g.title) ? 'caps' : ''}>{title ?? g.title}</h3><span className={`vl ${v}`}>{VOICE_NAME[v]}{v === 'woolfolk' ? ', Claude dịch' : ''}</span>
        {page !== null && <span className="pg">trang {page}</span>}<Link className="pg" to={bookLink(g.source, g.entry)}>đọc trong tài liệu ›</Link></div>
      {ms.map(m => <Passage key={m.rule} m={m} r={rules[m.rule]} hl={hl} focus={focus === m.rule} />)}
    </div>
  );
}

/** a section of the reading: Woolfolk's short lines as a sheet of facts (a body's), then the passages, heading by heading */
export function SectionView({ sec, rules, hl, focus, facts, quiet }: { sec: AstrologySectionDto; rules: Record<string, AstrologyRuleDto>; hl: (t: string) => React.ReactNode; focus: string | null; facts: boolean; quiet?: boolean }) {
  const sheets: { g: AstrologyGroupDto; list: AstrologyRuleDto[] }[] = [], prose: AstrologyGroupDto[] = [], general: AstrologyRuleDto[] = [];
  for (const g of sec.groups) {
    const rs = g.matches.map(m => rules[m.rule]).filter((r): r is AstrologyRuleDto => !!r);
    general.push(...rs.filter(r => r.kind === 'general'));
    const said = rs.filter(r => r.kind !== 'general');
    const brief = facts ? said.filter(r => r.label && r.text.length < 420 && r.voice === 'woolfolk' && !r.items) : [];
    if (brief.length >= 4) sheets.push({ g, list: brief });
    const rest = g.matches.filter(m => { const r = rules[m.rule]; return r && r.kind !== 'general' && !(brief.length >= 4 && brief.includes(r)); });
    if (rest.length) prose.push({ ...g, matches: rest });
  }
  return <>
    {facts && (sheets.length ? sheets.map(({ g, list }) => (
      <div key={g.entry} className="fs-part"><div className="fs-src">{g.title} · Woolfolk{list[0].page !== null ? `, trang ${list[0].page}` : ''}</div><dl className="fs-grid">{list.map(r => <Fact key={r.code} r={r} />)}</dl></div>
    )) : <p className="fs-none">Sách không có bảng đặc điểm cho vị trí này.</p>)}
    {general.length > 0 && <Explain general={general} />}
    {prose.map(g => <Group key={`${g.source}|${g.entry}`} g={g} rules={rules} hl={hl} focus={focus} />)}
    {!prose.length && !sheets.length && !quiet && <p className="fs-none">Tài liệu không có đoạn nào khớp ở phần này.</p>}
  </>;
}

/** what the sources explain of a part (shown once, at its top) */
function Explain({ general }: { general: AstrologyRuleDto[] }) {
  const voices = [...new Set(general.map(r => r.voice))];
  return <>{voices.map(v => (
    <div key={v} className="ex"><div className="ex-h"><span className={`vl ${v}`}>{v === 'hk' ? 'Cô giải thích' : `${VOICE_NAME[v]} giải thích`}</span></div>
      {general.filter(r => r.voice === v).map(r => <p key={r.code}>{r.label && <b>{r.label} </b>}{r.text}</p>)}</div>))}</>;
}

// ── the table of positions, the balance, her test of the dominant planets ──

export function TablePane({ ch }: { ch: AstroChart }) {
  const P = ch.placements;
  const row = (k: BodyCode) => {
    const p = P[k];
    if (!p) return null;
    const sg = SIGN[p.sign];
    return (
      <tr key={k}><td><span className="nm"><BodyDot b={k} sm />{BN(k)}</span></td><td><span className="sg"><Sym g={sg.glyph} cls={sg.element} />{sg.name}</span></td><td>{dm(p.lon)}</td><td className="hs">{p.house ?? ''}</td>
        <td>{p.dignities.map(d => <span key={d} className={`dig ${DIGN[d][1]}`} title={DIGNITY_NAME[d]}>{DIGN[d][0]}</span>)}</td><td>{p.retro && k !== 'north-node' && k !== 'south-node' ? <><span className="retro">R</span> nghịch hành</> : ''}</td></tr>
    );
  };
  const h = ch.balance.hemispheres;
  const names = (list: BodyCode[]) => list.map(b => BODY[b].name).join(', ');
  const top = [...ch.dominant.tests].sort((a, b) => b.total - a.total)[0]?.body;
  const [open, setOpen] = useState<Set<string>>(new Set(top ? [top] : []));
  const toggle = (b: string) => setOpen(s => { const n = new Set(s); if (n.has(b)) n.delete(b); else n.add(b); return n; });
  return (
    <div className="tab-pane">
      <div className="ptab"><table>
        <thead><tr><th>Thiên thể</th><th>Dấu hiệu</th><th>Độ</th><th>Cung</th><th>Vượng · Tướng · Tù · Tử</th><th /></tr></thead>
        <tbody>
          {PLANETS.map(row)}
          <tr className="sep"><td colSpan={6}>Các điểm</td></tr>
          {(['north-node', 'south-node', 'lilith', 'ziqi', 'chiron', 'fortune', 'vertex'] as BodyCode[]).map(row)}
          {ch.houses && <><tr className="sep"><td colSpan={6}>Các góc</td></tr>{(['asc', 'mc'] as BodyCode[]).map(row)}</>}
        </tbody>
      </table></div>
      {ch.houses && <div className="ptab cusps"><table>
        <thead><tr><th>Cung</th><th>Nóc cung</th><th>Chủ tinh</th><th>Thiên thể trong cung</th></tr></thead>
        <tbody>{ch.houses.map(c => (
          <tr key={c.n}><td className="hs">{c.n}</td><td><span className="sg"><Sym g={SIGN[c.sign].glyph} cls={SIGN[c.sign].element} />{dm(c.lon)} {SIGN[c.sign].name}</span></td>
            <td>{c.rulers.map(b => BODY[b].name).join(', ')}</td><td className="bodies">{c.bodies.map(b => <span key={b} title={BN(b)}>{/[^\x00-\x7F]/.test(BODY[b].glyph) ? <Sym g={BODY[b].glyph} /> : BODY[b].glyph}</span>)}</td></tr>))}</tbody>
      </table></div>}
      <div className="bal">
        <section><h3>Cân bằng</h3>
          <dl className="facts">
            <dt>Nguyên tố</dt><dd>{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => `${ELEMENT_NAME[k]} ${ch.balance.elements[k].length}`).join(' · ')}<small>{(['fire', 'earth', 'air', 'water'] as Element[]).map(k => names(ch.balance.elements[k])).filter(Boolean).join(' · ')}</small></dd>
            <dt>Thể thức</dt><dd>{(['cardinal', 'fixed', 'mutable'] as Modality[]).map(k => `${MODALITY_NAME[k]} ${ch.balance.modalities[k].length}`).join(' · ')}</dd>
            {h && <><dt>Nửa trên · nửa dưới</dt><dd>{h.above.length} · {h.below.length}<small>cung 7–12 · cung 1–6</small></dd>
              <dt>Đông · Tây</dt><dd>{h.east.length} · {h.west.length}<small>cung 10–3 · cung 4–9</small></dd></>}
            <dt>Chủ tinh</dt><dd>lá số: {ch.rulers.chart ? names(ch.rulers.chart) : 'cần giờ sinh'}<small>Mặt Trời: {names(ch.rulers.sun)} · Mặt Trăng: {names(ch.rulers.moon)}</small></dd>
          </dl></section>
        <section><h3>Nhân tố trội <small>bài test “Đi tìm nhân tố trội” của cô</small></h3>
          <p className="note">Điểm 0–15 thấp, 16–25 trung bình, 26–40 mạnh, trên 40 “cháy máy đo”. Độ lệch: 8° đồng vị, xung · 6° vuông góc, tam hợp · 3° góc yếu · đồng vị, xung với AC, MC đến 10°. Bấm một hàng để xem từng dòng được cộng.</p>
          <div className="dom">{ch.dominant.tests.map(t => <DominantRow key={t.body} t={t} open={open.has(t.body)} onToggle={() => toggle(t.body)} />)}</div></section>
      </div>
    </div>
  );
}

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
    <button type="button" className="dom-row" aria-expanded={open} onClick={onToggle}>
      <span className="nm"><BodyDot b={t.body} sm />{BN(t.body)}</span><i className={t.level} style={{ width: `${Math.min(100, t.total / 0.9)}%` }} /><b>{t.total}</b>
      <small>{LEVEL_NAME[t.level]}{t.withTaurus ? ` · bản 2: ${t.withTaurus.total}` : ''}</small>
    </button>
    {open && (
      <div className="dom-items">
        {shown.items.map((i, k) => <p key={k}><span>dòng {i.line}</span><span>{i.why}<small>{line(i.line)}</small></span><b>+{i.points}</b></p>)}
        {shown.choices.map((c, k) => <p key={`c${k}`}><span>dòng {c.line}</span><span>{c.why}<small>{line(c.line)}</small></span><b>2–5</b></p>)}
        <p className="sum"><span /><span>{t.partial ? 'Thiếu giờ sinh: các dòng cần AC, MC, cung địa bàn chưa tính.' : shown.choices.length ? 'Dòng “cộng 2 đến 5 điểm” cô để người xem tự cộng: chưa tính vào tổng.' : 'Dòng “cộng 2 đến 5 điểm theo cảm nhận” cô để người xem tự cộng.'}</span><b>{shown.total}</b></p>
      </div>
    )}
  </>;
}

// ── the grid of aspects, and the structures ──

export function AspectsPane({ ch }: { ch: AstroChart }) {
  const L = ([...PLANETS, 'asc', 'mc'] as BodyCode[]).filter(b => ch.placements[b]);
  const find = (a: BodyCode, b: BodyCode) => ch.aspects.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  const glyph = (b: BodyCode) => (BODY[b].glyph.length > 1 ? <span className="ax">{BODY[b].glyph}</span> : T(BODY[b].glyph));
  const extra = ch.aspects.filter(a => !L.includes(a.a) || !L.includes(a.b));
  return (
    <div className="tab-pane">
      <div className="asp-wrap">
        <div className="asp"><table><tbody>{L.map((r, i) => (
          <tr key={r}>{L.slice(0, i).map(c => {
            const x = find(c, r);
            if (!x) return <td key={c} className="c" />;
            return <td key={c} className={`c on ${aspClass(x.aspect)}`} title={`${BN(c)} ${ASPECT[x.aspect].name.toLowerCase()} ${BN(r)}, lệch ${dm(x.orb)}`}>
              <span className="g">{T(ASPECT[x.aspect].glyph)}</span><span className="o">{Math.round(x.orb * 10) / 10}°</span></td>;
          })}<td className="diag" title={BN(r)}>{glyph(r)}</td></tr>
        ))}</tbody></table></div>
        <div className="asp-key">
          <p>Mỗi ô là góc chiếu giữa hai thiên thể ở hàng và cột, số nhỏ là độ lệch. Rê vào ô để đọc tên.</p>
          <div className="row"><span className="sym conj">{T('☌')}</span>Đồng vị</div>
          <div className="row"><span className="sym hard">{T('□')}</span>Vuông góc, <span className="sym hard">{T('☍')}</span>xung: góc căng</div>
          <div className="row"><span className="sym soft">{T('△')}</span>Tam hợp, <span className="sym soft">{T('⚹')}</span>lục hợp: góc thuận</div>
          <div className="row"><span className="sym weak">{T('⚺')}</span>Các góc yếu: bán lục hợp, bán phương, bất đồng vị…</div>
          <p>Độ lệch theo cô: tam hợp 5–7°, vuông góc 5–7°, đồng vị 5–10°…</p>
        </div>
      </div>
      {extra.length > 0 && <div className="asp-more"><h3>Với các điểm khác</h3><div className="arw-list">{extra.map(a => (
        <span key={`${a.a}${a.b}${a.aspect}`} className={`ax-chip ${aspClass(a.aspect)}`} title={`lệch ${dm(a.orb)}`}>{BN(a.a)} <span className="sym">{T(ASPECT[a.aspect].glyph)}</span> {BN(a.b)} <small>{Math.round(a.orb * 10) / 10}°</small></span>))}</div></div>}
      <div className="pats"><h3>Các cấu trúc <small>Tam giác lớn, Chữ T, Ngón tay định mệnh… trong mười hành tinh</small></h3>
        {ch.patterns.length ? ch.patterns.map((p, i) => (
          <div key={i} className="pat-row"><b>{PATTERN_NAME[p.kind]}{p.modality ? ` · ${MODALITY_NAME[p.modality]}` : ''}{p.element && p.element in ELEMENT_NAME ? ` · ${ELEMENT_NAME[p.element as Element]}` : ''}{p.outOfSign ? ' · phân tách' : ''}{p.sign ? ` · ${SIGN[p.sign].name}` : ''}</b>
            <span>{p.bodies.map(b => <span key={b} className="pb"><Sym g={BODY[b].glyph} /> {BODY[b].name}</span>)}{p.apex ? <span className="pb">đỉnh {BODY[p.apex].name}</span> : null}</span></div>))
          : <p className="note">Không có cấu trúc nào.</p>}
      </div>
    </div>
  );
}

export { PART_TITLE };
