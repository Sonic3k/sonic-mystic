/* The sources a Chiêm tinh reading quotes, as they read: each source's contents, and each section passage by passage,
   with the condition under which a passage speaks of a person (it then appears in that person's reading). */
import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { describeWhen } from '@mystic/engine/astrology';
import type { AstrologyPassageDto, AstrologyTocEntryDto, TableDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { VOICE, isCaps } from '../../lib/astro';
import { useTitle } from '../../lib/text';
import { useAstroBook } from './Home';

const page = (body: React.ReactNode) => <div className="wrap page tv as">{body}</div>;
const short = (code: string) => code.replace(/^astrology\./, '');
const voiceClass = (label: string | null) => (label === 'Woolfolk' ? 'wf' : label === 'Bản dịch Tierney' ? 'tie' : 'hk');
/** a section read whole on one page: the larger ones open as their contents */
const WHOLE = 160;

/** the passages under each entry, its own and its sections' */
function sizes(toc: AstrologyTocEntryDto[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const e of [...toc].reverse()) {
    n.set(e.code, (n.get(e.code) ?? 0) + e.passages);
    if (e.parent) n.set(e.parent, (n.get(e.parent) ?? 0) + (n.get(e.code) ?? 0));
  }
  return n;
}

export function AstroBookIndex() {
  const book = useAstroBook();
  useTitle('Tài liệu · Chiêm tinh');
  if (book.isError) return page(<Failed error={book.error} />);
  if (!book.data) return page(<div className="tv-empty">Đang mở tài liệu…</div>);
  const n = book.data.sources.length;
  return page(<>
    <div className="ptitle"><h1>Tài liệu</h1><span>{n === 6 ? 'Sáu' : n} tài liệu bài đọc dẫn từ</span></div>
    <div className="as-books">{book.data.sources.map(({ source: s, toc }) => <BookCard key={s.code} s={s} toc={toc} />)}</div>
  </>);
}

function BookCard({ s, toc }: { s: { code: string; title: string; author: string | null; translator: string | null; label: string | null; description: string | null; note: string | null }; toc: AstrologyTocEntryDto[] }) {
  const tops = toc.filter(e => !e.parent);
  const size = useMemo(() => sizes(toc), [toc]);
  const label = s.label ?? 'Lời cô';
  return (
    <div className="tv-card as-book">
      <h3>{s.title}</h3>
      <p>{s.author}{s.translator ? ` · ${s.translator} dịch` : ''} · <span className={`tv-voice ${voiceClass(label)}`}>{label}</span>{s.description && <><br />{s.description}</>}{s.note && <><br /><span className="tv-muted">{s.note}</span></>}</p>
      <nav className="ns-toc as-toc">{tops.map(e => (
        <Link key={e.code} to={`/chiem-tinh/sach/${short(s.code)}/${encodeURIComponent(e.code)}`}>{e.title}<small>{size.get(e.code) ?? 0}</small></Link>))}</nav>
    </div>
  );
}

export function AstroBookEntry() {
  const { source = '', code = '' } = useParams();
  const [sp] = useSearchParams();
  const book = useAstroBook();
  const toc = book.data?.sources.find(x => short(x.source.code) === source)?.toc;
  const size = useMemo(() => (toc ? sizes(toc) : null), [toc]);
  const shallow = !!size && (size.get(code) ?? 0) > WHOLE;
  const q = useQuery({ queryKey: ['astro-entry', source, code, shallow], queryFn: () => api.astroEntry(source, code, shallow), enabled: !!size || book.isError, retry: false });
  const e = q.data;
  /* the passage a link points at: a passage of a reading (?cau=its rule) or a search hit (?doan=its id) */
  const doan = Number(sp.get('doan')) || null;
  const cau = sp.get('cau') ?? (doan && e ? e.sections.flatMap(s => s.passages).find(p => p.id === doan)?.rule?.code ?? null : null);
  const target = cau ? `p-${cau}` : doan ? `b${doan}` : null;
  useTitle(e ? `${e.title} · Chiêm tinh` : 'Tài liệu · Chiêm tinh');
  useEffect(() => {
    if (!e) return;
    const el = target ? document.getElementById(target) : null;
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
    else window.scrollTo(0, 0);
  }, [e, target]);
  if (q.isError) return page(<Failed error={q.error}><Link className="tv-link" to="/chiem-tinh/sach">Về tài liệu</Link></Failed>);
  if (!e) return page(<div className="tv-empty">Đang mở tài liệu…</div>);
  const kids = (c: string) => (toc ?? []).filter(x => x.parent === c);
  const para = (p: AstrologyPassageDto) => {
    const r = p.rule;
    const on = (cau && r?.code === cau) || (!r && doan === p.id);
    return (
      <div key={p.id} className={`tv-para role-${p.role}${on ? ' hl' : ''}`} id={r ? `p-${r.code}` : `b${p.id}`}>
        {p.page !== null && <span className="ns-pg">{p.page}</span>}
        {p.items ? <ul className="as-items">{p.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          : <p>{p.label && <b style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>{p.label} </b>}{p.text}</p>}
        {p.en && <p className="as-en">{p.en}</p>}
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
  const label = e.source.label ?? 'Lời cô';
  /* whose words these are: the textbook's twelve signs are Tierney's, translated */
  const voices = new Set(e.sections.flatMap(s => s.passages.map(p => p.voice)).filter((v): v is NonNullable<typeof v> => !!v));
  const [vc, vl] = voices.size === 1 ? VOICE[[...voices][0]] : [voiceClass(label), label];
  const head = (t: string, cls: string, id: string) => <h2 className={`${cls}${isCaps(t) ? ' caps' : ''}`} id={id}>{t}</h2>;
  return page(<>
    <div className="ns-crumb"><Link to="/chiem-tinh/sach">Tài liệu</Link><span>›</span><span>{e.source.title}</span>
      {e.path.map(x => <span key={x.code} style={{ display: 'contents' }}><span>›</span><Link to={`/chiem-tinh/sach/${source}/${encodeURIComponent(x.code)}`}>{x.title}</Link></span>)}</div>
    <div className="ptitle"><h1 className={isCaps(e.title) ? 'caps' : ''}>{e.title}{e.page !== null && <small>tr. {e.page}</small>}</h1>
      <span><span className={`tv-voice ${vc}`}>{vl}</span></span></div>
    <div className="tv-entry">
      <div className="tv-entry-text ns-text">
        {e.sections.map((s, i) => (
          <div key={s.code}>
            {i > 0 && !shallow && head(s.title, s.depth === 1 ? 'ns-h2' : 'ns-h3', `s-${s.code}`)}
            {s.passages.map(para)}
            {s.tables.map(table)}
          </div>
        ))}
        {shallow && <div className="tv-bookgrid">{e.sections.slice(1).map(s => {
          const sub = kids(s.code);
          return (
            <Link key={s.code} className="tv-entry-card" to={`/chiem-tinh/sach/${source}/${encodeURIComponent(s.code)}`}>
              <b>{s.title}</b>{sub.length > 0 && <p>{sub.map(x => x.title).join(' · ')}</p>}<small>{[s.page !== null ? `tr. ${s.page}` : '', size?.get(s.code) ? `${size.get(s.code)} đoạn` : ''].filter(Boolean).join(' · ')}</small>
            </Link>);
        })}</div>}
        {!shallow && !e.sections.some(s => s.passages.length) && <div className="tv-empty">Mục này không có đoạn văn riêng.</div>}
        <div className="tv-pn">{e.prev ? <Link to={`/chiem-tinh/sach/${source}/${encodeURIComponent(e.prev.code)}`}>‹ {e.prev.title}</Link> : <span />}{e.next && <Link to={`/chiem-tinh/sach/${source}/${encodeURIComponent(e.next.code)}`}>{e.next.title} ›</Link>}</div>
      </div>
      <div className="tv-aside">
        {!shallow && e.sections.length > 1 && <div className="as-side"><h4>Trong mục này</h4><nav className="ns-toc">{e.sections.slice(1).map(s => (
          <button key={s.code} type="button" style={{ paddingLeft: 8 + Math.max(0, s.depth - 1) * 14 }}
            onClick={() => document.getElementById(`s-${s.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{s.title}</button>))}</nav></div>}
        <div className="tv-bs"><h4>Đọc mục này thế nào</h4><p>Dưới mỗi đoạn nói về một người là điều kiện của nó: đoạn ấy chỉ hiện trong bài đọc của ai có lá số như vậy. Đoạn của Woolfolk do Claude dịch, nguyên văn tiếng Anh in nghiêng ngay dưới.</p></div>
      </div>
    </div>
  </>);
}
