/* Grandma's notebook, readable as she wrote it: every star's entry, paragraph by paragraph, in her words.
   Under each paragraph, on request, how it was digitized — the condition the app checks against a chart.
   The words live in the database: a paragraph or a rule can be reworded here, and the imported text is kept. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LEVEL_NAME, type Level, type Tone } from '@mystic/engine/tuvi';
import type { CatalogDto, EntryDto, EntrySummaryDto, PassageDto, RuleDto } from '@mystic/engine/api';
import { SOURCES, api } from '../../api';
import { Failed, errorText } from '../../components/Owner';
import { useTitle } from '../../lib/text';
import { TONE_NAME } from './Reading';

type Star = CatalogDto['stars'][number];
const GROUPS: { title: string; pick: (s: Star) => boolean }[] = [
  { title: '14 chính tinh', pick: s => s.kind === 'chinh' },
  { title: 'Lục cát · Tứ hóa · Lộc Mã', pick: s => ['van_xuong', 'van_khuc', 'ta_phu', 'huu_bat', 'thien_khoi', 'thien_viet', 'hoa_loc', 'hoa_quyen', 'hoa_khoa', 'hoa_ky', 'loc_ton', 'thien_ma'].includes(s.code) },
  { title: 'Lục sát', pick: s => ['kinh_duong', 'da_la', 'hoa_tinh', 'linh_tinh', 'dia_khong', 'dia_kiep'].includes(s.code) },
  { title: 'Tuần · Triệt', pick: s => s.kind === 'khong' },
  { title: 'Vòng Lộc Tồn (Bác Sĩ)', pick: s => s.ring === 'loc' },
  { title: 'Vòng Thái Tuế', pick: s => s.ring === 'tue' },
  { title: 'Vòng Tràng Sinh', pick: s => s.ring === 'sinh' },
];
const LEVELS: Level[] = ['M', 'V', 'D', 'B', 'H'];
const strip = (t: string) => t.replace(/^[-*•+]\s*/, '');
const loading = (q: { isError: boolean; error: unknown }, what = 'Đang mở sách của bà…') =>
  <div className="wrap page tv">{q.isError ? <Failed error={q.error} /> : <div className="card empty">{what}</div>}</div>;

export function BookIndex() {
  const entries = useQuery({ queryKey: ['entries', SOURCES.notes], queryFn: () => api.entries(SOURCES.notes) });
  const supp = useQuery({ queryKey: ['entries', SOURCES.supplement], queryFn: () => api.entries(SOURCES.supplement) });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog, staleTime: Infinity });
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => api.sources() });
  useTitle('Sách của bà');
  if (!entries.data || !catalog.data) return loading(entries.isError ? entries : catalog);
  const notes = sources.data?.find(s => s.code === SOURCES.notes);
  const symbolEntries = entries.data.filter(e => e.kind === 'symbol');
  const byStar = new Map<string, EntrySummaryDto>();
  for (const e of symbolEntries) for (const s of e.symbols) if (!byStar.has(s)) byStar.set(s, e);
  const suppStars = new Set((supp.data ?? []).filter(e => e.kind === 'symbol').flatMap(e => e.symbols));
  const stars = catalog.data.stars, shown = new Set<number>();
  const rest = stars.filter(s => !GROUPS.some(g => g.pick(s)));
  const card = (s: Star) => {
    const e = byStar.get(s.code);
    if (!e) return suppStars.has(s.code) ? <div key={s.code} className="tv-entry-card missing"><b>{s.name}</b><p>Bà chưa viết mục này.</p><small>Có phần bổ sung trong lá số</small></div> : null;
    if (shown.has(e.id)) return null;
    shown.add(e.id);
    return (
      <Link key={s.code} className="tv-entry-card" to={`/tu-vi/books/${e.ref}`}>
        <b>{e.title}</b><p>{e.firstLine}</p><small>{e.passages} đoạn · {e.rules} câu luận{e.reviewNotes ? ` · ${e.reviewNotes} cần xem lại` : ''}</small>
      </Link>
    );
  };
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>Sách của bà<small>{notes?.title}</small></h1></div>
      <p className="tv-sub">{symbolEntries.length} mục sao, viết dở năm 2011. <b>Lời bà giữ nguyên</b> — chỉ sửa những chữ bị lỗi khi chuyển phông chữ cũ. {notes?.note}</p>
      <div className="tv-acts" style={{ marginBottom: 8 }}>
        <Link className="tv-btn ghost" to="/tu-vi/setup">Phần I · Lập lá số</Link>
        <Link className="tv-btn ghost" to="/tu-vi/lookup">Tìm trong sách</Link>
      </div>
      {GROUPS.map(g => (
        <section key={g.title}>
          <div className="hd tv-sec-h"><h2>{g.title}</h2></div>
          <div className="tv-bookgrid">{stars.filter(g.pick).map(card)}</div>
        </section>
      ))}
      <section><div className="hd tv-sec-h"><h2>Các sao khác</h2></div><div className="tv-bookgrid">{rest.map(card)}</div></section>
    </div>
  );
}

export function BookEntryPage() {
  const { ref = '' } = useParams(), loc = useLocation();
  const q = useQuery({ queryKey: ['entry', SOURCES.notes, ref], queryFn: () => api.entry(SOURCES.notes, ref), retry: false });
  const hash = Number(loc.hash.replace('#p', '')) || null;
  useTitle(q.data ? `${q.data.title} · Sách của bà` : 'Sách của bà');
  useEffect(() => { if (hash && q.data) requestAnimationFrame(() => document.getElementById(`p${hash}`)?.scrollIntoView({ block: 'center' })); }, [hash, q.data]);
  if (!q.data) return q.isError ? <div className="wrap page tv"><Failed error={q.error}><Link className="tv-link" to="/tu-vi/books">Về mục lục</Link></Failed></div> : loading(q);
  return <Entry e={q.data} hash={hash} />;
}

function Entry({ e, hash }: { e: EntryDto; hash: number | null }) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const saved = () => ['entry', 'entries', 'reading', 'search', 'lookup'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const { head, sections } = useMemo(() => {
    const head: PassageDto[] = [], body: PassageDto[] = [];
    let started = false;
    for (const p of e.passages) { if (!started && p.kind === 'meta') head.push(p); else { started = true; body.push(p); } }
    const sections: { sec: string; paras: PassageDto[] }[] = [];
    for (const p of body) {
      const label = p.section ?? '';
      if (!sections.length || sections[sections.length - 1].sec !== label) sections.push({ sec: label, paras: [] });
      sections[sections.length - 1].paras.push(p);
    }
    return { head, sections };
  }, [e]);
  const bright = e.symbols.filter(s => LEVELS.some(l => s.dignities[l]?.length));
  const nav = (x: EntryDto['prev'], dir: 'prev' | 'next') => {
    if (!x) return <span />;
    const to = x.code === 'preface' ? '/tu-vi/setup#preface' : `/tu-vi/books/${x.ref}`;
    return <Link to={to}>{dir === 'prev' ? `‹ ${x.code === 'preface' ? 'Mở đầu' : x.title}` : `${x.title} ›`}</Link>;
  };
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1 style={{ fontFamily: 'var(--serif)', fontWeight: 600 }}>{e.title}</h1>
        <span>mục {e.ordinal} · <Link className="tv-link" to="/tu-vi/books">mục lục</Link></span>
        <button type="button" className={`tv-btn ghost tv-edit-toggle ${editing ? 'on' : ''}`} onClick={() => setEditing(x => !x)}>{editing ? 'Xong sửa chữ' : 'Sửa chữ'}</button></div>
      {editing && <p className="tv-calwarn">Đang sửa chữ: mỗi đoạn và mỗi câu luận có nút «sửa». Chữ lúc nhập từ sách luôn được giữ lại để so và lấy lại; lần nhập sách sau không ghi đè chữ đã sửa.</p>}
      <div className="tv-entry">
        <div className="tv-entry-text">
          {(head.length > 0 || bright.length > 0) && (
            <div className="tv-meta">
              {head.map(p => <div key={p.id} id={p.ref !== null ? `p${p.ref}` : undefined}>{strip(p.text)}</div>)}
              {bright.map(s => (
                <div key={s.code} className="tv-bright">{e.symbols.length > 1 && <span className="B">{s.name}</span>}
                  {LEVELS.filter(l => s.dignities[l]?.length).map(l => <span key={l} className={l}>{LEVEL_NAME[l]}: {s.dignities[l].join(' ')}</span>)}</div>
              ))}
            </div>
          )}
          {sections.map((s, i) => (
            <div key={i}>
              {s.sec && <div className="tv-psec">Cung {s.sec}</div>}
              {s.paras.map(p => <Para key={p.id} p={p} hl={hash !== null && hash === p.ref} editing={editing} onSaved={saved} />)}
            </div>
          ))}
          <div className="tv-pn">{nav(e.prev, 'prev')}{nav(e.next, 'next')}</div>
        </div>
        <div className="tv-aside">
          <div className="tv-card" style={{ padding: '14px 16px' }}>
            <span className="tv-voice primary">Lời bà</span>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.55 }}>Mỗi đoạn được tách thành câu luận có điều kiện để so với lá số. Bấm số «câu luận» dưới đoạn để xem máy hiểu thế nào; đoạn nào có ghi chú «cần xem lại» là chỗ máy phải đoán ý bà.</p>
          </div>
          {e.supplement.map(x => (
            <aside key={x.symbol} className="tv-added-box">
              <h4><span className="tv-voice added">Bổ sung · {x.name}</span></h4>
              <small>Kiến thức tử vi phổ thông — không phải ghi chép của bà.</small>
              {x.about && <p>{x.about}</p>}
              {x.rules.map(r => <div key={r.code} className="added-line">{r.text}<small>{r.at.join(', ')}</small></div>)}
            </aside>
          ))}
        </div>
      </div>
    </div>
  );
}

function Para({ p, hl, editing, onSaved }: { p: PassageDto; hl: boolean; editing: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [orig, setOrig] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({ mutationFn: (t: string) => api.editPassage(p.id, t), onSuccess: () => { setDraft(null); onSaved(); } });
  const review = p.rules.filter(r => r.review).length;
  return (
    <div className={`tv-para ${hl ? 'hl' : ''}`} id={p.ref !== null ? `p${p.ref}` : undefined}>
      {draft !== null ? (
        <div className="tv-edit">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={Math.min(14, Math.ceil(draft.length / 64) + 1)} autoFocus />
          <div className="tv-edit-foot">
            {p.originalText && draft !== p.originalText && <button type="button" className="tv-link" onClick={() => setDraft(p.originalText!)}>Lấy lại chữ lúc nhập</button>}
            <span />
            <button type="button" className="tv-btn ghost" onClick={() => setDraft(null)}>Huỷ</button>
            <button type="button" className="tv-btn accent" disabled={save.isPending || !draft.trim() || draft === p.text} onClick={() => save.mutate(draft)}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
          {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
        </div>
      ) : (
        <p>{strip(p.text)}
          {p.originalText && <button type="button" className="tv-edited" onClick={() => setOrig(o => !o)} title="Xem chữ lúc nhập từ sách">đã sửa chữ</button>}
          {p.rules.length > 0
            ? <button type="button" className="n" onClick={() => setOpen(o => !o)}>{p.rules.length} câu luận{review ? ` · ${review} cần xem lại` : ''}</button>
            : <span className="n none">không luận</span>}
          {editing && <button type="button" className="n" onClick={() => setDraft(p.text)}>sửa</button>}
        </p>
      )}
      {orig && p.originalText && <div className="tv-orig"><b>Chữ lúc nhập từ sách:</b> {strip(p.originalText)}</div>}
      {open && <div className="tv-para-rules">{p.rules.map(r => <RuleRow key={r.code} r={r} editing={editing} onSaved={onSaved} />)}</div>}
    </div>
  );
}

const TONES: Tone[] = ['cat', 'hung', 'mixed', 'trung'];

function RuleRow({ r, editing, onSaved }: { r: RuleDto; editing: boolean; onSaved: () => void }) {
  const [d, setD] = useState<{ text: string; ctx: string; when: string; tone: Tone } | null>(null);
  const save = useMutation({
    mutationFn: () => api.editRule(r.code, { text: d!.text, context: d!.ctx.trim() || null, condition: d!.when.trim() || null, tone: d!.tone }),
    onSuccess: () => { setD(null); onSaved(); },
  });
  if (d) return (
    <div className="tv-rule tv-edit">
      <label><span>Câu luận</span><textarea value={d.text} onChange={e => setD({ ...d, text: e.target.value })} rows={Math.min(8, Math.ceil(d.text.length / 64) + 1)} autoFocus /></label>
      <div className="tv-row">
        <label><span>Ngữ cảnh (trong ngoặc)</span><input value={d.ctx} onChange={e => setD({ ...d, ctx: e.target.value })} /></label>
        <label style={{ flex: '0 0 130px' }}><span>Tính chất</span><select value={d.tone} onChange={e => setD({ ...d, tone: e.target.value as Tone })}>{TONES.map(t => <option key={t} value={t}>{TONE_NAME[t]}</option>)}</select></label>
      </div>
      <label><span>Điều kiện (máy kiểm với lá số)</span><input className="mono" value={d.when} onChange={e => setD({ ...d, when: e.target.value })} placeholder="để trống: chỉ giữ lời, không so với lá số" /></label>
      <div className="tv-edit-foot"><span />
        <button type="button" className="tv-btn ghost" onClick={() => setD(null)}>Huỷ</button>
        <button type="button" className="tv-btn accent" disabled={save.isPending || !d.text.trim()} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
    </div>
  );
  return (
    <div className="tv-rule">
      <em>«{r.ctx ? `(${r.ctx}) ` : ''}{r.text}»</em> — ở {r.at.map(t => (t === '*' ? 'mọi cung' : t)).join(', ')} · {TONE_NAME[r.tone]}{r.edited && <span className="tv-edited">đã sửa</span>}
      <br /><code>{r.when ?? 'không viết được điều kiện — chỉ giữ lời'}</code>
      {r.review && <><br /><b>Ghi chú:</b> {r.review}</>}
      {editing && <><br /><button type="button" className="tv-link" onClick={() => setD({ text: r.text, ctx: r.ctx ?? '', when: r.when ?? '', tone: r.tone })}>sửa câu này</button></>}
    </div>
  );
}
