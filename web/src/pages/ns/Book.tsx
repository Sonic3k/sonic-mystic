/* Lê Đỗ Quỳnh Hương's book as it reads: the contents by part, and each section paragraph by paragraph, with the
   condition under which a paragraph speaks of a person (it then appears in that person's reading). */
import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TOPICS, describeWhen, figureOf, gridOf } from '@mystic/engine/numerology';
import type { NumerologyPassageDto, NumerologyTocEntryDto, TableDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { useTitle } from '../../lib/text';
import { NsGrid } from './Parts';
import { useNsBook } from './Reading';

const ROWN = [3, 6, 9, 2, 5, 8, 1, 4, 7];
const page = (body: React.ReactNode) => <div className="wrap page tv ns">{body}</div>;

export function NsBookIndex() {
  const book = useNsBook();
  useTitle('Sách · Nhân số học');
  const b = book.data;
  const kids = useMemo(() => {
    const m = new Map<string, NumerologyTocEntryDto[]>();
    for (const e of b?.toc ?? []) if (e.parent) { const l = m.get(e.parent) ?? []; l.push(e); m.set(e.parent, l); }
    return m;
  }, [b]);
  /* the paragraphs under an entry, its own and its sections' */
  const size = useMemo(() => {
    const n = new Map<string, number>();
    for (const e of [...(b?.toc ?? [])].reverse()) {
      n.set(e.code, (n.get(e.code) ?? 0) + e.passages);
      if (e.parent) n.set(e.parent, (n.get(e.parent) ?? 0) + (n.get(e.code) ?? 0));
    }
    return n;
  }, [b]);
  if (book.isError) return page(<Failed error={book.error} />);
  if (!b) return page(<div className="tv-empty">Đang mở sách…</div>);
  const tops = b.toc.filter(e => !e.parent);
  const front = tops.filter(e => e.code.startsWith('front.')), parts = tops.filter(e => e.kind === 'part'), back = tops.filter(e => !e.code.startsWith('front.') && e.kind !== 'part');
  const topicOfPart = new Map(TOPICS.map(t => [`p${t.part}`, t]));
  const card = (e: NumerologyTocEntryDto) => {
    const sub = kids.get(e.code) ?? [], n = size.get(e.code) ?? 0;
    return (
      <Link key={e.code} className="tv-entry-card" to={`/nhan-so-hoc/sach/${e.code}`}>
        <b>{e.title}</b>{sub.length > 0 && <p>{sub.map(x => x.title).join(' · ')}</p>}<small>{[e.page !== null ? `tr. ${e.page}` : '', n ? `${n} đoạn` : ''].filter(Boolean).join(' · ')}</small>
      </Link>
    );
  };
  return page(<>
    <div className="ptitle"><h1>{b.source.title}<small>{b.source.author}</small></h1></div>
    <p style={{ margin: '-14px 0 8px', color: 'var(--ink2)', fontSize: 14 }}>{b.source.description ? `${b.source.description}. ` : ''}Trang dẫn là trang của file PDF.</p>
    <p className="tv-muted" style={{ margin: '0 0 8px', fontSize: 12.5 }}>Sách in đã được soát với bản scan. Chỉ chủ nhà đọc được phần chữ của sách (bản quyền của tác giả).</p>
    {front.length > 0 && <section className="ns-part"><div className="ns-part-h"><h2>Đầu sách</h2></div><div className="tv-bookgrid">{front.map(card)}</div></section>}
    {parts.map(p => {
      const t = topicOfPart.get(p.code);
      return (
        <section key={p.code} className="ns-part">
          <div className="ns-part-h"><h2>{p.title}</h2>{p.page !== null && <span>tr. {p.page}</span>}{t && <span className="ns-topic">phần đọc: {t.title}</span>}</div>
          <div className="tv-bookgrid">{(kids.get(p.code) ?? []).length ? kids.get(p.code)!.map(card) : card(p)}</div>
        </section>
      );
    })}
    {back.length > 0 && <section className="ns-part"><div className="ns-part-h"><h2>Cuối sách</h2></div><div className="tv-bookgrid">{back.map(card)}</div></section>}
  </>);
}

export function NsBookEntry() {
  const { code = '' } = useParams();
  const [sp] = useSearchParams();
  const q = useQuery({ queryKey: ['ns-entry', code], queryFn: () => api.nsEntry(code), retry: false });
  const e = q.data;
  /* the paragraph a link points at: a passage of a reading (?cau=its rule) or a search hit (?doan=its id) */
  const doan = Number(sp.get('doan')) || null;
  const cau = sp.get('cau') ?? (doan && e ? e.sections.flatMap(s => s.passages).find(p => p.id === doan)?.rule?.code ?? null : null);
  const target = cau ? `p-${cau}` : doan ? `b${doan}` : null;
  useTitle(e ? `${e.title} · Nhân số học` : 'Sách · Nhân số học');
  /* a link to a paragraph opens the book there; another section opens at its top */
  useEffect(() => {
    if (!e) return;
    const el = target ? document.getElementById(target) : null;
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
    else window.scrollTo(0, 0);
  }, [e, target]);
  if (q.isError) return page(<Failed error={q.error}><Link className="tv-link" to="/nhan-so-hoc/sach">Về mục lục</Link></Failed>);
  if (!e) return page(<div className="tv-empty">Đang mở sách…</div>);
  const para = (p: NumerologyPassageDto) => {
    if (p.kind === 'figure') {
      const f = figureOf(p.text);
      let grid: React.ReactNode = null;
      if (f.grid) {
        const counts = Array(10).fill(0) as number[];
        f.grid.flat().forEach((s, i) => { const t = s.replace(/[()]/g, ''); if (/^\d+$/.test(t) && i < 9) counts[ROWN[i]] = t.length; });
        const g = gridOf(counts);
        grid = <NsGrid counts={counts} full={g.arrows} empty={g.empty} cell={40} />;
      }
      return <figure key={p.id} className={`ns-fig${doan === p.id ? ' hl' : ''}`} id={`b${p.id}`}>{grid}<figcaption><b>{f.caption ?? 'Hình'}</b>{f.notes ?? ''}{p.page !== null && <><br /><span className="tv-muted">tr. {p.page}</span></>}</figcaption></figure>;
    }
    const r = p.rule;
    const tag = p.role === 'advice' ? <span className="ns-tag adv">Lời khuyên</span> : p.role === 'child' ? <span className="ns-tag kid">Với trẻ nhỏ</span> : p.role === 'example' ? <span className="ns-tag ex">Ví dụ</span> : null;
    return (
      <div key={p.id} className={`tv-para role-${p.role}${(cau && r?.code === cau) || (!r && doan === p.id) ? ' hl' : ''}`} id={r ? `p-${r.code}` : `b${p.id}`}>
        {p.page !== null && <span className="ns-pg">{p.page}</span>}
        <p>{tag}{tag && ' '}{p.text}</p>
        {r && r.kind !== 'general' && <div className="ns-when">{describeWhen(r.when)}</div>}
      </div>
    );
  };
  const table = (t: TableDto) => (
    <div key={t.key} className="tv-table-wrap"><table className="tv-table">
      {t.title && <caption style={{ captionSide: 'top', textAlign: 'left', padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{t.title}</caption>}
      <thead><tr>{t.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>{t.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
  return page(<>
    <div className="ns-crumb"><Link to="/nhan-so-hoc/sach">Sách</Link>{e.path.slice(0, -1).map(x => <span key={x.code} style={{ display: 'contents' }}><span>›</span><Link to={`/nhan-so-hoc/sach/${x.code}`}>{x.title}</Link></span>)}</div>
    <div className="ptitle"><h1>{e.title}{e.page !== null && <small>tr. {e.page}</small>}</h1></div>
    <div className="tv-entry">
      <div className="tv-entry-text ns-text">
        {e.sections.map((s, i) => (
          <div key={s.code}>
            {i > 0 && (s.depth === 1 ? <h2 className="ns-h2" id={`s-${s.code}`}>{s.title}</h2> : <h3 className="ns-h3" id={`s-${s.code}`}>{s.title}</h3>)}
            {s.passages.map(para)}
            {s.tables.map(table)}
          </div>
        ))}
        {!e.sections.some(s => s.passages.length) && <div className="tv-empty">Mục này không có đoạn văn riêng; các phần bên trong ở mục lục.</div>}
        <div className="tv-pn">{e.prev ? <Link to={`/nhan-so-hoc/sach/${e.prev.code}`}>‹ {e.prev.title}</Link> : <span />}{e.next && <Link to={`/nhan-so-hoc/sach/${e.next.code}`}>{e.next.title} ›</Link>}</div>
      </div>
      <div className="tv-aside">
        {e.sections.length > 1 && <div className="ns-expl"><h4>Trong mục này</h4><nav className="ns-toc">{e.sections.slice(1).map(s => (
          <button key={s.code} type="button" style={{ paddingLeft: 8 + Math.max(0, s.depth - e.sections[0].depth - 1) * 14 }}
            onClick={() => document.getElementById(`s-${s.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{s.title}</button>))}</nav></div>}
        <div className="tv-bs"><h4>Đọc mục này thế nào</h4><p>Dưới mỗi đoạn nói về một người là điều kiện của nó, chữ tím: đoạn ấy chỉ hiện trong bài đọc của ai có con số đó. Đoạn ví dụ, cách tính và hình minh họa không vào bài đọc.</p></div>
      </div>
    </div>
  </>);
}
