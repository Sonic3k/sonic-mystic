/* Every passage of the sources that speaks of a body, a sign, a house, an aspect, a structure — or of several together
   (Mặt Trăng ở Nhân Mã, Sao Kim ở cung 7, Mặt Trời – Sao Thổ vuông góc) — and the sources searched by their words.
   The choice is in the URL: ?sao=moon&dh=sagittarius, ?cung=7, ?goc=square, ?ct=t-square, ?q=… */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ASPECTS, BODY, PATTERN_NAME, SIGN, SIGNS, describeWhen, type BodyCode, type PatternKind } from '@mystic/engine/astrology';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { VOICE, isCaps } from '../../lib/astro';
import { fold, useTitle } from '../../lib/text';
import { bookLink } from './Parts';

const BODIES: BodyCode[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc', 'north-node', 'south-node', 'chiron', 'lilith', 'ziqi', 'fortune', 'vertex'];
const PATTERNS: PatternKind[] = ['t-square', 'grand-trine', 'grand-cross', 'yod', 'kite', 'stellium', 'grand-sextile', 'mystic-rectangle', 'hard-rectangle', 'minor-grand-trine'];
const name = (b: BodyCode) => (b === 'asc' ? 'Cung Mọc' : b === 'mc' ? 'MC' : BODY[b].name);
const SHOWN = 40;

/** the choice as the symbols every passage found must speak of */
function symbolsOf(sao: string[], dh: string | null, cung: string | null, goc: string | null, ct: string | null): string[] {
  const out: string[] = [];
  const [a, b] = sao as BodyCode[];
  if (a && b) out.push([a, b].sort().join('~'));
  else if (a && dh) out.push(`${a}@${dh}`);
  else if (a && cung) out.push(`${a}@h${cung}`);
  else if (a) out.push(`body:${a}`);
  if (dh && !(a && !b)) out.push(`sign:${dh}`);
  if (cung && !(a && !b && !dh)) out.push(`house:${cung}`);
  if (goc) out.push(`aspect:${goc}`);
  if (ct) out.push(`pattern:${ct}`);
  return out;
}

export default function AstroLookup() {
  const [sp, setSp] = useSearchParams();
  const sao = sp.getAll('sao').slice(0, 2), dh = sp.get('dh'), cung = sp.get('cung'), goc = sp.get('goc'), ct = sp.get('ct');
  const q = sp.get('q') ?? '';
  const [text, setText] = useState(q);
  const want = symbolsOf(sao, dh, cung, goc, ct);
  const catalog = useQuery({ queryKey: ['astro-catalog'], queryFn: api.astroCatalog, staleTime: 600_000, retry: false });
  const look = useQuery({ queryKey: ['astro-lookup', want.join(',')], queryFn: () => api.astroLookup(want), enabled: want.length > 0, retry: false, placeholderData: keepPreviousData });
  const found = useQuery({ queryKey: ['astro-search', q], queryFn: () => api.search(q, SHOWN, 'astrology'), enabled: q.trim().length >= 2, retry: false });
  useTitle('Tra cứu · Chiêm tinh');
  const count = new Map((catalog.data?.symbols ?? []).map(s => [s.code, s.rules]));
  const titleOf = (code: string) => catalog.data?.sources.find(s => s.code === code)?.title ?? code;
  const put = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const pick = (k: string, v: string, cur: string | null) => put(k, cur === v ? null : v);
  const toggleBody = (b: string) => {
    const n = new URLSearchParams(sp);
    const list = sao.includes(b) ? sao.filter(x => x !== b) : [...sao, b].slice(-2);
    n.delete('sao'); for (const x of list) n.append('sao', x);
    setSp(n, { replace: true });
  };
  const needle = fold(q.trim());
  const mark = (t: string) => {
    const f = fold(t), i = needle ? f.indexOf(needle) : -1;
    return i < 0 ? t : <>{t.slice(0, i)}<mark>{t.slice(i, i + needle.length)}</mark>{t.slice(i + needle.length)}</>;
  };
  const chips = (title: string, list: [string, string, string][], on: (v: string) => boolean, click: (v: string) => void) => (
    <div className="ns-picker"><span>{title}</span><div className="tv-chips">{list.filter(([v, , sym]) => !catalog.data || count.get(sym) || on(v)).map(([v, label, sym]) => (
      <button key={v} type="button" className={`tv-chip${on(v) ? ' on' : ''}`} aria-pressed={on(v)} onClick={() => click(v)}>{label}{count.get(sym) ? <small> {count.get(sym)}</small> : null}</button>))}</div></div>
  );
  const groups = look.data?.groups ?? [];
  const total = look.data?.total ?? 0;
  const named = [
    sao.length === 2 ? `${name(sao[0] as BodyCode)} – ${name(sao[1] as BodyCode)}` : sao[0] ? name(sao[0] as BodyCode) : null,
    dh ? `${sao.length === 1 ? 'ở ' : ''}${SIGN[dh as keyof typeof SIGN]?.name ?? dh}` : null,
    cung ? `${sao.length === 1 && !dh ? 'ở ' : ''}cung ${cung}` : null,
    goc ? ASPECTS.find(a => a.code === goc)?.name.toLowerCase() ?? goc : null,
    ct ? PATTERN_NAME[ct as PatternKind] ?? ct : null,
  ].filter(Boolean).join(' ');
  return (
    <div className="wrap page tv as">
      <div className="ptitle"><h1>Tra cứu</h1><span>Mọi đoạn tài liệu nói về một sao, một dấu hiệu, một cung, một góc chiếu, một cấu trúc</span></div>
      <form className="tv-search" role="search" onSubmit={e => { e.preventDefault(); put('q', text.trim() || null); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Tìm trong tài liệu, ví dụ: lập dị, tự do" aria-label="Tìm trong tài liệu" />
        <button className="tv-btn" type="submit">Tìm</button>
      </form>
      {needle.length >= 2 && (
        <section style={{ marginBottom: 28 }}>
          <div className="hd"><h2>Tìm “{q.trim()}”</h2><span>{found.data ? `${found.data.total} đoạn${found.data.total > found.data.hits.length ? `, hiện ${found.data.hits.length}` : ''}` : found.isError ? '' : 'đang tìm…'}</span></div>
          {found.isError && <Failed error={found.error} />}
          {found.data?.hits.map(h => (
            <Link key={h.passageId} className="tv-hit" to={`/chiem-tinh/sach/${h.sourceCode.replace(/^astrology\./, '')}/${encodeURIComponent(h.entryCode)}?doan=${h.passageId}`}>
              <small>{titleOf(h.sourceCode)} › {h.entryTitle}</small><p>{mark(h.text)}</p>
            </Link>))}
          {found.data && !found.data.hits.length && <div className="tv-empty">Không thấy trong tài liệu.</div>}
        </section>
      )}
      {catalog.isError ? <Failed error={catalog.error} /> : (
        <div className="tv-card"><div className="ns-pickers">
          {chips('Sao / điểm', BODIES.map(b => [b, name(b), `body:${b}`]), v => sao.includes(v), toggleBody)}
          {chips('Dấu hiệu', SIGNS.map(s => [s.code, s.name, `sign:${s.code}`]), v => dh === v, v => pick('dh', v, dh))}
          {chips('Cung địa bàn', Array.from({ length: 12 }, (_, i) => [String(i + 1), `Cung ${i + 1}`, `house:${i + 1}`]), v => cung === v, v => pick('cung', v, cung))}
          {chips('Góc chiếu', ASPECTS.map(a => [a.code, a.name, `aspect:${a.code}`]), v => goc === v, v => pick('goc', v, goc))}
          {chips('Cấu trúc', PATTERNS.map(p => [p, PATTERN_NAME[p], `pattern:${p}`]), v => ct === v, v => pick('ct', v, ct))}
        </div></div>
      )}
      <section style={{ marginTop: 28 }}>
        <div className="hd"><h2>{want.length ? named : 'Chưa chọn gì'}</h2><span>{want.length && look.data ? `${total} đoạn · ${groups.length} mục` : ''}</span>
          {want.length > 0 && <button type="button" className="tv-link" style={{ marginLeft: 'auto' }} onClick={() => { const n = new URLSearchParams(); if (q) n.set('q', q); setSp(n, { replace: true }); }}>Bỏ chọn</button>}</div>
        {look.isError && <Failed error={look.error} />}
        {want.length > 0 && look.data && !groups.length && <div className="tv-empty">Tài liệu không có đoạn nào nói về {want.length > 1 || sao.length === 2 ? 'tất cả những điều này cùng lúc' : 'điều này'}.</div>}
        {want.length > 0 && groups.map(g => {
          const r0 = g.rules[0], path = g.path.slice(0, -1);
          return (
            <div key={`${g.source}|${g.entry}`} className="tv-group as-group">
              <div className="tv-gh"><b className={isCaps(g.title) ? 'caps' : ''}>{g.title}</b>{r0 && <span className={`v ${r0.voice}`}>{VOICE[r0.voice][1]}</span>}<span>{[titleOf(g.source), ...path].join(' › ')}</span>
                <Link to={bookLink(g.source, g.entry)}>Đọc trong tài liệu ›</Link></div>
              <div className="tv-lines">{g.rules.map(r => (
                <div key={r.code} className={`as-line ${r.voice}`}>
                  {r.items ? <ul>{r.items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>{r.label && <b className="lb">{r.label}</b>}{r.text}</p>}
                  <div className="as-why"><span>{describeWhen(r.when)}</span>{r.page !== null && <Link to={bookLink(r.source, r.entry, r.code)}>tr. {r.page}</Link>}</div>
                </div>))}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
