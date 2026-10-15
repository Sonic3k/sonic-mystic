/* Tra cứu: find words anywhere in the notebooks, or ask what grandma wrote about a combination of stars in a palace. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PALACES } from '@mystic/engine/tuvi';
import type { SearchHitDto } from '@mystic/engine/api';
import { SOURCES, api } from '../../api';
import { Failed } from '../../components/Owner';
import { fold, useTitle } from '../../lib/text';
import { ruleHref } from './Reading';

const hitHref = (h: SearchHitDto) =>
  h.sourceCode === SOURCES.luan ? (h.entryCode === 'preface' ? '/tu-vi/phan-1#mo-dau' : `/tu-vi/sach/${h.entryRef}${h.passageRef !== null ? `#p${h.passageRef}` : ''}`)
    : h.sourceCode === SOURCES.phan1 ? '/tu-vi/phan-1' : null;

export default function Lookup() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const qq = (sp.get('q') ?? '').trim();
  const picked = (sp.get('sao') ?? '').split(',').filter(Boolean);
  const palace = sp.get('cung') ?? '';
  const [starQ, setStarQ] = useState('');
  useTitle('Tra cứu');
  useEffect(() => {
    const t = setTimeout(() => { const n = new URLSearchParams(sp); if (q.trim()) n.set('q', q.trim()); else n.delete('q'); setSp(n, { replace: true }); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const setList = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const toggle = (id: string) => setList('sao', (picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]).join(','));

  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog, staleTime: Infinity });
  const search = useQuery({ queryKey: ['search', qq, 150], queryFn: () => api.search(qq, 150), enabled: fold(qq).length >= 2, placeholderData: keepPreviousData });
  const combo = useQuery({ queryKey: ['lookup', picked.join(','), palace], queryFn: () => api.lookup(picked, palace || undefined), enabled: picked.length > 0 });
  const nameOf = (code: string) => catalog.data?.stars.find(s => s.code === code)?.name ?? code;

  const needle = fold(qq);
  const mark = (text: string) => {
    if (!needle) return text;
    const i = fold(text).indexOf(needle);
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark>{text.slice(i, i + needle.length)}</mark>{text.slice(i + needle.length)}</>;
  };
  const starList = (catalog.data?.stars ?? []).filter(s => !starQ || fold(s.name).includes(fold(starQ)) || s.aliases.some(a => fold(a).includes(fold(starQ))));
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>Tra cứu<small>trong sách của bà</small></h1></div>
      <div className="tv-read">
        <div className="tv-read-main">
          <div className="tv-search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm chữ: «con nuôi», «xuất ngoại», «Tử Phủ»…" autoFocus aria-label="Tìm chữ trong sách" /></div>
          {search.isError && <Failed error={search.error} />}
          {needle.length >= 2 && search.data && <div className="tv-k" style={{ marginBottom: 10 }}>{search.data.total} đoạn có chữ này{search.data.total > search.data.hits.length ? ` · hiện ${search.data.hits.length} đoạn đầu` : ''}</div>}
          {needle.length >= 2 && search.data?.hits.map(h => {
            const href = hitHref(h);
            const body = <><small>{h.sourceKind === 'family' ? '' : 'Bổ sung · '}{h.entryTitle}{h.section ? ` · cung ${h.section}` : ''}</small><p>{mark(h.text.replace(/^[-*•+]\s*/, ''))}</p></>;
            return href ? <Link key={h.passageId} className="tv-hit" to={href}>{body}</Link> : <div key={h.passageId} className="tv-hit bs">{body}</div>;
          })}
          {picked.length > 0 && (
            <>
              <div className="hd" style={{ marginTop: 28 }}><h2>Bà viết gì về {picked.map(nameOf).join(' + ')}{palace ? ` ở cung ${palace}` : ''}</h2><span>{combo.data ? `${combo.data.total} câu` : '…'}</span></div>
              {combo.isError && <Failed error={combo.error} />}
              {combo.data && !combo.data.rules.length && <div className="tv-empty">Không có câu nào nói tới đủ các sao này{palace ? ' ở cung này' : ''}.</div>}
              {combo.data?.rules.map(r => {
                const href = ruleHref(r);
                const where = r.at.map(a => (a === '*' ? 'mọi cung' : a)).join(', ');
                const body = <><small>{r.source === 'bo-sung' ? `Bổ sung · ${nameOf(r.star ?? '')}` : combo.data.entryTitles[String(r.entryRef)] ?? ''} · {where}</small><p>{r.ctx ? `(${r.ctx}) ` : ''}{r.text}</p></>;
                return href ? <Link key={r.code} className="tv-hit" to={href}>{body}</Link> : <div key={r.code} className="tv-hit bs">{body}</div>;
              })}
            </>
          )}
        </div>
        <div className="tv-read-side">
          <div className="tv-card">
            <h2>Tra theo tổ hợp sao</h2>
            <p>Chọn vài sao (và một cung nếu muốn) để xem mọi câu bà viết có đủ các sao ấy.</p>
            <select className="tv-input" value={palace} onChange={e => setList('cung', e.target.value)} style={{ marginBottom: 10 }}>
              <option value="">Mọi cung</option>{[...PALACES, 'Thân', 'Hạn'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="tv-input" value={starQ} onChange={e => setStarQ(e.target.value)} placeholder="Lọc tên sao…" />
            <div className="tv-pick">{starList.map(s => <button key={s.code} type="button" className={picked.includes(s.code) ? 'on' : ''} onClick={() => toggle(s.code)}>{s.name}</button>)}</div>
            {picked.length > 0 && <button type="button" className="tv-link" onClick={() => setList('sao', '')}>Bỏ chọn</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
