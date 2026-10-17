/* One person's chart and what cô Hương Kiều's materials, the class's Tierney and Woolfolk say of it: the board, then
   three tabs — the synthesis Claude wrote (Tổng hợp), the sources' passages part by part (Luận giải), and the detail
   of the chart (Lá số chi tiết). Opened from a link (/astrology/view?…) or a saved profile (/astrology/profile/:id). */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BODY, LEVEL_NAME, SIGN, type Topic } from '@mystic/engine/astrology';
import type { AiReadingDto, AstrologyReadingDto, AstrologySectionDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { SONIC_HUB } from '../../lib/people';
import { PART_ORDER, PART_TITLE, SAMPLE_LABEL, VOICE, astroRequest, dm, fromAstroSearch, isSample, latLonText, offsetText, toAstroSearch } from '../../lib/astro';
import { dateVi, useTitle } from '../../lib/text';
import { Board, Detail, Groups, Side, said } from './Parts';
import { AstroProfileSheet, AstroSaveSheet } from './Sheets';

type Tab = 'synthesis' | 'reading' | 'chart';
const page = (body: React.ReactNode) => <div className="wrap page tv as">{body}</div>;

/** a chart opened from a link: the birth is in the URL */
export function AstroViewPage() {
  const [sp, setSp] = useSearchParams();
  const params = fromAstroSearch(sp);
  const key = params ? toAstroSearch(params) : '';
  const reading = useQuery({ queryKey: ['astro-reading', key], queryFn: () => api.astroReading(astroRequest(params!)), enabled: !!params, retry: false, placeholderData: keepPreviousData });
  const [saving, setSaving] = useState(false);
  useTitle(params?.name || 'Chiêm tinh');
  if (!params) return page(<div className="tv-empty">Thiếu ngày sinh. <Link className="tv-link" to="/astrology">Lập lá số</Link></div>);
  const back = `/astrology?${key}${sp.get('person') ? `&person=${sp.get('person')}` : ''}`;
  if (reading.isError) return page(<Failed error={reading.error}><Link className="tv-link" to={back}>Sửa ngày giờ</Link></Failed>);
  if (!reading.data) return page(<div className="tv-empty">Đang lập lá số…</div>);
  const sample = isSample(params.birth);
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={null} written={null} defTab="reading"
        title={params.name || 'Lá số chiêm tinh'} tags={sample ? [SAMPLE_LABEL] : []} gender={params.gender}
        actions={<>
          <Link className="tv-btn ghost" to={back}>Sửa ngày giờ</Link>
          <button type="button" className="tv-btn accent" onClick={() => setSaving(true)}>Lưu hồ sơ</button>
        </>} />
      {saving && <AstroSaveSheet params={params} subjectId={sp.get('person')} onClose={() => setSaving(false)} />}
    </>
  );
}

/** a saved profile: the birth as it was saved, and the synthesis written for it */
export function AstroProfilePage() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const profile = useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id), retry: false });
  const ok = profile.data?.discipline === 'astrology';
  const reading = useQuery({ queryKey: ['astro-profile-reading', id], queryFn: () => api.astroProfileReading(id), enabled: ok, retry: false });
  const written = useQuery({ queryKey: ['ai-readings', id], queryFn: () => api.aiReadings(id), enabled: ok, retry: false });
  const [editing, setEditing] = useState(false);
  const p = profile.data;
  useTitle(p ? p.subject.displayName : 'Chiêm tinh');
  const back = <Link className="tv-link" to="/astrology">Chiêm tinh</Link>;
  if (profile.isError) return page(<Failed error={profile.error}>{back}</Failed>);
  if (p && !ok) return page(<div className="tv-empty">Đây không phải hồ sơ chiêm tinh. <Link className="tv-link" to={`/people/${p.subject.id}`}>Mở trang người</Link></div>);
  if (reading.isError) return page(<Failed error={reading.error}>{back}</Failed>);
  if (!p || !reading.data || written.isPending) return page(<div className="tv-empty">Đang mở hồ sơ…</div>);
  const sum = (written.data ?? []).filter(w => w.scope === 'synthesis').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={p} written={sum} defTab={sum ? 'synthesis' : 'reading'}
        title={p.subject.displayName} tags={[p.label].filter((x): x is string => !!x)} gender={p.gender}
        actions={<button type="button" className="tv-btn ghost" onClick={() => setEditing(true)}>Sửa hồ sơ</button>} />
      {editing && <AstroProfileSheet profile={p} onClose={() => setEditing(false)} />}
    </>
  );
}

function ReadingView({ r, sp, setSp, profile, written, defTab, title, tags, gender, actions }: {
  r: AstrologyReadingDto; sp: URLSearchParams; setSp: ReturnType<typeof useSearchParams>[1];
  profile: ProfileDto | null; written: AiReadingDto | null; defTab: Tab;
  title: string; tags: string[]; gender: ProfileDto['gender']; actions: React.ReactNode;
}) {
  const ch = r.chart, i = ch.input;
  const tab = (['synthesis', 'reading', 'chart'].includes(sp.get('view') ?? '') ? sp.get('view') : defTab) as Tab;
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } setSp(n, { replace: true }); };
  const [hl, setHl] = useState<string | null>(null);
  /* a passage cited by the synthesis is shown where the reading has it, once that tab has been drawn */
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollTo.current ? document.getElementById(scrollTo.current) : null;
    if (el) { scrollTo.current = null; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  const g = gender === 'female' ? 'Nữ' : gender === 'male' ? 'Nam' : '';
  const time = i.local.hour !== null && i.local.minute !== null ? `${String(i.local.hour).padStart(2, '0')}:${String(i.local.minute).padStart(2, '0')}` : null;
  const born = `sinh ${i.local.day}/${i.local.month}/${i.local.year}${time ? ` lúc ${time} (${offsetText(r.offsetMinutes)})` : ' · chưa có giờ sinh'}`;
  const place = i.place ? `${i.place.name ?? 'nơi sinh'} (${latLonText(i.place.latitude, i.place.longitude)})` : 'chưa có nơi sinh';
  const w = r.window, asc = ch.placements.asc;
  const notes = [...new Set([...r.notes, ...ch.notes])];
  const goTo = (code: string) => {
    const s = r.sections.find(x => x.groups.some(gr => gr.matches.some(m => m.rule === code)));
    if (!s) return;
    const list = sectionsOf(r, s.topic);
    const k = Math.max(0, list.indexOf(s));
    set({ view: defTab === 'reading' ? null : 'reading', part: s.topic === 'sun' ? null : s.topic, item: k ? String(k) : null });
    setHl(code);
    scrollTo.current = `r-${code}`;
  };
  return (
    <div className="wrap page tv as">
      <div className="tv-chart-head">
        <div>
          <h1>{title}{tags.map(t => <span key={t} className="hh-tag">{t}</span>)}</h1>
          <p>{[g, born, place].filter(Boolean).join(' · ')}</p>
          {profile && <p className="tv-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            <Link className="tv-link" to={`/people/${profile.subject.id}`}>{profile.subject.displayName}</Link>
            {profile.subject.links.some(l => l.system === SONIC_HUB) && <> · <span className="tv-linked">liên kết Sonic Hub</span></>}
            {profile.note && <> · {profile.note}</>}
          </p>}
        </div>
        <div className="acts">{actions}</div>
      </div>
      {w && <div className="as-window">Lá số giữ nguyên cung Mọc, cung hoàng đạo của Mặt Trăng và cung địa bàn của mọi hành tinh nếu giờ sinh trong khoảng <b>{w.from} – {w.to}</b>{w.after < 10 || w.before < 10
        ? asc && (asc.deg >= 28.5 || asc.deg <= 1.5) ? ` — cung Mọc đang ở ${dm(asc.lon)} ${SIGN[asc.sign].name}, sát chỗ đổi cung: giờ sinh lệch vài phút là lá số khác` : ' — giờ sinh lệch vài phút là lá số khác'
        : ''}.</div>}
      {notes.map(n => <div key={n} className="as-note">{n}</div>)}

      <Board ch={ch} />

      <div className="tv-tabs" id="doc">
        <div className="seg" role="tablist" aria-label="Phần đọc">
          {([['synthesis', 'Tổng hợp'], ['reading', 'Luận giải'], ['chart', 'Lá số chi tiết']] as const).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set({ view: k === defTab ? null : k })}>{t}</button>))}
        </div>
        <span className="tv-voice hk">Lời cô</span><span className="tv-voice tie">Bản dịch Tierney</span><span className="tv-voice wf">Woolfolk · Claude dịch</span><span className="tv-voice ai">Claude luận thêm — không phải lời cô</span>
        <span className="tv-caution">Chiêm tinh để tham khảo, chiêm nghiệm: lá số chỉ khuynh hướng, không định đoạt.</span>
      </div>
      {tab === 'synthesis' && <SumTab r={r} written={written} profile={profile} onGoTo={goTo} />}
      {tab === 'reading' && <ReadingTab r={r} part={sp.get('part')} focus={Number(sp.get('item')) || 0} hl={hl}
        setPart={t => set({ part: t === 'sun' ? null : t, item: null })} setFocus={k => set({ item: k ? String(k) : null })} />}
      {tab === 'chart' && <Detail ch={ch} />}
    </div>
  );
}

/** a part's sections, as the strip of chips shows them (the dominant part's introduction is its side) */
const sectionsOf = (r: AstrologyReadingDto, t: Topic) => r.sections.filter(s => s.topic === t && (t !== 'dominant' || !!s.focus));

// ── Luận giải ──

function chipOf(s: AstrologySectionDto, r: AstrologyReadingDto): React.ReactNode {
  const f = s.focus ?? '';
  if (s.topic === 'planet') {
    const b = Object.values(BODY).find(x => f.startsWith(`${x.name} `));
    const p = b ? r.chart.placements[b.code] : undefined;
    return <><span className="g">{b ? `${b.glyph}︎` : ''}</span>{b?.name ?? f}{p && <small>{SIGN[p.sign].name}</small>}</>;
  }
  if (s.topic === 'house') { const m = /^Cung (\d+) · nóc (\S+(?: \S+)?)/.exec(f); return m ? <>Cung {m[1]} <small>{m[2].replace(/ \d.*$/, '')}</small></> : f; }
  if (s.topic === 'sign') return f.split(' — ')[0];
  if (s.topic === 'pattern') return f.split(':')[0];
  if (s.topic === 'dominant') return f.replace(/ điểm.*$/, '');
  if (s.topic === 'point') return f.split(' ở ')[0];
  return f;
}

const HEAD: Partial<Record<Topic, string>> = { sun: 'Mặt Trời', moon: 'Mặt Trăng', asc: 'Cung Mọc', love: 'Mặt Trời trong tình yêu', aspect: 'Góc chiếu' };
const FOCUS_IS_TITLE: Topic[] = ['planet', 'house', 'pattern', 'dominant', 'point'];

function ReadingTab({ r, part, focus, hl, setPart, setFocus }: {
  r: AstrologyReadingDto; part: string | null; focus: number; hl: string | null; setPart: (t: Topic) => void; setFocus: (k: number) => void;
}) {
  const parts = PART_ORDER.filter(t => r.sections.some(s => s.topic === t));
  const t = (parts.includes(part as Topic) ? part : parts[0]) as Topic;
  const ss = sectionsOf(r, t);
  const intro = t === 'dominant' ? r.sections.find(s => s.topic === 'dominant' && !s.focus) : undefined;
  const fi = Math.min(focus, Math.max(0, ss.length - 1));
  const sec = ss[fi];
  const titleOf = (code: string) => r.sources.find(s => s.code === code)?.title ?? code;
  const count = (k: Topic) => r.sections.filter(s => s.topic === k).reduce((n, s) => n + said(s, r.rules), 0);
  const head = FOCUS_IS_TITLE.includes(t) ? (sec?.focus ?? PART_TITLE[t]) : HEAD[t] ?? (sec?.focus?.split(' — ')[0] ?? PART_TITLE[t]);
  const test = t === 'dominant' && sec ? r.chart.dominant.tests.find(x => BODY[x.body].name === sec.focus?.split(':')[0]) : undefined;
  if (!parts.length) return <div className="tv-empty">Tài liệu không có đoạn nào khớp với lá số này.</div>;
  return (
    <>
      <div className="tv-strip">{parts.map(k => <button key={k} type="button" className={k === t ? 'on' : ''} onClick={() => setPart(k)}>{PART_TITLE[k]}<small>{count(k)}</small></button>)}</div>
      {ss.length > 1 && <div className="as-sub">{ss.map((s, k) => <button key={k} type="button" className={k === fi ? 'on' : ''} onClick={() => setFocus(k)}>{chipOf(s, r)}</button>)}</div>}
      <div className="tv-read">
        <div className="tv-read-main">
          <div className="tv-phead"><h3>{head}</h3>{sec?.focus && !FOCUS_IS_TITLE.includes(t) && <span>{sec.focus}</span>}</div>
          {test && <p className="ns-note" style={{ background: 'var(--primary-soft)', color: '#18504C' }}>{BODY[test.body].name} được <b>{test.total} điểm</b> trong bài test của cô ({LEVEL_NAME[test.level]}). Từng dòng được cộng điểm ở “Lá số chi tiết”.</p>}
          {sec ? <Groups sec={sec} rules={r.rules} hl={hl} /> : <div className="tv-empty">Tài liệu không có đoạn nào khớp ở phần này.</div>}
        </div>
        <div className="tv-read-side"><Side sec={intro ?? sec} topic={t} rules={r.rules} titleOf={titleOf} /></div>
      </div>
    </>
  );
}

// ── Tổng hợp ──

function SumTab({ r, written, profile, onGoTo }: { r: AstrologyReadingDto; written: AiReadingDto | null; profile: ProfileDto | null; onGoTo: (code: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const counts = <div className="as-side"><h4>Tài liệu nói về người này</h4>{PART_ORDER.filter(t => r.sections.some(s => s.topic === t)).map(t => (
    <p key={t} className="row"><span>{PART_TITLE[t]}</span><b>{r.sections.filter(s => s.topic === t).reduce((n, s) => n + said(s, r.rules), 0)}</b></p>))}</div>;
  if (!written) {
    return (
      <div className="tv-read">
        <div className="tv-read-main"><div className="tv-empty">{profile
          ? 'Chưa có bài tổng hợp cho người này. Bài tổng hợp do Claude viết từ những đoạn khớp ở phần Luận giải — phần tóm lược chỉ kể lại lời cô, Tierney và Woolfolk, mỗi ý dẫn số đoạn; phần luận thêm theo cách tổ hợp từ khóa của cô (chủ thể – cách thức – nơi chốn, mẫu câu cho từng cung địa bàn) và ghi rõ là Claude luận thêm. Khi có, bài hiện ở đây.'
          : 'Bài tổng hợp được viết cho hồ sơ đã lưu: lưu hồ sơ này, rồi Claude viết bài từ những đoạn khớp ở phần Luận giải — phần tóm lược chỉ kể lại lời cô, Tierney và Woolfolk, mỗi ý dẫn số đoạn; phần luận thêm theo cách tổ hợp từ khóa của cô (mẫu câu cho từng cung địa bàn) và ghi rõ là Claude luận thêm. Khi có, bài hiện ở đây.'}</div></div>
        <div className="tv-read-side">{counts}</div>
      </div>
    );
  }
  const who = written.author === 'ai' ? 'AI' : 'Claude';
  const matched = r.sections.reduce((n, s) => n + s.groups.reduce((k, gr) => k + gr.matches.length, 0), 0);
  /* where a cited passage sits: its heading in the source */
  const placeOf = (code: string) => { for (const s of r.sections) for (const gr of s.groups) if (gr.matches.some(m => m.rule === code)) return [...gr.path.slice(1)].join(' › ') || gr.title; return ''; };
  return (
    <div className="tv-read">
      <div className="tv-read-main">
        <div className="ns-sum-head">
          <span className="tv-voice hk">Tóm lược tài liệu</span><span className="tv-voice ai">{who} luận thêm</span>
          <span>{who} viết ngày {dateVi(written.createdAt)} · từ {matched} đoạn khớp</span>
          <span className={`ns-ok${written.stale ? ' old' : ''}`}>{written.stale ? 'hồ sơ đã đổi từ khi viết' : 'còn khớp với hồ sơ'}</span>
        </div>
        {written.sections.map((sec, si) => (
          <div key={si} className="ns-sum"><h3 id={`sum-${si}`}>{sec.title}</h3>
            {sec.items.map((it, ii) => {
              const id = `${si}-${ii}`, isOpen = open.has(id);
              const toggle = () => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
              const refs = it.refs.length > 0 && <span className="ns-refs">{it.refs.map((ref, j) => <button key={ref.code} type="button" aria-expanded={isOpen} aria-label="Xem đoạn được dẫn" onClick={toggle}>{j + 1}</button>)}</span>;
              const quotes = isOpen && (
                <div className="ns-quotes">{it.refs.map((ref, j) => {
                  const rule = r.rules[ref.code];
                  return <p key={ref.code} className="ns-quote">{j + 1}. {rule ? <>{rule.label && <b style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>{rule.label} </b>}{rule.items ? rule.items.join(' · ') : rule.text}</> : ref.quoted}
                    <small>{rule ? <><span className={`tv-voice ${VOICE[rule.voice][0]}`}>{VOICE[rule.voice][1]}</span>{rule.page !== null ? ` · tr. ${rule.page}` : ''} · {placeOf(ref.code)} · <button type="button" onClick={() => onGoTo(ref.code)}>xem trong bài đọc ›</button></> : 'đoạn này không có trong bài đọc đang xem'}</small></p>;
                })}</div>);
              return it.layer === 'primary'
                ? <div key={ii} className="ns-item src"><p>{it.text}{refs}</p>{quotes}</div>
                : <div key={ii} className="ns-item add"><span className="tv-voice ai">{who} luận thêm</span><p>{it.text}{refs}</p>{quotes}</div>;
            })}
          </div>))}
        {written.caution && <p className="tv-muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>{written.caution}</p>}
      </div>
      <div className="tv-read-side">
        <div className="as-side"><h4>Trong bài</h4><nav className="ns-toc">{written.sections.map((sec, si) => (
          <button key={si} type="button" onClick={() => document.getElementById(`sum-${si}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{sec.title}</button>))}</nav></div>
        <div className="tv-added-box"><h4>Bài này viết thế nào</h4>
          <p>Phần <b>tóm lược</b> chỉ kể lại những đoạn của cô, của Tierney và của Woolfolk khớp với lá số; mỗi ý dẫn số đoạn, bấm để xem nguyên văn. Phần <b>luận thêm</b> là ý của {who}, ghép theo cách tổ hợp từ khóa của cô — không phải lời cô.</p>
          <p style={{ margin: 0 }}>Khi hồ sơ hay tài liệu được sửa, bài được đánh dấu cũ để viết lại.</p></div>
        {counts}
      </div>
    </div>
  );
}
