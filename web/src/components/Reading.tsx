/* A written reading (the synthesis Claude or the AI wrote for a profile), one shape for every room: a table of
   contents beside it, a measure that reads easily, each section's subject and its key words first, the source's
   own words one tap away under each paragraph, and what is added (not the source's) set apart in its own voice.
   A reading weighed by the source's rules reads in that order: how it was weighed, what governs the chart (Trọng
   điểm), what only adds to it (Tô thêm), the period being lived, and — folded away, one line each — what weighs little.
   That is the Căn cứ: what the reading given to the person (its Luận giải, written for them in plain words, read
   first) rests on. Each room brings its emblems, its highlights and how its sources are named. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AiItemDto, AiReadingDto, AiSectionDto, Weight } from '@mystic/engine/api';
import { dateVi } from '../lib/text';

export type Ref = AiItemDto['refs'][number];
export interface Title { subj: string; keys: string[] }

/** "Mặt Trời Bảo Bình ở cung 11: độc lập, bạn bè" → the subject, and its key words (a trailing "(…)" too) */
export function parseTitle(t: string): Title {
  let subj = t, keys: string[] = [];
  const c = t.indexOf(': ');
  if (c > 0) { subj = t.slice(0, c); keys = t.slice(c + 2).split(/,\s*/); }
  const pm = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(subj);
  if (pm) { subj = pm[1]; keys = [...pm[2].split(/,\s*/), ...keys]; }
  return { subj, keys: keys.map(k => k.replace(/[«»]/g, '').trim()).filter(Boolean) };
}

export const isAdded = (s: AiSectionDto) => s.items.length > 0 && s.items.every(it => it.layer === 'added');
/** a section's title and why it weighs what it does, as one text (what a room reads its palaces or bodies from) */
export const sectionText = (s: AiSectionDto) => [s.title, ...(s.basis ?? [])].join(' · ');

// ── highlights in running text ──

/** a name that is data in this room, and how it is drawn */
export interface Pass { re: RegExp; draw: (m: string, key: number) => React.ReactNode; once?: boolean }

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** a regex that finds any of the names as a whole word (Vietnamese letters and their marks around it do not count) */
export const wordsRe = (names: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{M}])(${[...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length).map(escRe).join('|')})(?![\\p{L}\\p{M}])`, 'gu');

/** «quotes» in the voice of the room; names that are data in its colour (a name once a paragraph, unless it is a number) */
export function highlight(text: string, passes: Pass[]): React.ReactNode {
  const seen = new Set<string>();
  let key = 0;
  const run = (chunk: string): React.ReactNode[] => {
    let parts: React.ReactNode[] = [chunk];
    for (const ps of passes) {
      const next: React.ReactNode[] = [];
      for (const part of parts) {
        if (typeof part !== 'string') { next.push(part); continue; }
        let at = 0;
        for (const m of part.matchAll(new RegExp(ps.re.source, ps.re.flags.includes('g') ? ps.re.flags : `${ps.re.flags}g`))) {
          const w = m[0], i = m.index, k = w.toLowerCase();
          if ((ps.once ?? true) && seen.has(k)) continue;
          seen.add(k);
          if (i > at) next.push(part.slice(at, i));
          next.push(ps.draw(w, key++));
          at = i + w.length;
        }
        if (at < part.length) next.push(part.slice(at));
      }
      parts = next;
    }
    return parts;
  };
  const out: React.ReactNode[] = [];
  for (const piece of text.split(/(«[^»]{1,160}»)/g)) {
    if (!piece) continue;
    if (/^«[^»]{1,160}»$/.test(piece)) out.push(<q key={`q${key++}`} className="q">{run(piece)}</q>);
    else out.push(...run(piece).map(n => (typeof n === 'string' ? <Fragment key={`t${key++}`}>{n}</Fragment> : n)));
  }
  return out;
}

// ── a room's way of drawing a reading ──

export interface RoomReading {
  /** the paragraph's running text, with the room's highlights */
  hl: (text: string) => React.ReactNode;
  /** a section's emblem (small: in the table of contents) */
  emblem: (s: AiSectionDto, t: Title, added: boolean, small: boolean) => React.ReactNode;
  /** "3 câu của bà", "2 đoạn sách, tr. 41" */
  srcLabel: (refs: Ref[]) => string;
  /** the passages a paragraph retells, in the source's own words */
  srcList: (refs: Ref[]) => React.ReactNode;
  /** the label of a run of added paragraphs */
  added: React.ReactNode;
  /** a key word of a title (Tử vi colours its stars) */
  keyChip?: (k: string, i: number) => React.ReactNode;
  /** the heading of the period being lived ("Vận đang đi", "Thời vận") and what it covers */
  current?: [string, string];
}

// ── a reading weighed ──

type Group = Exclude<Weight, 'intro' | 'minor'>;
const GROUPS: Group[] = ['key', 'normal', 'current'];
const GROUP_NAME: Record<Group, [string, string]> = {
  key: ['Trọng điểm', 'những yếu tố chi phối lá số'],
  normal: ['Tô thêm', 'có tác dụng, nhưng không chi phối'],
  current: ['Vận đang đi', 'thời kỳ đang sống'],
};
const groupName = (room: RoomReading, g: Group) => (g === 'current' && room.current ? room.current : GROUP_NAME[g]);

/** a reading's sections by weight, by their place in the reading (ids, the spy and the companion follow it); null
    for a reading written before readings were weighed */
export interface Weighed { intro: number[]; key: number[]; normal: number[]; current: number[]; minor: number[] }
export function weighOf(ai: AiReadingDto): Weighed | null {
  if (!ai.sections.some(s => s.weight)) return null;
  const w: Weighed = { intro: [], key: [], normal: [], current: [], minor: [] };
  ai.sections.forEach((s, i) => w[s.weight ?? 'normal'].push(i));
  return w;
}
/** the sections that govern the chart, by their place in the reading */
export const keysOf = (ai: AiReadingDto | null | undefined) => (ai ? weighOf(ai)?.key ?? [] : []);
/** a weighed reading's groups in reading order, as a table of contents names them */
export const weighedGroups = (w: Weighed, room: RoomReading) => GROUPS.filter(g => w[g].length).map(g => ({ g, name: groupName(room, g)[0], idx: w[g] }));

function Para({ it, room }: { it: AiItemDto; room: RoomReading }) {
  const [open, setOpen] = useState(false);
  const refs = it.refs ?? [];
  return (
    <div className="rd-p">
      <p>{room.hl(it.text)}</p>
      {refs.length > 0 && <>
        <button type="button" className="src" aria-expanded={open} onClick={() => setOpen(o => !o)}>{room.srcLabel(refs)}</button>
        {open && <div className="srcs">{room.srcList(refs)}</div>}
      </>}
    </div>
  );
}

/** one section: its emblem, its subject and key words, why it weighs what it does, the paragraphs, the added ones
    gathered under their label */
export function Section({ s, i, room, idp = 's' }: { s: AiSectionDto; i: number; room: RoomReading; idp?: string }) {
  const t = parseTitle(s.title);
  const body: React.ReactNode[] = [];
  let run: React.ReactNode[] = [];
  const flush = () => { if (run.length) { body.push(<div key={`a${body.length}`} className="added-run"><div className="added-label">{room.added}</div>{run}</div>); run = []; } };
  s.items.forEach((it, j) => {
    const p = <Para key={j} it={it} room={room} />;
    if (it.layer === 'added') run.push(p); else { flush(); body.push(p); }
  });
  flush();
  return (
    <section className={`rd-s${s.weight ? ` w-${s.weight}` : ''}`} id={`${idp}${i}`} data-i={i}>
      <header className="rd-h">
        <div className="rd-em">{room.emblem(s, t, isAdded(s), false)}</div>
        <div><h2>{t.subj}</h2>
          {t.keys.length > 0 && <div className="rd-keys">{t.keys.map((k, n) => room.keyChip ? <Fragment key={n}>{room.keyChip(k, n)}</Fragment> : <span key={n} className="key">{k}</span>)}</div>}
          {s.basis?.length > 0 && <div className="wt-basis"><em>Căn cứ</em>{s.basis.map((b, n) => <span key={n}>{b}</span>)}</div>}</div>
      </header>
      {body}
    </section>
  );
}

/** what weighs little, one line each with why: folded away until asked for (or jumped to) */
function MinorList({ ai, idx, room, idp }: { ai: AiReadingDto; idx: number[]; room: RoomReading; idp: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const show = () => setOpen(true);
    el.addEventListener('rd-open', show);
    return () => el.removeEventListener('rd-open', show);
  }, []);
  return (
    <section className="wt-minor" id={`${idp}-minor`} data-i={idx[0]} ref={box}>
      <button type="button" className="wt-minor-h" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>Ít tác dụng</span><small>{idx.length} yếu tố bị giảm lực hoặc quá nhỏ</small><i>{open ? 'Thu gọn' : 'Xem'}</i></button>
      <ul hidden={!open}>{idx.map(i => {
        const s = ai.sections[i];
        return (
          <li key={i} id={`${idp}${i}`}><b>{s.title}</b>
            <div>{s.items.map((it, j) => <MinorLine key={j} it={it} room={room} />)}</div></li>
        );
      })}</ul>
    </section>
  );
}

function MinorLine({ it, room }: { it: AiItemDto; room: RoomReading }) {
  const [open, setOpen] = useState(false);
  return <>
    <span>{room.hl(it.text)}</span>{it.layer === 'added' && <span className="wt-add">phần thêm</span>}
    {it.refs.length > 0 && <>
      <button type="button" className="src" aria-expanded={open} onClick={() => setOpen(o => !o)}>{room.srcLabel(it.refs)}</button>
      {open && <div className="srcs">{room.srcList(it.refs)}</div>}
    </>}
  </>;
}

/** the body of a reading: weighed (how, the groups, what weighs little) or, for an older one, its sections in order */
export function ReadingArticle({ ai, room, idp = 's' }: { ai: AiReadingDto; room: RoomReading; idp?: string }) {
  const w = weighOf(ai);
  if (!w) return <>{ai.sections.map((s, i) => <Section key={i} s={s} i={i} room={room} idp={idp} />)}</>;
  return <>
    {w.intro.length > 0 && <div className="wt-intro">{w.intro.flatMap(i => ai.sections[i].items.map((it, j) => <Para key={`${i}.${j}`} it={it} room={room} />))}</div>}
    {GROUPS.filter(g => w[g].length).map(g => {
      const [name, sub] = groupName(room, g);
      return (
        <Fragment key={g}>
          <h3 className={`wt-g w-${g}`}><span>{name}</span><small>{sub}</small></h3>
          {w[g].map(i => <Section key={i} s={ai.sections[i]} i={i} room={room} idp={idp} />)}
        </Fragment>
      );
    })}
    {w.minor.length > 0 && <MinorList ai={ai} idx={w.minor} room={room} idp={idp} />}
  </>;
}

/** who wrote the reading, when, for which year, and whether the chart still is what it was written from */
export function Byline({ ai, fresh = 'còn khớp với lá số', old = 'lá số đã đổi từ lúc viết, nên viết lại' }: { ai: AiReadingDto; fresh?: string; old?: string }) {
  const who = ai.author === 'claude' ? 'Claude viết trong phiên làm việc' : 'Viết bằng AI';
  return (
    <div className="byline">
      <span><b>{who}</b>, ngày {dateVi(ai.createdAt)}</span><span>xem năm {ai.viewYear}</span>
      <span className={`fresh${ai.stale ? ' old' : ''}`}>{ai.stale ? old : fresh}</span>
    </div>
  );
}

/** scrolls to a part of a reading (one folded away is opened first) */
export const jump = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.dispatchEvent(new CustomEvent('rd-open', { bubbles: true }));
  requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

/**
 * The part being read: the first one whose top is in the band a little above the middle of the window. While the
 * reading is on screen the page carries `reading` (a phone then shows the button for the table of contents).
 */
export function useSpy(box: React.RefObject<HTMLElement | null>, deps: unknown[], onSpot?: (i: number) => void, parts = '.rd-s[data-i], .wt-minor[data-i]') {
  const [spot, setSpot] = useState(-1);
  const cb = useRef(onSpot);
  cb.current = onSpot;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setSpot(-1);
    const secs = [...el.querySelectorAll<HTMLElement>(parts)];
    let cur = -1;
    const io = new IntersectionObserver(es => {
      for (const e of es) e.target.toggleAttribute('data-in', e.isIntersecting);
      const vis = secs.filter(s => s.hasAttribute('data-in')).map(s => Number(s.dataset.i));
      if (!vis.length) return;
      const i = Math.min(...vis);
      if (i === cur) return;
      cur = i;
      setSpot(i);
      cb.current?.(i);
    }, { rootMargin: '-28% 0px -62% 0px' });
    secs.forEach(s => io.observe(s));
    const rd = el.querySelector('.rd') ?? el;
    const ro = new IntersectionObserver(es => document.body.classList.toggle('reading', es[0].isIntersecting), { rootMargin: '0px 0px -40% 0px' });
    ro.observe(rd);
    return () => { io.disconnect(); ro.disconnect(); document.body.classList.remove('reading'); cb.current?.(-1); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return spot;
}

/** the table of contents: by weight when the reading is weighed (what weighs little as one entry at the end) */
export function Toc({ ai, room, spot, label = t => t.subj, idp = 's', onJump }: {
  ai: AiReadingDto; room: RoomReading; spot: number; label?: (t: Title) => string; idp?: string; onJump?: () => void;
}) {
  const link = (i: number, cls = '') => {
    const s = ai.sections[i], t = parseTitle(s.title), added = isAdded(s);
    return (
      <a key={i} href={`#${idp}${i}`} className={[added ? 'added' : '', cls, i === spot ? 'on' : ''].filter(Boolean).join(' ')}
        onClick={e => { e.preventDefault(); onJump?.(); jump(`${idp}${i}`); }}>
        {room.emblem(s, t, added, true)}<span>{label(t)}</span>
      </a>
    );
  };
  const w = weighOf(ai);
  if (!w) return <>{ai.sections.map((_, i) => link(i))}</>;
  return <>
    {GROUPS.filter(g => w[g].length).map(g => <Fragment key={g}><div className={`toc-g w-${g}`}>{groupName(room, g)[0]}</div>{w[g].map(i => link(i, `w-${g}`))}</Fragment>)}
    {w.minor.length > 0 && (
      <a href={`#${idp}-minor`} className={`w-minor${w.minor.includes(spot) ? ' on' : ''}`} onClick={e => { e.preventDefault(); onJump?.(); jump(`${idp}-minor`); }}>
        <span className="wt-dash">–</span><span>Ít tác dụng ({w.minor.length})</span></a>
    )}
  </>;
}

/** the table of contents as a sheet from the bottom (on a phone, where it has no column of its own) */
function TocSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet toc-sheet" role="dialog" aria-label="Mục lục"><h4>Trong bài</h4><nav className="toc">{children}</nav></div>
    </div>,
    document.body,
  );
}

/**
 * The reading in three columns: the table of contents, the text, and a companion that follows what is being read
 * (the chart's figure for that section). Below 1180px the contents go to a button; below 900px the companion goes.
 */
export function ReadingLayout({ ai, room, companion, voices, fresh, old, top, foot, onSpot }: {
  ai: AiReadingDto; room: RoomReading; companion?: (i: number) => React.ReactNode; voices?: React.ReactNode;
  fresh?: string; old?: string; top?: React.ReactNode; foot?: React.ReactNode; onSpot?: (i: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const spot = useSpy(box, [ai.id], onSpot);
  const [sheet, setSheet] = useState(false);
  const w = weighOf(ai);
  /* before anything is read, the companion shows the first section that weighs */
  const first = w ? [...w.key, ...w.normal, ...w.current][0] ?? 0 : 0;
  return (
    <div ref={box}>
      <div className="rd-layout">
        <nav className="toc" aria-label="Mục lục"><h4>Trong bài</h4><Toc ai={ai} room={room} spot={spot} /></nav>
        <article className="rd">
          <Byline ai={ai} fresh={fresh} old={old} />
          {voices && <div className="voices">{voices}</div>}
          {top}
          <ReadingArticle ai={ai} room={room} />
          {ai.caution && <p className="caution">{ai.caution}</p>}
          {foot}
        </article>
        {companion && <aside className="companion">{companion(spot >= 0 ? spot : first)}</aside>}
      </div>
      <button type="button" className="toc-fab" onClick={() => setSheet(true)}>Mục lục</button>
      {sheet && <TocSheet onClose={() => setSheet(false)}><Toc ai={ai} room={room} spot={spot} onJump={() => setSheet(false)} /></TocSheet>}
    </div>
  );
}

// ── the Luận giải: the reading given to the person, in plain words, read first ──

/** the Luận giải's heading, who wrote it, and its parts: a part's title (what in life it is about), its paragraphs */
export function SummaryText({ ai, hl, title = 'Luận giải', sub, idp = 'nd', from = 'căn cứ ở phần Căn cứ' }: {
  ai: AiReadingDto; hl?: (t: string) => React.ReactNode; title?: string; sub: string; idp?: string; from?: string | null;
}) {
  const who = ai.author === 'claude' ? 'Claude viết trong phiên làm việc' : 'Viết bằng AI';
  return <>
    <header className="nd-h"><h2>{title}</h2><p className="nd-sub">{sub}</p></header>
    <div className="byline"><span><b>{who}</b>, ngày {dateVi(ai.createdAt)}</span>{from && <span>{from}</span>}
      {ai.stale && <span className="fresh old">lá số đã đổi từ lúc viết, nên viết lại</span>}</div>
    {ai.sections.map((s, i) => (
      <section key={i} className="nd-sec" id={`${idp}${i}`} data-i={i}>
        {s.title && <h3 className="nd-t">{s.title}</h3>}
        {s.items.map((it, j) => <p key={j} className="nd-p">{hl ? hl(it.text) : it.text}</p>)}
      </section>
    ))}
    {ai.caution && <p className="caution nd-caution">{ai.caution}</p>}
  </>;
}

/** the sections of the Căn cứ that govern the chart, each a way into it */
export function KeyLinks({ ai, room, onRead, emblem }: { ai: AiReadingDto | null | undefined; room: RoomReading; onRead: (i: number) => void; emblem?: (s: AiSectionDto) => React.ReactNode }) {
  if (!ai) return null;
  return <>{keysOf(ai).map(i => {
    const s = ai.sections[i], t = parseTitle(s.title);
    return <a key={i} href={`#s${i}`} onClick={e => { e.preventDefault(); onRead(i); }}>{emblem ? emblem(s) : room.emblem(s, t, isAdded(s), true)}<span>{t.subj}</span></a>;
  })}</>;
}

/**
 * The Luận giải in three columns: its parts (followed while reading), the text, and the way into the Căn cứ it rests
 * on. Below 1180px the first column goes; below 900px the last goes under.
 */
export function SummaryLayout({ ai, main, room, sub, onRead }: {
  ai: AiReadingDto; main: AiReadingDto | null; room: RoomReading; sub: string; onRead: (i: number | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const spot = useSpy(box, [ai.id], undefined, '.nd-sec[data-i]');
  return (
    <div className="nd-layout" ref={box}>
      <nav className="toc" aria-label="Trong bài"><h4>Trong bài</h4>{ai.sections.map((s, i) => (
        <a key={i} href={`#nd${i}`} className={i === spot ? 'on' : ''} onClick={e => { e.preventDefault(); jump(`nd${i}`); }}><span className="nd-num">{i + 1}</span><span>{s.title}</span></a>))}</nav>
      <div className="nd-main"><SummaryText ai={ai} hl={room.hl} sub={sub} from={main ? 'căn cứ ở phần Căn cứ' : null} /></div>
      <aside className="nd-aside">
        {keysOf(main).length > 0 && <nav className="toc"><h4>Căn cứ chính</h4><KeyLinks ai={main} room={room} onRead={onRead} /></nav>}
        {main && <button type="button" className="go" onClick={() => onRead(null)}>Xem phần Căn cứ ›</button>}
      </aside>
    </div>
  );
}
