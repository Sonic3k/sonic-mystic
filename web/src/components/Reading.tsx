/* A written reading (the synthesis Claude or the AI wrote for a profile), one shape for every room: a table of
   contents beside it, a measure that reads easily, each section's subject and its key words first, the source's
   own words one tap away under each paragraph, and what is added (not the source's) set apart in its own voice.
   Each room brings its emblems, its highlights and how its sources are named. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AiItemDto, AiReadingDto, AiSectionDto } from '@mystic/engine/api';
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
}

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

/** one section: its emblem, its subject and key words, the paragraphs, the added ones gathered under their label */
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
    <section className="rd-s" id={`${idp}${i}`} data-i={i}>
      <header className="rd-h">
        <div className="rd-em">{room.emblem(s, t, isAdded(s), false)}</div>
        <div><h2>{t.subj}</h2>
          {t.keys.length > 0 && <div className="rd-keys">{t.keys.map((k, n) => room.keyChip ? <Fragment key={n}>{room.keyChip(k, n)}</Fragment> : <span key={n} className="key">{k}</span>)}</div>}</div>
      </header>
      {body}
    </section>
  );
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

export const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * The section being read: the first one whose top is in the band a little above the middle of the window. While
 * the reading is on screen the page carries `reading` (a phone then shows the button for the table of contents).
 */
export function useSpy(box: React.RefObject<HTMLElement | null>, deps: unknown[], onSpot?: (i: number) => void) {
  const [spot, setSpot] = useState(-1);
  const cb = useRef(onSpot);
  cb.current = onSpot;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setSpot(-1);
    const secs = [...el.querySelectorAll<HTMLElement>('.rd-s[data-i]')];
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

export function Toc({ ai, room, spot, label = t => t.subj, idp = 's', onJump }: {
  ai: AiReadingDto; room: RoomReading; spot: number; label?: (t: Title) => string; idp?: string; onJump?: () => void;
}) {
  return <>{ai.sections.map((s, i) => {
    const t = parseTitle(s.title), added = isAdded(s);
    return (
      <a key={i} href={`#${idp}${i}`} className={[added ? 'added' : '', i === spot ? 'on' : ''].join(' ')}
        onClick={e => { e.preventDefault(); onJump?.(); jump(`${idp}${i}`); }}>
        {room.emblem(s, t, added, true)}<span>{label(t)}</span>
      </a>
    );
  })}</>;
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
  return (
    <div ref={box}>
      <div className="rd-layout">
        <nav className="toc" aria-label="Mục lục"><h4>Trong bài</h4><Toc ai={ai} room={room} spot={spot} /></nav>
        <article className="rd">
          <Byline ai={ai} fresh={fresh} old={old} />
          {voices && <div className="voices">{voices}</div>}
          {top}
          {ai.sections.map((s, i) => <Section key={i} s={s} i={i} room={room} />)}
          {ai.caution && <p className="caution">{ai.caution}</p>}
          {foot}
        </article>
        {companion && <aside className="companion">{companion(Math.max(0, spot))}</aside>}
      </div>
      <button type="button" className="toc-fab" onClick={() => setSheet(true)}>Mục lục</button>
      {sheet && <TocSheet onClose={() => setSheet(false)}><Toc ai={ai} room={room} spot={spot} onJump={() => setSheet(false)} /></TocSheet>}
    </div>
  );
}
