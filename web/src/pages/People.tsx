/* The people readings are about. Someone linked to Sonic Hub takes their name and birth from there (edited there);
   each person can have several profiles — one reading at one moment — and the latest one's brief goes back to
   their page in Sonic Hub. */
import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BirthDto, BriefDto, Gender, SubjectDto } from '@mystic/engine/api';
import { PLACES } from '@mystic/engine/birth';
import { api } from '../api';
import { Failed, errorText } from '../components/Owner';
import { Sheet } from '../components/Sheet';
import { GIO, thisYear } from '../lib/params';
import { SONIC_HUB, birthComplete, birthLine, dateComplete, genderName, profilesLine } from '../lib/people';
import { dateVi, useTitle } from '../lib/text';
import { nsFacts } from './ns/Home';

const hubLink = (s: SubjectDto) => s.links.find(l => l.system === SONIC_HUB);

export function PeoplePage() {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const persons = useQuery({ queryKey: ['hub-persons'], queryFn: api.sonicHubPersons, retry: false, staleTime: 300_000 });
  const [adding, setAdding] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const link = useMutation({
    mutationFn: (personId: string) => api.linkSonicHub(personId),
    onSuccess: s => { void qc.invalidateQueries({ queryKey: ['subjects'] }); nav(`/nguoi/${s.id}`); },
  });
  useTitle('Người');
  if (subjects.isError) return <div className="wrap page tv"><Failed error={subjects.error} /></div>;
  if (!subjects.data) return <div className="wrap page tv"><div className="card empty">Đang mở…</div></div>;
  const linked = new Set(subjects.data.flatMap(s => s.links.filter(l => l.system === SONIC_HUB).map(l => l.externalId)));
  const hub = (persons.data ?? []).filter(p => !linked.has(p.id));
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>Người<small>những người đã xem</small></h1>
        <button type="button" className="tv-btn son" style={{ marginLeft: 'auto' }} onClick={() => setAdding(true)}>Thêm người</button></div>
      {!subjects.data.length && <div className="card empty">Chưa có ai. Liên kết một người từ Sonic Hub bên dưới, thêm người mới, hoặc lưu một lá số.</div>}
      <div className="hh-people">{subjects.data.map(s => (
        <Link key={s.id} className="hh-person" to={`/nguoi/${s.id}`}>
          <b>{s.displayName}{hubLink(s) && <span className="hh-tag">Sonic Hub</span>}</b>
          <small>{[genderName(s.gender), birthLine(s.birth)].filter(Boolean).join(' · ') || 'chưa có ngày sinh'}</small>
          <small>{profilesLine(s)}</small>
        </Link>))}</div>

      {hub.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="hd"><h2>Từ Sonic Hub</h2><span>chưa liên kết · bấm để lấy tên và ngày giờ sinh từ Sonic Hub</span></div>
          <div className="hh-people">{hub.map(p => (
            <button key={p.id} type="button" className="hh-person" style={{ textAlign: 'left' }} disabled={link.isPending} onClick={() => link.mutate(p.id)}>
              <b>{p.displayName || p.name}{p.isSelf && <span className="hh-tag">chủ nhà</span>}</b>
              <small>{p.displayName && p.displayName !== p.name ? p.name : 'Liên kết'}</small>
            </button>))}</div>
          {link.isError && <p className="tv-err">{errorText(link.error)}</p>}
        </section>
      )}
      {persons.isError && <p className="tv-muted" style={{ marginTop: 24, fontSize: 13 }}>Chưa đọc được danh sách người từ Sonic Hub: {errorText(persons.error)}</p>}
      {adding && <SubjectSheet onClose={() => setAdding(false)} onSaved={s => nav(`/nguoi/${s.id}`)} />}
    </div>
  );
}

export function SubjectPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['subject', id], queryFn: () => api.subject(id), retry: false });
  const s = q.data;
  const tuvi = s?.profiles.filter(p => p.discipline === 'tuvi') ?? [], ns = s?.profiles.filter(p => p.discipline === 'numerology') ?? [];
  const astro = s?.profiles.filter(p => p.discipline === 'astrology') ?? [];
  const brief = useQuery({ queryKey: ['brief', id], queryFn: () => api.brief(id), retry: false, enabled: tuvi.length > 0 });
  const nsBrief = useQuery({ queryKey: ['brief', id, 'numerology'], queryFn: () => api.brief(id, 'numerology'), retry: false, enabled: ns.length > 0 });
  const astroBrief = useQuery({ queryKey: ['brief', id, 'astrology'], queryFn: () => api.brief(id, 'astrology'), retry: false, enabled: astro.length > 0 });
  const [editing, setEditing] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const refreshAll = () => ['subject', 'subjects', 'brief'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const make = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, label: tuvi.length ? null : 'Lá số gốc', viewYear: thisYear() }),
    onSuccess: p => { refreshAll(); nav(`/tu-vi/profile/${p.id}`); },
  });
  /* nhân số học needs only the date; the names read come from the person's name (the given name first) */
  const makeNs = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, discipline: 'numerology' }),
    onSuccess: p => { refreshAll(); nav(`/nhan-so-hoc/profile/${p.id}`); },
  });
  /* chiêm tinh reads the person's own date, clock time and place (no time: the planets in the signs only) */
  const makeAstro = useMutation({
    mutationFn: () => api.createProfile({ subjectId: id, discipline: 'astrology' }),
    onSuccess: p => { refreshAll(); nav(`/chiem-tinh/profile/${p.id}`); },
  });
  const pull = useMutation({ mutationFn: () => api.linkSonicHub(hubLink(s!)!.externalId), onSuccess: refreshAll });
  useTitle(s?.displayName ?? 'Người');
  if (q.isError) return <div className="wrap page tv"><Failed error={q.error}><Link className="tv-link" to="/nguoi">Về danh sách</Link></Failed></div>;
  if (!s) return <div className="wrap page tv"><div className="card empty">Đang mở…</div></div>;
  const link = hubLink(s), ready = birthComplete(s.gender, s.birth), dated = dateComplete(s.birth);
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>{s.displayName}</h1><span>{[genderName(s.gender), birthLine(s.birth)].filter(Boolean).join(' · ')}</span></div>
      <div className="tv-subject">
        <div>
          <div className="hd"><h2>Lá số tử vi</h2><span>{tuvi.length}</span></div>
          <div className="tv-profiles">
            {tuvi.map(p => (
              <Link key={p.id} className="tv-profile-item" to={`/tu-vi/profile/${p.id}`}>
                <b>{p.label || 'Lá số'}</b><span>{p.aiReadings ? `${p.aiReadings} bài AI` : ''}</span>
                <small>{[p.viewYear ? `xem năm ${p.viewYear}` : '', `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}</small>
              </Link>))}
            {!tuvi.length && <div className="tv-empty">Chưa có lá số nào.</div>}
          </div>
          <div className="tv-acts" style={{ marginTop: 14 }}>
            <button type="button" className="tv-btn son" disabled={!ready || make.isPending} onClick={() => make.mutate()} title={ready ? undefined : 'Cần giới tính, ngày tháng năm và giờ sinh'}>
              {make.isPending ? 'Đang lập…' : 'Lập lá số từ ngày giờ sinh này'}</button>
            <Link className="tv-btn ghost" to={`/tu-vi?nguoi=${s.id}`}>Lập với giờ hoặc ngày khác…</Link>
          </div>
          {!ready && <p className="tv-muted" style={{ fontSize: 13 }}>Còn thiếu {[!s.gender && 'giới tính', !(s.birth.year && s.birth.month && s.birth.day) && 'ngày sinh', !(s.birth.time || s.birth.hourBranch !== null) && 'giờ sinh'].filter(Boolean).join(', ')}{link ? ' — sửa ở Sonic Hub rồi bấm «Cập nhật từ Sonic Hub».' : '.'}</p>}
          {make.isError && <p className="tv-err">{errorText(make.error)}</p>}

          {brief.data && <Brief b={brief.data} linked={!!link} voice={l => (l.layer === 'primary' ? 'Lời bà' : 'Bổ sung')} />}

          <section className="ns" style={{ marginTop: 36 }}>
            <div className="hd"><h2>Nhân số học</h2><span>{ns.length}</span></div>
            <div className="tv-profiles">
              {ns.map(p => (
                <Link key={p.id} className="tv-profile-item" to={`/nhan-so-hoc/profile/${p.id}`}>
                  <b>{p.name ?? 'Hồ sơ'}{p.label && <span className="hh-tag">{p.label}</span>}</b><span>{p.aiReadings ? 'có bài tổng hợp' : ''}</span>
                  <small>{[nsFacts(p).line, `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}</small>
                </Link>))}
              {!ns.length && <div className="tv-empty">Chưa có hồ sơ nhân số học.</div>}
            </div>
            <div className="tv-acts" style={{ marginTop: 14 }}>
              <button type="button" className="tv-btn son" disabled={!dated || makeNs.isPending} onClick={() => makeNs.mutate()} title={dated ? undefined : 'Cần ngày tháng năm sinh'}>
                {makeNs.isPending ? 'Đang lập…' : 'Lập hồ sơ nhân số học'}</button>
              <Link className="tv-btn ghost" to={`/nhan-so-hoc?nguoi=${s.id}`}>Xem với tên hoặc ngày khác…</Link>
            </div>
            {!dated && <p className="tv-muted" style={{ fontSize: 13 }}>Còn thiếu ngày sinh{link ? ' — sửa ở Sonic Hub rồi bấm «Cập nhật từ Sonic Hub».' : '.'}</p>}
            {makeNs.isError && <p className="tv-err">{errorText(makeNs.error)}</p>}
            {nsBrief.data && <Brief b={nsBrief.data} linked={!!link} voice={l => (l.layer === 'added' ? 'Luận thêm' : l.source.startsWith('Tóm lược') ? 'Tóm lược sách' : 'Lời sách')} />}
          </section>

          <section className="as" style={{ marginTop: 36 }}>
            <div className="hd"><h2>Chiêm tinh</h2><span>{astro.length}</span></div>
            <div className="tv-profiles">
              {astro.map(p => (
                <Link key={p.id} className="tv-profile-item" to={`/chiem-tinh/profile/${p.id}`}>
                  <b>{p.label || 'Lá số chiêm tinh'}</b><span>{p.aiReadings ? 'có bài tổng hợp' : ''}</span>
                  <small>{[birthLine(p.birth), `lưu ${dateVi(p.createdAt)}`].filter(Boolean).join(' · ')}</small>
                </Link>))}
              {!astro.length && <div className="tv-empty">Chưa có lá số chiêm tinh.</div>}
            </div>
            <div className="tv-acts" style={{ marginTop: 14 }}>
              <button type="button" className="tv-btn son" disabled={!dated || s.birth.calendar !== 'solar' || makeAstro.isPending} onClick={() => makeAstro.mutate()} title={dated ? undefined : 'Cần ngày tháng năm sinh'}>
                {makeAstro.isPending ? 'Đang lập…' : 'Lập lá số chiêm tinh'}</button>
              <Link className="tv-btn ghost" to={`/chiem-tinh?nguoi=${s.id}`}>Lập với giờ hoặc nơi khác…</Link>
            </div>
            {(!dated || !s.birth.time || s.birth.latitude === null) && <p className="tv-muted" style={{ fontSize: 13 }}>{!dated ? 'Còn thiếu ngày sinh.' : `Chưa có ${[!s.birth.time && 'giờ sinh (giờ đồng hồ)', s.birth.latitude === null && 'nơi sinh'].filter(Boolean).join(' và ')}: lá số chưa có cung Mọc và các cung địa bàn.`}</p>}
            {makeAstro.isError && <p className="tv-err">{errorText(makeAstro.error)}</p>}
            {astroBrief.data && <Brief b={astroBrief.data} linked={!!link} voice={l => (l.layer === 'added' ? 'Luận thêm' : l.source.startsWith('Tóm lược') ? 'Tóm lược tài liệu' : 'Lời tài liệu')} />}
          </section>
        </div>
        <aside className="tv-card" style={{ padding: '16px 18px' }}>
          <dl className="tv-facts">
            <dt>Giới tính</dt><dd>{genderName(s.gender) ?? '—'}</dd>
            <dt>Ngày sinh</dt><dd>{s.birth.day && s.birth.month && s.birth.year ? `${s.birth.day}/${s.birth.month}${s.birth.leapMonth ? ' nhuận' : ''}/${s.birth.year}${s.birth.calendar === 'lunar' ? ' âm lịch' : ''}` : '—'}</dd>
            <dt>Giờ sinh</dt><dd>{s.birth.time ?? (s.birth.hourBranch !== null ? `giờ ${GIO[s.birth.hourBranch].n}` : '—')}{s.birth.timeApprox ? ' (ước chừng)' : ''}</dd>
            <dt>Nơi sinh</dt><dd>{s.birth.place ?? (s.birth.latitude !== null ? `${s.birth.latitude}, ${s.birth.longitude}` : '—')}</dd>
            {s.birth.timeZone && <><dt>Múi giờ</dt><dd>{s.birth.timeZone}{s.birth.utcOffsetMinutes !== null ? ` (UTC${s.birth.utcOffsetMinutes >= 0 ? '+' : '−'}${Math.abs(s.birth.utcOffsetMinutes) / 60})` : ''}</dd></>}
          </dl>
          {s.note && <p style={{ fontSize: 13.5, margin: '0 0 12px' }}>{s.note}</p>}
          {link && <p style={{ margin: '0 0 12px' }}><span className="tv-linked">liên kết Sonic Hub</span>{link.syncedAt && <small className="tv-muted" style={{ marginLeft: 8, fontSize: 12 }}>cập nhật {dateVi(link.syncedAt)}</small>}</p>}
          <div className="tv-row" style={{ flexDirection: 'column' }}>
            <button type="button" className="tv-btn ghost" onClick={() => setEditing(true)}>{link?.ownsIdentity ? 'Sửa ghi chú' : 'Sửa'}</button>
            {link && <button type="button" className="tv-btn ghost" disabled={pull.isPending} onClick={() => pull.mutate()}>{pull.isPending ? 'Đang cập nhật…' : 'Cập nhật từ Sonic Hub'}</button>}
          </div>
          {pull.isError && <p className="tv-err">{errorText(pull.error)}</p>}
        </aside>
      </div>
      {editing && <SubjectSheet subject={s} onClose={() => setEditing(false)} onSaved={() => refreshAll()} onDeleted={() => nav('/nguoi', { replace: true })} />}
    </div>
  );
}

/** the brief a person's newest profile in a discipline keeps (it also goes to their page in Sonic Hub) */
function Brief({ b, linked, voice }: { b: BriefDto; linked: boolean; voice: (l: BriefDto['lines'][number]) => string }) {
  return (
    <section className="tv-brief" style={{ marginTop: 28 }}>
      <div className="hd"><h2>{b.title}</h2>{b.profileLabel && <span>theo «{b.profileLabel}»</span>}</div>
      <div className="tv-card">
        <dl className="tv-facts">{b.facts.map(f => <Fragment key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></Fragment>)}</dl>
        {b.lines.map((l, i) => (
          <p key={i} className={l.layer === 'primary' ? 'tv-brief-ba' : 'tv-brief-bs'}>
            <span className={`tv-voice ${l.layer === 'primary' ? 'ba' : 'bs'}`}>{voice(l)}</span> {l.text}
          </p>))}
        {linked && <p className="tv-muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Bản tóm tắt này cũng hiện ở trang người trong Sonic Hub.</p>}
      </div>
    </section>
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
                  <option value="">Không biết</option>{GIO.map(g => <option key={g.i} value={g.i}>Giờ {g.n} ({g.span})</option>)}</select></label>}
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
                <button type="button" className="tv-btn son" disabled={del.isPending} onClick={() => del.mutate()}>Xoá</button>
                <button type="button" className="tv-btn ghost" onClick={() => setAsk(false)}>Không</button></span>
            : <span><button type="button" className="tv-link" onClick={() => setAsk(true)}>Xoá người này</button></span>)}
          {!s && <span />}
          <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
          <button type="button" className="tv-btn son" disabled={save.isPending || (!owned && !name.trim())} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
    </Sheet>
  );
}
