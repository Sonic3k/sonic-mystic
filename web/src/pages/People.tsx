/* The people readings are about. Someone linked to Sonic Hub takes their name and birth from there (edited there);
   each person can have several profiles — one reading at one moment — and the latest one's brief goes back to
   their page in Sonic Hub. The list shows, for each person, the key figure of each room they have a chart in. */
import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { AiReadingDto, BirthDto, BriefDto, Gender, ProfileSummaryDto, SubjectDto } from '@mystic/engine/api';
import { PLACES } from '@mystic/engine/birth';
import { api } from '../api';
import { AstroBadgeView, NumBadgeView, TuviBadgeView } from '../components/Badges';
import { Failed, errorText } from '../components/Owner';
import { SummaryText } from '../components/Reading';
import { EMBLEM } from '../components/Shell';
import { Sheet } from '../components/Sheet';
import { astroBadge, newest, numBadge, tuviBadge } from '../lib/badges';
import { HOURS, thisYear } from '../lib/params';
import { SONIC_HUB, birthComplete, birthLine, birthPhrase, dateComplete, genderName } from '../lib/people';
import { dateVi, fold, useTitle } from '../lib/text';
import { numerologyFacts } from './numerology/Home';

const hubLink = (s: SubjectDto) => s.links.find(l => l.system === SONIC_HUB);
const PROFILE_URL: Record<string, string> = { tuvi: '/tu-vi/profile/', astrology: '/astrology/profile/', numerology: '/numerology/profile/' };
const useBrief = (id: string, discipline: string, enabled: boolean) =>
  useQuery({ queryKey: discipline === 'tuvi' ? ['brief', id] : ['brief', id, discipline], queryFn: () => api.brief(id, discipline), retry: false, enabled, staleTime: 60_000 });

/** one row a person: their name and birth, then each room's key figure, which opens that room's newest chart */
export function PeopleTable({ q, alone, action }: { q: UseQueryResult<SubjectDto[]>; alone?: boolean; action?: React.ReactNode }) {
  const [find, setFind] = useState('');
  const nav = useNavigate();
  const list = q.data ?? [];
  const astro = list.map(s => newest(s, 'astrology') ? s.id : null);
  const briefs = useQueries({ queries: astro.map(id => ({ queryKey: ['brief', id ?? '', 'astrology'], queryFn: () => api.brief(id!, 'astrology'), enabled: !!id, retry: false, staleTime: 60_000 })) });
  const rows = useMemo(() => list.map((s, i) => {
    const tv = newest(s, 'tuvi'), as = newest(s, 'astrology'), ns = newest(s, 'numerology');
    return { s, tv, as, ns, tvb: tv ? tuviBadge(tv) : null, nsb: ns ? numBadge(ns) : null, i };
  }), [list]);
  const count = (d: string) => list.reduce((n, s) => n + s.profiles.filter(p => p.discipline === d).length, 0);
  const f = fold(find.trim());
  const shown = f ? rows.filter(r => fold(`${r.s.displayName} ${r.ns?.name ?? ''}`).includes(f)) : rows;
  const none = <span className="pp-none">—</span>;
  return (
    <section className={`people${alone ? ' alone' : ''}`} id="people">
      <div className="people-h"><h2>Người</h2>
        <span>{q.data ? `${list.length} người: ${count('numerology')} hồ sơ nhân số học, ${count('tuvi')} lá số tử vi, ${count('astrology')} lá số chiêm tinh` : 'Đang mở…'}</span>
        {list.length > 0 && <label className="find"><svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <input value={find} onChange={e => setFind(e.target.value)} placeholder="Tìm theo tên" autoComplete="off" aria-label="Tìm người theo tên" /></label>}
        {action}
      </div>
      {q.isError ? <div className="people-empty"><Failed error={q.error} /></div>
        : q.data && !list.length ? <p className="people-empty">Chưa có ai. Liên kết một người từ Sonic Hub, thêm người mới, hoặc lưu một lá số.</p>
          : <div className="ptable"><table>
            <thead><tr><th>Người</th><th>Tử vi · cung Mệnh</th><th>Chiêm tinh · Mặt Trời, Mặt Trăng, cung Mọc</th><th>Nhân số học · chủ đạo, ngày sinh</th></tr></thead>
            <tbody>{shown.map(({ s, tv, as, ns, tvb, nsb, i }) => {
              const ab = briefs[i]?.data ? astroBadge(briefs[i].data) : null;
              return (
                <tr key={s.id} onClick={() => nav(`/people/${s.id}`)}>
                  <td className="pp-name"><b><Link to={`/people/${s.id}`} onClick={e => e.stopPropagation()}>{s.displayName}</Link></b>
                    <small>{[genderName(s.gender), birthPhrase(s.birth)].filter(Boolean).join(', ') || 'chưa có ngày sinh'}</small></td>
                  <td>{tv && tvb ? <TuviBadgeView b={tvb} to={PROFILE_URL.tuvi + tv.id} /> : none}</td>
                  <td>{as ? ab ? <AstroBadgeView b={ab} to={PROFILE_URL.astrology + as.id} /> : briefs[i]?.isPending ? <span className="bdg bdg-as wait">…</span> : <Link className="pp-tag" to={PROFILE_URL.astrology + as.id} onClick={e => e.stopPropagation()}>mở lá số</Link> : none}</td>
                  <td>{ns && nsb ? <NumBadgeView b={nsb} to={PROFILE_URL.numerology + ns.id} /> : none}</td>
                </tr>
              );
            })}</tbody>
          </table></div>}
      {list.length > 0 && <p className="people-foot">Bấm một dòng để mở trang của người đó; bấm vào hình của một môn để mở lá số mới nhất của môn ấy.</p>}
    </section>
  );
}

export function PeoplePage() {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const persons = useQuery({ queryKey: ['hub-persons'], queryFn: api.sonicHubPersons, retry: false, staleTime: 300_000 });
  const [adding, setAdding] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const link = useMutation({
    mutationFn: (personId: string) => api.linkSonicHub(personId),
    onSuccess: s => { void qc.invalidateQueries({ queryKey: ['subjects'] }); nav(`/people/${s.id}`); },
  });
  useTitle('Người');
  const linked = new Set((subjects.data ?? []).flatMap(s => s.links.filter(l => l.system === SONIC_HUB).map(l => l.externalId)));
  const hub = (persons.data ?? []).filter(p => !linked.has(p.id));
  return (
    <div className="wrap hub page">
      <PeopleTable q={subjects} alone action={<button type="button" className="btn solid" onClick={() => setAdding(true)}>Thêm người</button>} />
      {subjects.data && hub.length > 0 && (
        <section className="hub-more">
          <div className="hd"><h2>Từ Sonic Hub</h2><span>chưa liên kết · bấm để lấy tên và ngày giờ sinh từ Sonic Hub</span></div>
          <div className="hub-persons">{hub.map(p => (
            <button key={p.id} type="button" className="hub-person" disabled={link.isPending} onClick={() => link.mutate(p.id)}>
              <b>{p.displayName || p.name}{p.isSelf && <span className="pp-tag">chủ nhà</span>}</b>
              <small>{p.displayName && p.displayName !== p.name ? p.name : 'Liên kết'}</small>
            </button>))}</div>
          {link.isError && <p className="tv-err">{errorText(link.error)}</p>}
        </section>
      )}
      {persons.isError && <p className="tv-muted" style={{ marginTop: 24, fontSize: 13 }}>Chưa đọc được danh sách người từ Sonic Hub: {errorText(persons.error)}</p>}
      {adding && <SubjectSheet onClose={() => setAdding(false)} onSaved={s => nav(`/people/${s.id}`)} />}
    </div>
  );
}

/** a room's part of a person's page: its charts, the way to make one, and the brief Sonic Hub keeps */
function RoomPart({ cls, emblem, title, list, badge, label, sub, actions, note, brief }: {
  cls: string; emblem: React.ReactNode; title: string; list: ProfileSummaryDto[]; badge: (p: ProfileSummaryDto) => React.ReactNode;
  label: (p: ProfileSummaryDto) => React.ReactNode; sub: (p: ProfileSummaryDto) => string; actions: React.ReactNode; note?: React.ReactNode; brief?: React.ReactNode;
}) {
  return (
    <section className={`sr ${cls}`}>
      <div className="sr-h">{emblem}<h2>{title}</h2><span>{list.length ? `${list.length} ${cls === 'sr-num' ? 'hồ sơ' : 'lá số'}` : 'chưa có'}</span></div>
      <div className="sr-b">
        {list.length > 0 && <div className="prof-list">{list.map(p => (
          <div key={p.id} className="prof">
            <Link className="prof-n" to={PROFILE_URL[p.discipline] + p.id}>{label(p)}</Link><small>{sub(p)}</small>{badge(p)}
          </div>))}</div>}
        <div className="sr-acts">{actions}</div>
        {note}
        {brief}
      </div>
    </section>
  );
}

export function SubjectPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['subject', id], queryFn: () => api.subject(id), retry: false });
  const s = q.data;
  const by = (d: string) => (s?.profiles.filter(p => p.discipline === d) ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tuvi = by('tuvi'), numerology = by('numerology'), astro = by('astrology');
  const brief = useBrief(id, 'tuvi', tuvi.length > 0);
  const numerologyBrief = useBrief(id, 'numerology', numerology.length > 0);
  const astroBrief = useBrief(id, 'astrology', astro.length > 0);
  const whole = useQuery({ queryKey: ['subject-readings', id], queryFn: () => api.subjectReadings(id), retry: false, enabled: !!s });
  const nd = (whole.data ?? []).find(x => x.scope === 'summary');
  const [editing, setEditing] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const refreshAll = () => ['subject', 'subjects', 'brief'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const make = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, label: tuvi.length ? null : 'Lá số gốc', viewYear: thisYear() }),
    onSuccess: p => { refreshAll(); nav(`/tu-vi/profile/${p.id}`); },
  });
  /* nhân số học needs only the date; the names read come from the person's name (the given name first) */
  const makeNumerology = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, discipline: 'numerology' }),
    onSuccess: p => { refreshAll(); nav(`/numerology/profile/${p.id}`); },
  });
  /* chiêm tinh reads the person's own date, clock time and place (no time: the planets in the signs only) */
  const makeAstro = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, discipline: 'astrology' }),
    onSuccess: p => { refreshAll(); nav(`/astrology/profile/${p.id}`); },
  });
  const pull = useMutation({ mutationFn: () => api.linkSonicHub(hubLink(s!)!.externalId), onSuccess: refreshAll });
  useTitle(s?.displayName ?? 'Người');
  if (q.isError) return <div className="wrap page"><Failed error={q.error}><Link className="tv-link" to="/people">Về danh sách</Link></Failed></div>;
  if (!s) return <div className="wrap page"><div className="card empty" style={{ marginTop: 24 }}>Đang mở…</div></div>;
  const link = hubLink(s), ready = birthComplete(s.gender, s.birth), dated = dateComplete(s.birth);
  const fromHub = link ? ', sửa ở Sonic Hub rồi bấm «Cập nhật từ Sonic Hub».' : '.';
  const ab = astroBrief.data ? astroBadge(astroBrief.data) : null;
  return (
    <div className="wrap page">
      <header className="phead">
        <h1>{s.displayName}{link && <span className="hh-tag">Sonic Hub</span>}</h1>
        <p className="birth">{[genderName(s.gender), birthPhrase(s.birth)].filter(Boolean).join(', ') || 'Chưa có ngày sinh.'}</p>
        <div className="acts">
          <button type="button" className="btn" onClick={() => setEditing(true)}>{link?.ownsIdentity ? 'Sửa ghi chú' : 'Sửa'}</button>
          {link && <button type="button" className="btn" disabled={pull.isPending} onClick={() => pull.mutate()}>{pull.isPending ? 'Đang cập nhật…' : 'Cập nhật từ Sonic Hub'}</button>}
        </div>
      </header>
      {pull.isError && <p className="tv-err">{errorText(pull.error)}</p>}
      {nd && <WholeReading ai={nd} rooms={[
        ['Tử vi', <span className="seal" aria-hidden="true">紫</span>, tuvi[0]],
        ['Chiêm tinh', <span className="as-em"><span className="gl-dot" aria-hidden="true">☉︎</span></span>, astro[0]],
        ['Nhân số học', (() => { const b = numerology[0] ? numBadge(numerology[0]) : null; return b ? <span className={`ns-em circle${b.ruling === 11 || b.ruling === 22 ? ' master' : ''}`}><b>{b.ruling}</b></span> : EMBLEM.num; })(), numerology[0]],
      ]} />}
      <div className="subj">
        <div className="subj-rooms">
          <RoomPart cls="sr-tuvi" emblem={EMBLEM.tuvi} title="Tử vi" list={tuvi}
            label={p => p.label || 'Lá số'}
            sub={p => [p.viewYear ? `xem năm ${p.viewYear}` : '', p.aiReadings ? `${p.aiReadings} bài luận` : '', `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}
            badge={p => { const b = tuviBadge(p); return b ? <TuviBadgeView b={b} to={PROFILE_URL.tuvi + p.id} /> : null; }}
            actions={<>
              <button type="button" className="btn solid" disabled={!ready || make.isPending} onClick={() => make.mutate()} title={ready ? undefined : 'Cần giới tính, ngày tháng năm và giờ sinh'}>
                {make.isPending ? 'Đang lập…' : 'Lập lá số từ ngày giờ sinh này'}</button>
              <Link className="btn" to={`/tu-vi?person=${s.id}`}>Lập với giờ hoặc ngày khác…</Link></>}
            note={<>{!ready && <p className="sr-note">Còn thiếu {[!s.gender && 'giới tính', !(s.birth.year && s.birth.month && s.birth.day) && 'ngày sinh', !(s.birth.time || s.birth.hourBranch !== null) && 'giờ sinh'].filter(Boolean).join(', ')}{fromHub}</p>}
              {make.isError && <p className="tv-err">{errorText(make.error)}</p>}</>}
            brief={brief.data && <Brief b={brief.data} linked={!!link} voice={l => (l.layer === 'primary' ? 'Lời bà' : 'Bổ sung')} />} />
          <RoomPart cls="sr-astro" emblem={EMBLEM.astro} title="Chiêm tinh" list={astro}
            label={p => p.label || 'Lá số chiêm tinh'}
            sub={p => [birthLine(p.birth), p.aiReadings ? 'có bài tổng hợp' : '', `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}
            badge={p => (ab && p.id === astro[0]?.id ? <AstroBadgeView b={ab} to={PROFILE_URL.astrology + p.id} /> : null)}
            actions={<>
              <button type="button" className="btn solid" disabled={!dated || s.birth.calendar !== 'solar' || makeAstro.isPending} onClick={() => makeAstro.mutate()} title={dated ? undefined : 'Cần ngày tháng năm sinh'}>
                {makeAstro.isPending ? 'Đang lập…' : 'Lập lá số chiêm tinh'}</button>
              <Link className="btn" to={`/astrology?person=${s.id}`}>Lập với giờ hoặc nơi khác…</Link></>}
            note={<>{(!dated || !s.birth.time || s.birth.latitude === null) && <p className="sr-note">{!dated ? 'Còn thiếu ngày sinh.' : `Chưa có ${[!s.birth.time && 'giờ sinh (giờ đồng hồ)', s.birth.latitude === null && 'nơi sinh'].filter(Boolean).join(' và ')}: lá số chưa có cung Mọc và các cung địa bàn.`}</p>}
              {makeAstro.isError && <p className="tv-err">{errorText(makeAstro.error)}</p>}</>}
            brief={astroBrief.data && <Brief b={astroBrief.data} linked={!!link} voice={l => (l.layer === 'added' ? 'Luận thêm' : l.source.startsWith('Tóm lược') ? 'Tóm lược tài liệu' : 'Lời tài liệu')} />} />
          <RoomPart cls="sr-num" emblem={EMBLEM.num} title="Nhân số học" list={numerology}
            label={p => <>{p.name ?? 'Hồ sơ'}{p.label && <span className="pp-tag">{p.label}</span>}</>}
            sub={p => [numerologyFacts(p).line, p.aiReadings ? 'có bài tổng hợp' : '', `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}
            badge={p => { const b = numBadge(p); return b ? <NumBadgeView b={b} to={PROFILE_URL.numerology + p.id} /> : null; }}
            actions={<>
              <button type="button" className="btn solid" disabled={!dated || makeNumerology.isPending} onClick={() => makeNumerology.mutate()} title={dated ? undefined : 'Cần ngày tháng năm sinh'}>
                {makeNumerology.isPending ? 'Đang lập…' : 'Lập hồ sơ nhân số học'}</button>
              <Link className="btn" to={`/numerology?person=${s.id}`}>Xem với tên hoặc ngày khác…</Link></>}
            note={<>{!dated && <p className="sr-note">Còn thiếu ngày sinh{fromHub}</p>}
              {makeNumerology.isError && <p className="tv-err">{errorText(makeNumerology.error)}</p>}</>}
            brief={numerologyBrief.data && <Brief b={numerologyBrief.data} linked={!!link} voice={l => (l.layer === 'added' ? 'Luận thêm' : l.source.startsWith('Tóm lược') ? 'Tóm lược sách' : 'Lời sách')} />} />
        </div>
        <aside className="card subj-facts">
          <dl>
            <dt>Giới tính</dt><dd>{genderName(s.gender) ?? '—'}</dd>
            <dt>Ngày sinh</dt><dd>{s.birth.day && s.birth.month && s.birth.year ? `${s.birth.day}/${s.birth.month}${s.birth.leapMonth ? ' nhuận' : ''}/${s.birth.year}${s.birth.calendar === 'lunar' ? ' âm lịch' : ''}` : '—'}</dd>
            <dt>Giờ sinh</dt><dd>{s.birth.time ?? (s.birth.hourBranch !== null ? `giờ ${HOURS[s.birth.hourBranch].n}` : '—')}{s.birth.timeApprox ? ' (ước chừng)' : ''}</dd>
            <dt>Nơi sinh</dt><dd>{s.birth.place ?? (s.birth.latitude !== null ? `${s.birth.latitude}, ${s.birth.longitude}` : '—')}</dd>
            {s.birth.timeZone && <><dt>Múi giờ</dt><dd>{s.birth.timeZone}{s.birth.utcOffsetMinutes !== null ? ` (UTC${s.birth.utcOffsetMinutes >= 0 ? '+' : '−'}${Math.abs(s.birth.utcOffsetMinutes) / 60})` : ''}</dd></>}
          </dl>
          {s.note && <p style={{ fontSize: 13.5, margin: 0 }}>{s.note}</p>}
          {link && <p style={{ margin: 0 }}><span className="tv-linked">liên kết Sonic Hub</span>{link.syncedAt && <small className="tv-muted" style={{ marginLeft: 8, fontSize: 12 }}>cập nhật {dateVi(link.syncedAt)}</small>}</p>}
        </aside>
      </div>
      {editing && <SubjectSheet subject={s} onClose={() => setEditing(false)} onSaved={() => refreshAll()} onDeleted={() => nav('/people', { replace: true })} />}
    </div>
  );
}

/** the Nhận định: the person read through every room at once, in plain words; beside it, the way into each room */
function WholeReading({ ai, rooms }: { ai: AiReadingDto; rooms: [string, React.ReactNode, ProfileSummaryDto | undefined][] }) {
  const have = rooms.filter((x): x is [string, React.ReactNode, ProfileSummaryDto] => !!x[2]);
  const names = have.map(x => x[0]);
  const sub = names.length === 3 ? `Gộp cả ba môn: ${names.join(', ')}` : names.length ? `Gộp từ ${names.join(' và ')}` : 'Gộp từ các lá số của người này';
  return (
    <section className="nd nd-person">
      <div className="nd-main"><SummaryText ai={ai} title="Nhận định" sub={sub} from={null} /></div>
      {have.length > 0 && <aside className="nd-aside"><nav className="toc"><h4>Đọc riêng từng môn</h4>
        {have.map(([name, em, p]) => <Link key={name} to={PROFILE_URL[p.discipline] + p.id}>{em}<span>Luận giải {name}</span></Link>)}</nav></aside>}
    </section>
  );
}

/** the brief a person's newest profile in a discipline keeps (it also goes to their page in Sonic Hub) */
function Brief({ b, linked, voice }: { b: BriefDto; linked: boolean; voice: (l: BriefDto['lines'][number]) => string }) {
  return (
    <div className="brief">
      <h3>Tóm tắt{b.profileLabel ? ` theo «${b.profileLabel}»` : ''}</h3>
      <dl>{b.facts.map(f => <Fragment key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></Fragment>)}</dl>
      {b.lines.map((l, i) => <p key={i} className={`bl${l.layer === 'added' ? ' added' : ''}`}><i>{voice(l)}</i>{l.text}</p>)}
      {linked && <p className="foot">Bản tóm tắt này cũng hiện ở trang người trong Sonic Hub.</p>}
    </div>
  );
}

const num = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);

function SubjectSheet({ subject: s, onClose, onSaved, onDeleted }: { subject?: SubjectDto; onClose: () => void; onSaved: (s: SubjectDto) => void; onDeleted?: () => void }) {
  const owned = !!s?.links.some(l => l.ownsIdentity);
  const b = s?.birth;
  const [name, setName] = useState(s?.displayName ?? '');
  const [gender, setGender] = useState<Gender | null>(s?.gender ?? null);
  const [calendar, setCalendar] = useState<BirthDto['calendar']>(b?.calendar ?? 'solar');
  const [day, setDay] = useState(String(b?.day ?? '')), [month, setMonth] = useState(String(b?.month ?? '')), [year, setYear] = useState(String(b?.year ?? ''));
  const [leap, setLeap] = useState(b?.leapMonth ?? false);
  const [time, setTime] = useState(b?.time ?? '');
  const [branch, setBranch] = useState<number | null>(b?.hourBranch ?? null);
  const [approx, setApprox] = useState(b?.timeApprox ?? false);
  const own = b && b.latitude !== null && !PLACES.some(p => p.latitude === b.latitude && p.longitude === b.longitude);
  const [place, setPlace] = useState(b?.latitude == null ? 'none' : own ? 'own' : String(PLACES.findIndex(p => p.latitude === b.latitude && p.longitude === b.longitude)));
  const [note, setNote] = useState(s?.note ?? '');
  const [ask, setAsk] = useState(false);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => {
      const at = place === 'none' ? { place: null, latitude: null, longitude: null }
        : place === 'own' ? { place: b!.place, latitude: b!.latitude, longitude: b!.longitude }
          : { place: PLACES[+place].name, latitude: PLACES[+place].latitude, longitude: PLACES[+place].longitude };
      const hasTime = calendar === 'solar' ? !!time : branch !== null;
      const birth: Partial<BirthDto> = {
        calendar, day: num(day), month: num(month), year: num(year), leapMonth: calendar === 'lunar' && leap,
        time: calendar === 'solar' && time ? time : null, hourBranch: calendar === 'lunar' ? branch : null, timeApprox: hasTime && approx,
        timeZone: hasTime ? b?.timeZone ?? 'Asia/Ho_Chi_Minh' : null, utcOffsetMinutes: null, ...at,
      };
      const body = { displayName: name.trim(), gender, birth, note: note.trim() || null };
      return s ? api.updateSubject(s.id, body) : api.createSubject(body);
    },
    onSuccess: x => { void qc.invalidateQueries({ queryKey: ['subjects'] }); void qc.invalidateQueries({ queryKey: ['subject', x.id] }); onSaved(x); onClose(); },
  });
  const del = useMutation({ mutationFn: () => api.deleteSubject(s!.id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['subjects'] }); onClose(); onDeleted?.(); } });
  return (
    <Sheet title={s ? (owned ? 'Ghi chú' : 'Sửa người') : 'Thêm người'} sub={owned ? 'Tên và ngày giờ sinh của người này sửa ở Sonic Hub; ở đây chỉ giữ ghi chú.' : undefined} onClose={onClose}>
        <div className="tv-form" style={{ marginTop: 12 }}>
          {!owned && <>
            <label className="tv-f"><span>Tên</span><input value={name} onChange={e => setName(e.target.value)} data-autofocus={!s || undefined} /></label>
            <div className="tv-f half"><span>Giới tính</span>
              <div className="seg"><a className={gender === 'male' ? 'on' : ''} onClick={() => setGender('male')}>Nam</a><a className={gender === 'female' ? 'on' : ''} onClick={() => setGender('female')}>Nữ</a><a className={gender === null ? 'on' : ''} onClick={() => setGender(null)}>Không rõ</a></div></div>
            <div className="tv-f half"><span>Ngày sinh theo</span>
              <div className="seg"><a className={calendar === 'solar' ? 'on' : ''} onClick={() => setCalendar('solar')}>Dương lịch</a><a className={calendar === 'lunar' ? 'on' : ''} onClick={() => setCalendar('lunar')}>Âm lịch</a></div></div>
            <label className="tv-f third"><span>Ngày</span><input inputMode="numeric" value={day} onChange={e => setDay(e.target.value)} placeholder="—" /></label>
            <label className="tv-f third"><span>Tháng</span><input inputMode="numeric" value={month} onChange={e => setMonth(e.target.value)} placeholder="—" /></label>
            <label className="tv-f third"><span>Năm</span><input inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} placeholder="—" /></label>
            {calendar === 'lunar' && <label className="tv-f tv-check" style={{ flexDirection: 'row' }}><input type="checkbox" checked={leap} onChange={e => setLeap(e.target.checked)} />Tháng nhuận</label>}
            {calendar === 'solar'
              ? <label className="tv-f half"><span>Giờ sinh (để trống nếu không biết)</span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
              : <label className="tv-f half"><span>Giờ sinh</span><select value={branch ?? ''} onChange={e => setBranch(e.target.value === '' ? null : +e.target.value)}>
                  <option value="">Không biết</option>{HOURS.map(g => <option key={g.i} value={g.i}>Giờ {g.n} ({g.span})</option>)}</select></label>}
            <label className="tv-f half tv-check" style={{ flexDirection: 'row', alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={approx} onChange={e => setApprox(e.target.checked)} />Giờ ước chừng</label>
            <label className="tv-f"><span>Nơi sinh</span>
              <select value={place} onChange={e => setPlace(e.target.value)}>
                <option value="none">Không rõ</option>
                {own && <option value="own">{b!.place ?? `${b!.latitude}, ${b!.longitude}`}</option>}
                {PLACES.map((p, k) => <option key={p.name} value={k}>{p.name}</option>)}</select></label>
          </>}
          <label className="tv-f"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="ví dụ: giờ sinh theo lời mẹ kể" data-autofocus={owned || undefined} /></label>
        </div>
        {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
        {del.isError && <p className="tv-err">{errorText(del.error)}</p>}
        <div className="sheet-foot">
          {s && (ask
            ? <span className="tv-row" style={{ alignItems: 'center' }}><span className="tv-muted" style={{ fontSize: 13 }}>Xoá người này cùng mọi lá số?</span>
                <button type="button" className="tv-btn accent" disabled={del.isPending} onClick={() => del.mutate()}>Xoá</button>
                <button type="button" className="tv-btn ghost" onClick={() => setAsk(false)}>Không</button></span>
            : <span><button type="button" className="tv-link" onClick={() => setAsk(true)}>Xoá người này</button></span>)}
          {!s && <span />}
          <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
          <button type="button" className="tv-btn accent" disabled={save.isPending || (!owned && !name.trim())} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
    </Sheet>
  );
}
