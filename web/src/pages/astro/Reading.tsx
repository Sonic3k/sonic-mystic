/* One person's chart in the Chiêm tinh room: the clean chart beside the chart at a glance, then four tabs — the
   reading Claude wrote (Luận giải), the sources' passages body by body and part by part (Theo tài liệu), the table of
   positions with the balance and her test of the dominant planets (Bảng vị trí), and the grid of aspects with the
   structures (Góc chiếu). Opened from a link (/astrology/view?…) or a saved profile (/astrology/profile/:id).
   Where one is: ?view=synthesis | reading | chart | aspects, ?part=<topic>, ?item=<n>. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BODY, LEVEL_NAME, SIGN, type BodyCode, type Topic } from '@mystic/engine/astrology';
import type { AiReadingDto, AstrologyReadingDto, AstrologySectionDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { ProfilePick } from '../../components/ProfilePick';
import { ReadingLayout } from '../../components/Reading';
import { useRememberChart } from '../../components/Shell';
import { PART_ORDER, PART_TITLE, SAMPLE_LABEL, astroRequest, dm, fromAstroSearch, isSample, offsetText, toAstroSearch } from '../../lib/astro';
import { useTitle } from '../../lib/text';
import { AspectsPane, AstroCompanion, AstroGlance, BodyDot, SectionView, TablePane, Wheel, astroHighlighter, astroRoom, astroVoices, said } from './Parts';
import { AstroProfileSheet, AstroSaveSheet } from './Sheets';

type Tab = 'synthesis' | 'reading' | 'chart' | 'aspects';
const TABS: [Tab, string][] = [['synthesis', 'Luận giải'], ['reading', 'Theo tài liệu'], ['chart', 'Bảng vị trí'], ['aspects', 'Góc chiếu']];
const page = (body: React.ReactNode) => <div className="wrap page as">{body}</div>;
const wait = (t: string) => page(<div className="card empty tv-wait">{t}</div>);

/** a chart opened from a link: the birth is in the URL */
export function AstroViewPage() {
  const [sp, setSp] = useSearchParams();
  const params = fromAstroSearch(sp);
  const key = params ? toAstroSearch(params) : '';
  const reading = useQuery({ queryKey: ['astro-reading', key], queryFn: () => api.astroReading(astroRequest(params!)), enabled: !!params, retry: false, placeholderData: keepPreviousData });
  const [saving, setSaving] = useState(false);
  useTitle(params?.name || 'Chiêm tinh');
  if (!params) return page(<div className="card empty tv-wait">Thiếu ngày sinh. <Link className="tv-link" to="/astrology">Lập lá số</Link></div>);
  const back = `/astrology?${key}${sp.get('person') ? `&person=${sp.get('person')}` : ''}`;
  if (reading.isError) return page(<Failed error={reading.error}><Link className="tv-link" to={back}>Sửa ngày giờ</Link></Failed>);
  if (!reading.data) return wait('Đang lập lá số…');
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={null} written={null} defTab="reading" approx={!!params.birth.timeApprox}
        title={params.name || 'Lá số chiêm tinh'} tags={isSample(params.birth) ? [SAMPLE_LABEL] : []} gender={params.gender}
        actions={<>
          <Link className="btn" to={back}>Sửa ngày giờ</Link>
          <button type="button" className="btn solid" onClick={() => setSaving(true)}>Lưu hồ sơ</button>
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
  if (p && !ok) return page(<div className="card empty tv-wait">Đây không phải hồ sơ chiêm tinh. <Link className="tv-link" to={`/people/${p.subject.id}`}>Mở trang người</Link></div>);
  if (reading.isError) return page(<Failed error={reading.error}>{back}</Failed>);
  if (!p || !reading.data || written.isPending) return wait('Đang mở hồ sơ…');
  const sum = (written.data ?? []).filter(w => w.scope === 'synthesis').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={p} written={sum} defTab={sum ? 'synthesis' : 'reading'} approx={p.birth.timeApprox}
        title={p.subject.displayName} tags={[]} gender={p.gender}
        actions={<button type="button" className="btn" onClick={() => setEditing(true)}>Sửa hồ sơ</button>} />
      {editing && <AstroProfileSheet profile={p} onClose={() => setEditing(false)} />}
    </>
  );
}

/** "21°02′ Bắc, 105°51′ Đông" */
const latLon = (lat: number, lon: number) => {
  const f = (x: number) => `${Math.floor(Math.abs(x))}°${String(Math.round((Math.abs(x) % 1) * 60)).padStart(2, '0')}′`;
  return `${f(lat)} ${lat >= 0 ? 'Bắc' : 'Nam'}, ${f(lon)} ${lon >= 0 ? 'Đông' : 'Tây'}`;
};

function ReadingView({ r, sp, setSp, profile, written, defTab, approx, title, tags, gender, actions }: {
  r: AstrologyReadingDto; sp: URLSearchParams; setSp: ReturnType<typeof useSearchParams>[1];
  profile: ProfileDto | null; written: AiReadingDto | null; defTab: Tab; approx: boolean;
  title: string; tags: string[]; gender: ProfileDto['gender']; actions: React.ReactNode;
}) {
  const ch = r.chart, i = ch.input;
  useRememberChart('astro', title);
  const tab = (TABS.some(([k]) => k === sp.get('view')) ? sp.get('view') : defTab) as Tab;
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } setSp(n, { replace: true }); };
  const [hl, setHl] = useState<string | null>(null);
  /* a passage cited by the reading is shown where the sources' tab has it, once that tab has been drawn */
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollTo.current ? document.getElementById(scrollTo.current) : null;
    if (el) { scrollTo.current = null; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  const g = gender === 'female' ? 'Nữ' : gender === 'male' ? 'Nam' : '';
  const time = i.local.hour !== null && i.local.minute !== null ? `${String(i.local.hour).padStart(2, '0')}:${String(i.local.minute).padStart(2, '0')}` : null;
  const born = `sinh ngày ${i.local.day}/${i.local.month}/${i.local.year}${time ? ` lúc ${time} (${offsetText(r.offsetMinutes)})` : ', chưa có giờ sinh'}`;
  const where = i.place ? ` tại ${i.place.name ?? 'nơi sinh'}, ${latLon(i.place.latitude, i.place.longitude)}` : ', chưa có nơi sinh';
  const birth = g ? `${g}, ${born}${where}.` : `S${born.slice(1)}${where}.`;
  const w = r.window, asc = ch.placements.asc;
  const notes = [...new Set([...r.notes, ...ch.notes])];
  const hlText = useMemo(() => astroHighlighter(), []);
  const who = written?.author === 'ai' ? 'AI' : 'Claude';
  const goTo = (code: string) => {
    const s = r.sections.find(x => x.groups.some(gr => gr.matches.some(m => m.rule === code)));
    if (!s) return;
    const k = Math.max(0, sectionsOf(r, s.topic).indexOf(s));
    set({ view: defTab === 'reading' ? null : 'reading', part: s.topic === 'sun' ? null : s.topic, item: k ? String(k) : null });
    setHl(code);
    scrollTo.current = `r-${code}`;
  };
  /* the reading's sources call the newest goTo (it builds on the address as it is now) */
  const go = useRef(goTo);
  go.current = goTo;
  const room = useMemo(() => astroRoom(r, hlText, who, code => go.current(code)), [r, hlText, who]);
  return (
    <div className="wrap page as">
      <header className="phead">
        <h1>{title}<ProfilePick profile={profile} fallback="Lá số gốc" extra={tags} /></h1>
        <p className="birth">{birth}{profile && <> <Link to={`/people/${profile.subject.id}`}>Trang của {profile.subject.displayName}</Link></>}{profile?.note && <> · {profile.note}</>}</p>
        <div className="acts">{actions}</div>
      </header>
      {w && <p className="as-note"><b>{approx ? 'Giờ sinh ước chừng' : 'Khoảng giờ cùng lá số'}</b><span>Sinh trong khoảng {w.from} đến {w.to} thì lá số vẫn như dưới đây: cùng cung Mọc, cùng dấu hiệu của Mặt Trăng, mọi hành tinh ở nguyên cung. Ra ngoài khoảng đó là một lá số khác.
        {(w.after < 10 || w.before < 10) && (asc && (asc.deg >= 28.5 || asc.deg <= 1.5) ? ` Cung Mọc đang ở ${dm(asc.lon)} ${SIGN[asc.sign].name}, sát chỗ đổi cung: giờ sinh lệch vài phút là lá số khác.` : ' Giờ sinh lệch vài phút là lá số khác.')}</span></p>}
      {notes.map(n => <p key={n} className="as-note"><b>Lưu ý</b><span>{n}</span></p>)}

      <div className="as-hero">
        <figure className="plate"><Wheel ch={ch} />
          <figcaption>{ch.timeKnown && ch.houses ? 'Cung Mọc (AC) ở bên trái' : 'Chưa có giờ sinh và nơi sinh: Bạch Dương ở bên trái, chưa có cung Mọc và các cung địa bàn'}, các dấu hiệu đi ngược chiều kim đồng hồ. Mỗi vạch là 1°, vạch dài là 5° và 10°. Đường đỏ là góc vuông và góc xung, đường xanh là tam hợp và lục hợp. R là nghịch hành.</figcaption></figure>
        <AstroGlance ch={ch} />
      </div>

      <nav className="tabs as-tabs" role="tablist" aria-label="Đọc lá số">{TABS.map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => set({ view: k === defTab ? null : k })}>{t}</button>))}</nav>
      {tab === 'synthesis' && (written
        ? <ReadingLayout ai={written} room={room} voices={astroVoices(who)} companion={k => <AstroCompanion ch={ch} s={written.sections[k]} />} />
        : <NoReading r={r} profile={profile} />)}
      {tab === 'reading' && <SourcesTab r={r} hl={hlText} focusRule={hl} part={sp.get('part')} item={Number(sp.get('item')) || 0}
        setPart={(t, k = 0) => set({ part: t === 'sun' ? null : t, item: k ? String(k) : null })} />}
      {tab === 'chart' && <TablePane ch={ch} />}
      {tab === 'aspects' && <AspectsPane ch={ch} />}
    </div>
  );
}

function NoReading({ r, profile }: { r: AstrologyReadingDto; profile: ProfileDto | null }) {
  return (
    <div className="tab-pane no-rd">
      <div className="writer"><p>{profile
        ? 'Chưa có bài luận giải cho người này. Bài do Claude viết từ những đoạn khớp ở phần Theo tài liệu: phần tóm lược chỉ kể lại lời cô, Tierney và Woolfolk, mỗi ý dẫn số đoạn; phần luận thêm theo cách tổ hợp từ khóa của cô (chủ thể, cách thức, nơi chốn, mẫu câu cho từng cung địa bàn) và ghi rõ là Claude luận thêm. Khi có, bài hiện ở đây.'
        : 'Bài luận giải được viết cho hồ sơ đã lưu: lưu hồ sơ này, rồi Claude viết bài từ những đoạn khớp ở phần Theo tài liệu. Khi có, bài hiện ở đây.'}</p></div>
      <dl className="facts counts">{PART_ORDER.filter(t => r.sections.some(s => s.topic === t)).map(t => (
        <div key={t}><dt>{PART_TITLE[t]}</dt><dd>{r.sections.filter(s => s.topic === t).reduce((n, s) => n + said(s, r.rules), 0)} đoạn</dd></div>))}</dl>
    </div>
  );
}

/** a part's sections, as its chips show them (the dominant part's introduction is read with each of them) */
const sectionsOf = (r: AstrologyReadingDto, t: Topic) => r.sections.filter(s => s.topic === t && (t !== 'dominant' || !!s.focus));
const BODY_TOPIC: Topic[] = ['sun', 'moon', 'asc', 'planet'];
const bodyOfPlanet = (s: AstrologySectionDto) => Object.values(BODY).find(x => (s.focus ?? '').startsWith(`${x.name} `))?.code;

function chipOf(s: AstrologySectionDto): React.ReactNode {
  const f = s.focus ?? '';
  if (s.topic === 'house') { const m = /^Cung (\d+) · nóc (\S+(?: \S+)?)/.exec(f); return m ? <>Cung {m[1]} <small>{m[2].replace(/ \d.*$/, '')}</small></> : f; }
  if (s.topic === 'sign') return f.split(' — ')[0];
  if (s.topic === 'pattern') return f.split(':')[0];
  if (s.topic === 'dominant') return f.replace(/ điểm.*$/, '');
  if (s.topic === 'point') return f.split(' ở ')[0];
  return f;
}

function SourcesTab({ r, hl, focusRule, part, item, setPart }: {
  r: AstrologyReadingDto; hl: (t: string) => React.ReactNode; focusRule: string | null; part: string | null; item: number; setPart: (t: Topic, k?: number) => void;
}) {
  const ch = r.chart;
  const parts = PART_ORDER.filter(t => r.sections.some(s => s.topic === t));
  if (!parts.length) return <div className="tab-pane"><p className="fs-none">Tài liệu không có đoạn nào khớp với lá số này.</p></div>;
  const t = (parts.includes(part as Topic) ? part : parts[0]) as Topic;
  const ss = sectionsOf(r, t), fi = Math.min(item, Math.max(0, ss.length - 1)), sec = ss[fi];
  const planets = sectionsOf(r, 'planet');
  const count = (k: Topic) => r.sections.filter(s => s.topic === k).reduce((n, s) => n + said(s, r.rules), 0);
  const isBody = BODY_TOPIC.includes(t);
  const body: BodyCode | undefined = t === 'planet' ? (sec ? bodyOfPlanet(sec) : undefined) : isBody ? (t as BodyCode) : undefined;
  const p = body ? ch.placements[body] : undefined;
  const intro = t === 'dominant' ? r.sections.find(s => s.topic === 'dominant' && !s.focus) : undefined;
  const test = t === 'dominant' && sec ? ch.dominant.tests.find(x => BODY[x.body].name === sec.focus?.split(':')[0]) : undefined;
  const pick = (b: BodyCode) => {
    if (b === 'sun' || b === 'moon' || b === 'asc') setPart(b);
    else { const k = planets.findIndex(s => bodyOfPlanet(s) === b); if (k >= 0) setPart('planet', k); }
  };
  const bodies = ([...(['sun', 'moon', 'asc'] as BodyCode[]).filter(b => r.sections.some(s => s.topic === b)), ...planets.map(bodyOfPlanet).filter((b): b is BodyCode => !!b)]);
  const others = parts.filter(k => !BODY_TOPIC.includes(k));
  return (
    <div className="tab-pane src-pane">
      <div className="body-pick" role="group" aria-label="Thiên thể">{bodies.map(b => (
        <button key={b} type="button" className={body === b ? 'on' : ''} onClick={() => pick(b)}><BodyDot b={b} />{b === 'asc' ? 'Cung Mọc' : BODY[b].name}</button>))}</div>
      {others.length > 0 && <div className="part-pick" role="group" aria-label="Phần khác">{others.map(k => (
        <button key={k} type="button" className={t === k ? 'on' : ''} onClick={() => setPart(k)}>{PART_TITLE[k]}<small>{count(k)}</small></button>))}</div>}
      {!isBody && ss.length > 1 && <div className="as-sub">{ss.map((s, k) => <button key={k} type="button" className={k === fi ? 'on' : ''} onClick={() => setPart(t, k)}>{chipOf(s)}</button>)}</div>}
      <p className="src-note">Mỗi đoạn kèm lý do nó khớp với lá số. Đoạn của Woolfolk do Claude dịch, bấm “bản gốc” để xem tiếng Anh.</p>
      {isBody ? (
        <div className="fs">
          <div className="fs-h">{body && <BodyDot b={body} />}<h3>{body ? `${body === 'asc' ? 'Cung Mọc' : BODY[body].name} ở ${p ? SIGN[p.sign].name : '…'}` : PART_TITLE[t]}</h3>
            {p && <span>{dm(p.lon)}{p.house ? ` · cung ${p.house}` : ''}{p.retro ? ' · nghịch hành' : ''}{p.dignities.length ? ` · ${p.dignities.map(d => ({ ruler: 'Tướng', exaltation: 'Vượng', detriment: 'Tù', fall: 'Tử' })[d]).join(', ')}` : ''}</span>}</div>
          {sec ? <SectionView sec={sec} rules={r.rules} hl={hl} focus={focusRule} facts /> : <p className="fs-none">Tài liệu không có đoạn nào khớp ở phần này.</p>}
        </div>
      ) : (
        <div className="fs plain">
          <div className="fs-h"><h3>{sec?.focus && ['house', 'pattern', 'dominant', 'point'].includes(t) ? sec.focus : PART_TITLE[t]}</h3>{sec?.focus && !['house', 'pattern', 'dominant', 'point'].includes(t) && <span>{sec.focus}</span>}</div>
          {test && <p className="dom-note">{BODY[test.body].name} được <b>{test.total} điểm</b> trong bài test của cô ({LEVEL_NAME[test.level]}). Từng dòng được cộng ở “Bảng vị trí”.</p>}
          {intro && <SectionView sec={intro} rules={r.rules} hl={hl} focus={focusRule} facts={false} quiet />}
          {sec ? <SectionView sec={sec} rules={r.rules} hl={hl} focus={focusRule} facts={false} /> : <p className="fs-none">Tài liệu không có đoạn nào khớp ở phần này.</p>}
        </div>
      )}
    </div>
  );
}
