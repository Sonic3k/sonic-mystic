/* Phần I — Lập lá số: grandma's own method for setting up a chart, the tables she copied, and the places where her
   way differs from the common books (the chart page can switch between the two). */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BRANCHES } from '@mystic/engine/tuvi';
import type { TableDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { useTitle } from '../../lib/text';
import { POS } from './Grid';

function T({ t, serifCols = [] }: { t: Pick<TableDto, 'columns' | 'rows'>; serifCols?: number[] }) {
  return (
    <div className="tv-table-wrap"><table className="tv-table">
      <thead><tr>{t.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k} className={serifCols.includes(k) ? 'serif' : ''}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

export default function Phan1() {
  const q = useQuery({ queryKey: ['setup'], queryFn: api.setup, staleTime: 600_000 });
  useTitle('Phần I · Lập lá số');
  useEffect(() => { if (q.data && location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView()); }, [q.data]);
  if (!q.data) return <div className="wrap page tv">{q.isError ? <Failed error={q.error} /> : <div className="card empty">Đang mở…</div>}</div>;
  const s = q.data;
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>Phần I<small>Lập lá số tử vi — ghi chép của bà</small></h1></div>
      <p className="tv-sub">{s.note}</p>

      {s.hoaGiap && <div className="tv-step"><h3>{s.hoaGiap.title ?? 'Lục thập hoa giáp'}</h3><T t={s.hoaGiap} serifCols={[1, 2, 3, 5]} /></div>}
      {s.steps.map(x => (
        <div key={x.code} className="tv-step">
          <h3>{x.title}</h3>
          {x.table && <T t={x.table} />}
          {x.lines.map((l, i) => <p key={i}>{l}</p>)}
          {x.appNote && <p className="tv-note-bs" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>Ghi chú của ứng dụng (không phải của bà): {x.appNote}</p>}
        </div>
      ))}

      <div className="tv-step">
        <h3>Vị trí của Tử Vi theo ngày sinh</h3>
        <p className="tv-muted" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>Năm bảng của bà, vẽ lại trên lá số. Ứng dụng đã đối chiếu: cả 150 ngày trong năm bảng đều khớp với cách an Tử Vi mà máy dùng.</p>
        <div className="tv-mini">{s.tuViTable.map(c => (
          <div key={c.cuc} className="tv-mini-grid">
            {BRANCHES.map((b, i) => <div key={b} style={{ gridRow: POS[i][0], gridColumn: POS[i][1] }}><b>{b}</b>{c.days[i].join(' · ')}</div>)}
            <div className="c">{c.name}</div>
          </div>
        ))}</div>
      </div>

      {s.triet && <div className="tv-step"><h3>{s.triet.title ?? 'An Triệt Lộ'}</h3><T t={s.triet} /></div>}

      <div className="tv-step" id="mo-dau">
        <h3>An Tuần, trung tinh, tiểu tinh, các vòng sao, tính hạn</h3>
        {s.preface.map((l, i) => <p key={i}>{l.replace(/\\-/g, '-').replace(/\\\)/g, ')')}</p>)}
      </div>

      <div className="tv-step" id="khac">
        <h3>Những chỗ bà an khác sách phổ thông</h3>
        <p className="tv-muted" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>Lá số mặc định an theo bà; nút «Theo sách» trên lá số đổi những chỗ này sang cách của sách.</p>
        <div className="tv-diff">{s.variants.map(d => (
          <div key={d.code}><b>{d.title}</b><p><span className="tv-voice ba">Bà</span> {d.primaryText}</p><p><span className="tv-voice bs">Sách</span> {d.alternativeText}</p></div>
        ))}</div>
      </div>
    </div>
  );
}
