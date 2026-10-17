/* Nhân số học's front page: the birth and the name (the numbers shown as they are typed), the book, and the
   profiles kept. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BirthError, solarDateOf } from '@mystic/engine/birth';
import { NumerologyError, buildNumerology, label as L } from '@mystic/engine/numerology';
import type { Gender, NumerologyNameDto, ProfileSummaryDto, SubjectDto } from '@mystic/engine/api';
import { api } from '../../api';
import { defaultNames, dmy, fromNumerologySearch, toNumerologySearch, withPrimary, SAMPLE, type NumerologyParams } from '../../lib/numerology';
import { fold, useTitle } from '../../lib/text';
import { useNumerologyBook } from './Reading';

interface Form { full: string; cal: 'solar' | 'lunar'; d: string; m: string; y: string; leap: boolean; gender: Gender | null; names: NumerologyNameDto[] | null; pick: number }
const blank: Form = { full: '', cal: 'solar', d: '', m: '', y: '', leap: false, gender: null, names: null, pick: 0 };
const num = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : NaN);

/** the form as the reading it asks for, or what is wrong with it */
function readForm(f: Form): { params: NumerologyParams | null; error: string | null } {
  const day = num(f.d), month = num(f.m), year = num(f.y);
  if (!f.d.trim() && !f.m.trim() && !f.y.trim()) return { params: null, error: null };
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return { params: null, error: 'Nhập đủ ngày, tháng và năm sinh.' };
  if (year < 1800 || year > 2200) return { params: null, error: 'Năm sinh từ 1800 đến 2200.' };
  const list = f.names ?? defaultNames(f.full);
  const names = list.length ? withPrimary(list, Math.min(f.pick, list.length - 1)) : [];
  return { params: { full: f.full.trim(), birth: { calendar: f.cal, year, month, day, leapMonth: f.cal === 'lunar' && f.leap, latitude: null }, gender: f.gender, names, viewYear: null }, error: null };
}

/** the numbers of a reading, worked out here as the form is typed (the page then reads them from the book) */
function numbersOf(p: NumerologyParams) {
  try {
    const solar = solarDateOf({ ...p.birth, latitude: p.birth.latitude ?? null });
    const chart = buildNumerology({ year: solar.year, month: solar.month, day: solar.day, gender: p.gender, names: p.names });
    return { chart, solar, error: null };
  } catch (e) {
    if (e instanceof BirthError || e instanceof NumerologyError) return { chart: null, solar: null, error: e.message };
    throw e;
  }
}

function formOf(p: NumerologyParams): Form {
  const auto = defaultNames(p.full);
  const same = auto.length === p.names.length && auto.every((n, i) => n.text === p.names[i].text && n.label === p.names[i].label);
  return {
    full: p.full, cal: p.birth.calendar, d: String(p.birth.day), m: String(p.birth.month), y: String(p.birth.year), leap: p.birth.leapMonth, gender: p.gender,
    names: same ? null : p.names, pick: Math.max(0, p.names.findIndex(n => n.primary)),
  };
}
function formOfSubject(s: SubjectDto): Form {
  const b = s.birth;
  return { ...blank, full: s.displayName, cal: b.calendar, d: b.day ? String(b.day) : '', m: b.month ? String(b.month) : '', y: b.year ? String(b.year) : '', leap: b.leapMonth, gender: s.gender };
}

export default function NumerologyHome() {
  const [sp] = useSearchParams();
  const subjectId = sp.get('person');
  const subject = useQuery({ queryKey: ['subject', subjectId], queryFn: () => api.subject(subjectId!), enabled: !!subjectId, retry: false });
  /* a link back from a reading carries its birth and names; "?person=" alone fills the form with what is known of that person */
  const initial = useMemo<Form | null>(() => {
    const own = fromNumerologySearch(sp);
    if (own) return formOf(own);
    if (subjectId) return subject.data ? formOfSubject(subject.data) : subject.isError ? blank : null;
    return blank;
  }, [sp, subjectId, subject.data, subject.isError]);
  useTitle('Nhân số học');
  return (
    <div className="wrap page tv ns">
      <div className="ptitle"><h1>Nhân số học<small>theo sách của Lê Đỗ Quỳnh Hương</small></h1></div>
      <div className="tv-home">
        {initial ? <BirthForm key={sp.toString() + (subject.data?.id ?? '')} initial={initial} subjectId={subjectId} /> : <div className="tv-card"><div className="tv-muted">Đang mở…</div></div>}
        <BookCard />
      </div>
      <Saved />
    </div>
  );
}

function BirthForm({ initial, subjectId }: { initial: Form; subjectId: string | null }) {
  const [f, setF] = useState<Form>(initial);
  const nav = useNavigate();
  const set = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }));
  const { params, error } = readForm(f);
  const r = params ? numbersOf(params) : null;
  const names = params?.names ?? (f.names ?? defaultNames(f.full)).map((n, i) => ({ ...n, primary: i === f.pick }));
  const pick = (i: number) => set(f.names ? { names: withPrimary(f.names, i), pick: i } : { pick: i });
  const go = (p: NumerologyParams) => nav(`/numerology/view?${toNumerologySearch(p)}${subjectId ? `&person=${subjectId}` : ''}`);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (params && r?.chart) go(params); };
  const msg = error ?? r?.error ?? null;
  return (
    <form className="tv-card" onSubmit={submit} autoComplete="off">
      <h2>Xem các con số</h2>
      <p>Từ ngày sinh và tên, theo cách tính của sách. Không cần giờ sinh.</p>
      <div className="tv-form">
        <label className="tv-f"><span>Họ và tên</span><input value={f.full} onChange={e => set({ full: e.target.value, names: null, pick: 0 })} placeholder="Ví dụ: Nguyễn Văn An" /></label>
        <div className="tv-f"><span>Đọc theo tên</span>
          <div className="ns-names" role="group" aria-label="Tên được đọc">{names.length
            ? names.map((n, i) => <button key={i} type="button" className={n.primary ? 'on' : ''} onClick={() => pick(i)}>{n.text} <small>{n.label ?? ''}</small></button>)
            : <span className="tv-muted">Nhập tên để chọn</span>}</div>
        </div>
        <div className="tv-f"><span>Ngày sinh</span>
          <div className="seg" role="group" aria-label="Lịch">
            <button type="button" className={f.cal === 'solar' ? 'on' : ''} onClick={() => set({ cal: 'solar', leap: false })}>Dương lịch</button>
            <button type="button" className={f.cal === 'lunar' ? 'on' : ''} onClick={() => set({ cal: 'lunar' })}>Âm lịch</button>
          </div>
          <div className="tv-row">
            <input inputMode="numeric" aria-label="Ngày" placeholder="Ngày" value={f.d} onChange={e => set({ d: e.target.value })} />
            <input inputMode="numeric" aria-label="Tháng" placeholder="Tháng" value={f.m} onChange={e => set({ m: e.target.value })} />
            <input inputMode="numeric" aria-label="Năm" placeholder="Năm" value={f.y} onChange={e => set({ y: e.target.value })} />
          </div>
          {f.cal === 'lunar' && <label className="tv-check"><input type="checkbox" checked={f.leap} onChange={e => set({ leap: e.target.checked })} /> Tháng nhuận</label>}
        </div>
        <div className="tv-f"><span>Giới tính <span className="tv-muted" style={{ fontWeight: 500 }}>(không bắt buộc)</span></span>
          <div className="seg" role="group" aria-label="Giới tính">{([['female', 'Nữ'], ['male', 'Nam'], [null, 'Không ghi']] as const).map(([v, t]) => (
            <button key={t} type="button" className={f.gender === v ? 'on' : ''} onClick={() => set({ gender: v })}>{t}</button>))}</div>
        </div>
        <div className="tv-form-foot">
          <button className="tv-btn accent" type="submit" disabled={!r?.chart}>Xem các con số</button>
          <SampleLink />
        </div>
        <div className="tv-form-foot" aria-live="polite">
          {msg ? <span className="tv-err">{msg}</span>
            : r?.chart ? <span>Chủ đạo <b>{L(r.chart.ruling)}</b> · ngày sinh <b>{L(r.chart.birthday)}</b> · năm cá nhân <b>{r.chart.now.year.n}</b> (đến {dmy(r.chart.now.year.end)}){r.solar.fromLunar ? ` · dương lịch ${r.solar.day}/${r.solar.month}/${r.solar.year}` : ''}</span>
              : <span className="tv-muted">Các con số hiện ở đây khi nhập ngày sinh.</span>}
        </div>
      </div>
    </form>
  );
}

/** the book's own example: the saved profile with its synthesis when there is one, else the reading of the link */
function SampleLink() {
  const q = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const saved = (q.data ?? []).flatMap(s => s.profiles).find(p => p.discipline === 'numerology' && p.label === 'ví dụ trong sách');
  return <Link className="tv-btn ghost" to={saved ? `/numerology/profile/${saved.id}` : `/numerology/view?${toNumerologySearch(SAMPLE)}`}>Mở ví dụ trong sách</Link>;
}

function BookCard() {
  const book = useNumerologyBook();
  const b = book.data;
  const parts = b?.toc.filter(e => e.kind === 'part').length ?? 0;
  const rules = b?.toc.reduce((n, e) => n + e.rules, 0) ?? 0;
  return (
    <div className="tv-card tv-book-card">
      <div className="tv-k">Sách</div>
      <h2>{b?.source.title ?? 'Thay đổi cuộc sống với Nhân số học'}</h2>
      <p style={{ margin: '2px 0 14px', color: 'var(--ink2)', fontSize: 13.5 }}>{[b?.source.author ?? 'Lê Đỗ Quỳnh Hương', b?.source.description].filter(Boolean).join(' · ')}</p>
      {b && <div className="tv-stats"><div><b>{parts}</b><span>phần</span></div><div><b>{b.toc.length}</b><span>mục</span></div><div><b>{rules}</b><span>đoạn nói về một người</span></div></div>}
      {book.isError && <p className="tv-muted" style={{ fontSize: 13 }}>Sách chưa được nạp.</p>}
      <div className="tv-acts"><Link className="tv-btn ghost" to="/numerology/books">Đọc sách</Link><Link className="tv-btn ghost" to="/numerology/lookup">Tra cứu theo con số</Link></div>
      <div className="tv-legend">
        <p><span className="tv-voice primary">Lời sách</span> Mỗi đoạn của sách được gắn điều kiện: khi xem cho một người, chỉ những đoạn nói về con số của người ấy hiện ra, kèm lý do.</p>
        <p><span className="tv-voice ai">Claude luận thêm</span> Bài tổng hợp của mỗi người do Claude viết từ những đoạn đó; ý nào không phải của sách luôn được ghi rõ.</p>
      </div>
    </div>
  );
}

/** a saved profile's numbers, from the birth it keeps */
export function numerologyFacts(p: ProfileSummaryDto): { date: string; line: string } {
  const b = p.birth;
  const date = b.day && b.month && b.year ? `${b.day}/${b.month}${b.leapMonth ? ' nhuận' : ''}/${b.year}${b.calendar === 'lunar' ? ' âm lịch' : ''}` : 'chưa có ngày sinh';
  if (!b.day || !b.month || !b.year) return { date, line: '' };
  try {
    const s = solarDateOf({ calendar: b.calendar, year: b.year, month: b.month, day: b.day, leapMonth: b.leapMonth, latitude: b.latitude });
    const c = buildNumerology({ year: s.year, month: s.month, day: s.day, gender: p.gender, names: [] });
    return { date, line: `chủ đạo ${L(c.ruling)} · năm cá nhân ${c.now.year.n}` };
  } catch { return { date, line: '' }; }
}

function Saved() {
  const q = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const [find, setFind] = useState('');
  const all = (q.data ?? []).flatMap(s => s.profiles.filter(p => p.discipline === 'numerology').map(p => ({ s, p })));
  if (!all.length) return null;
  const f = fold(find.trim());
  const list = f ? all.filter(({ s, p }) => fold(`${p.name ?? ''} ${s.displayName}`).includes(f)) : all;
  return (
    <section style={{ marginTop: 32 }} id="saved">
      <div className="hd"><h2>Đã lưu</h2><span>{all.length}</span>
        {all.length > 12 && <input className="tv-input" style={{ marginLeft: 'auto', maxWidth: 220, height: 34 }} value={find} onChange={e => setFind(e.target.value)} placeholder="Tìm người…" aria-label="Tìm trong hồ sơ đã lưu" />}</div>
      <div className="tv-saved-list">{list.map(({ s, p }) => {
        const x = numerologyFacts(p);
        const g = p.gender === 'female' ? 'Nữ' : p.gender === 'male' ? 'Nam' : '';
        return (
          <Link key={p.id} className="tv-saved-item" to={`/numerology/profile/${p.id}`}>
            <b>{p.name ?? s.displayName}{p.label && <span className="hh-tag">{p.label === 'ví dụ trong sách' ? 'ví dụ' : p.label}</span>}</b>
            <small>{[g, x.date].filter(Boolean).join(' · ')}{p.name && p.name !== s.displayName ? ` · ${s.displayName}` : ''}</small>
            <small>{[x.line, p.aiReadings ? 'có bài tổng hợp' : 'chưa có bài tổng hợp'].filter(Boolean).join(' · ')}</small>
          </Link>);
      })}</div>
      {!list.length && <div className="tv-empty">Không thấy ai tên như vậy.</div>}
    </section>
  );
}
