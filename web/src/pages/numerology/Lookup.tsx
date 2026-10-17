/* What the book says of one number or several together (a ruling number, a number in the chart, an arrow, a peak…),
   and the book searched by its words. The choice is in the URL: ?symbol=ruling:9&symbol=arrow:1-5-9, ?q=… */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ARROWS, describeWhen, label as L } from '@mystic/engine/numerology';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { unitOf } from '../../lib/numerology';
import { fold, useTitle } from '../../lib/text';
import { useNumerologyBook } from './Reading';

const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22];
const short = (s: string | null) => (s ?? '').replace(/^Mũi tên /, '');
const GROUPS: [string, [string, string][]][] = [
  ['Con số chủ đạo', NUMS.filter(x => x !== 1).map(x => [`ruling:${x}`, L(x)])],
  ['Con số ngày sinh', NUMS.map(x => [`birthday:${x}`, L(x)])],
  ['Số trong biểu đồ', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(x => [`digit:${x}`, `Số ${x}`])],
  ['Mũi tên', ARROWS.map(a => [`arrow:${a.code}`, `${short(a.full)} ${a.code}`])],
  ['Mũi tên trống', ARROWS.filter(a => a.empty).map(a => [`empty-arrow:${a.code}`, `${short(a.empty)} ${a.code}`])],
  ['Con số linh hồn', NUMS.map(x => [`soul:${x}`, L(x)])],
  ['Con số biểu đạt', NUMS.map(x => [`expression:${x}`, L(x)])],
  ['Năm cá nhân', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(x => [`year:${x}`, String(x)])],
  ['Đỉnh cao mang số', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(x => [`peak:${x}`, String(x)])],
  ['Giai đoạn', [[1, 'Niên thiếu'], [2, 'Trưởng thành'], [3, 'Viên mãn']].map(([x, t]) => [`stage:${x}`, String(t)])],
];
const NAME = new Map(GROUPS.flatMap(([g, list]) => list.map(([code, t]) => [code, `${g} ${t}`] as const)));
const SHOWN = 30;
/** a figure is kept as «caption || grid || notes»: read as one line */
const plain = (t: string) => t.replace(/\s*\|\|\s*/g, ' · ').replace(/^ · /, '');

export default function NumerologyLookup() {
  const [sp, setSp] = useSearchParams();
  const want = sp.getAll('symbol');
  const q = sp.get('q') ?? '';
  const [text, setText] = useState(q);
  const toc = useNumerologyBook().data?.toc;
  const catalog = useQuery({ queryKey: ['numerology-catalog'], queryFn: api.numerologyCatalog, staleTime: 600_000, retry: false });
  const look = useQuery({ queryKey: ['numerology-lookup', want.join(',')], queryFn: () => api.numerologyLookup(want), enabled: want.length > 0, retry: false, placeholderData: keepPreviousData });
  const found = useQuery({ queryKey: ['numerology-search', q], queryFn: () => api.search(q, SHOWN, 'numerology'), enabled: q.trim().length >= 2, retry: false });
  const by = useMemo(() => new Map((toc ?? []).map(e => [e.code, e])), [toc]);
  const pathOf = (entry: string) => { const out: string[] = []; for (let e = by.get(entry); e; e = e.parent ? by.get(e.parent) : undefined) out.unshift(e.title); return out.slice(1); };
  useTitle('Tra cứu · Nhân số học');
  const count = new Map((catalog.data?.symbols ?? []).map(s => [s.code, s.rules]));
  const set = (symbols: string[], qq = q) => { const n = new URLSearchParams(); for (const s of symbols) n.append('symbol', s); if (qq.trim()) n.set('q', qq.trim()); setSp(n, { replace: true }); };
  const toggle = (code: string) => set(want.includes(code) ? want.filter(x => x !== code) : [...want, code]);
  const needle = fold(q.trim());
  const mark = (t: string) => {
    const f = fold(t), i = needle ? f.indexOf(needle) : -1;
    return i < 0 ? t : <>{t.slice(0, i)}<mark>{t.slice(i, i + needle.length)}</mark>{t.slice(i + needle.length)}</>;
  };
  const groups = look.data?.groups ?? [];
  const hits = want.length ? groups.reduce((n, g) => n + g.rules.length, 0) : 0;
  return (
    <div className="wrap page tv ns">
      <div className="ptitle"><h1>Tra cứu</h1></div>
      <p style={{ margin: '-14px 0 20px', color: 'var(--ink2)', fontSize: 14 }}>Chọn một hay vài con số để xem sách nói gì về chúng, hoặc tìm theo chữ.</p>
      <form className="tv-search" role="search" onSubmit={e => { e.preventDefault(); set(want, text); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Tìm trong sách, ví dụ: kim tự tháp, trách nhiệm" aria-label="Tìm trong sách" />
        <button className="tv-btn" type="submit">Tìm</button>
      </form>
      {needle.length >= 2 && (
        <section style={{ marginBottom: 28 }}>
          <div className="hd"><h2>Tìm “{q.trim()}”</h2><span>{found.data ? `${found.data.total} đoạn${found.data.total > found.data.hits.length ? `, hiện ${found.data.hits.length}` : ''}` : found.isError ? '' : 'đang tìm…'}</span></div>
          {found.isError && <Failed error={found.error} />}
          {found.data?.hits.map(h => (
            <Link key={h.passageId} className="tv-hit" to={`/numerology/books/${unitOf(h.entryCode, toc)}?passage=${h.passageId}`}>
              <small>{pathOf(h.entryCode).join(' › ') || h.entryTitle}</small><p>{mark(plain(h.text))}</p>
            </Link>))}
          {found.data && !found.data.hits.length && <div className="tv-empty">Không thấy trong sách.</div>}
        </section>
      )}
      {catalog.isError ? <Failed error={catalog.error} /> : (
        <div className="card" style={{ padding: '18px 20px' }}><div className="ns-pickers">{GROUPS.map(([t, list]) => {
          const shown = list.filter(([code]) => count.get(code));
          if (!shown.length && catalog.data) return null;
          return (
            <div key={t} className="ns-picker"><span>{t}</span><div className="tv-chips">{shown.map(([code, label]) => (
              <button key={code} type="button" className={`tv-chip${want.includes(code) ? ' on' : ''}`} aria-pressed={want.includes(code)} onClick={() => toggle(code)}>{label} <small>{count.get(code)}</small></button>))}
            </div></div>
          );
        })}</div></div>
      )}
      <section style={{ marginTop: 28 }}>
        <div className="hd"><h2>{want.length ? want.map(s => NAME.get(s) ?? s).join(' + ') : 'Chưa chọn con số nào'}</h2>
          <span>{want.length && look.data ? `${hits} đoạn · ${groups.length} mục` : ''}</span>
          {want.length > 0 && <button type="button" className="tv-link" style={{ marginLeft: 'auto' }} onClick={() => set([])}>Bỏ chọn</button>}</div>
        {look.isError && <Failed error={look.error} />}
        {want.length > 0 && look.data && !groups.length && <div className="tv-empty">Sách không có đoạn nào nói về {want.length > 1 ? 'tất cả những con số này cùng lúc' : 'con số này'}.</div>}
        {want.length > 0 && groups.map(g => {
          const path = pathOf(g.entry);
          return (
            <div key={g.entry} className="tv-group">
              <div className="tv-gh"><b>{path[path.length - 1] ?? g.title}</b>{path.length > 1 && <span>{path.slice(0, -1).join(' › ')}</span>}<Link to={`/numerology/books/${unitOf(g.entry, toc)}`}>Đọc trong sách ›</Link></div>
              <div className="tv-lines">{g.rules.map(r => (
                <div key={r.code} className={`ns-line ${r.kind}`}>
                  <p>{r.text}</p>
                  <div className="ns-why">{r.kind === 'advice' ? <span className="ns-tag adv">Lời khuyên</span> : r.kind === 'child' ? <span className="ns-tag kid">Với trẻ nhỏ</span> : null}
                    <span className="w">{describeWhen(r.when)}</span>
                    {r.page !== null && <Link to={`/numerology/books/${unitOf(r.entry, toc)}?rule=${encodeURIComponent(r.code)}`}>tr. {r.page}</Link>}</div>
                </div>))}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
