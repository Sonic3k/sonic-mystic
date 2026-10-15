/* Saving a reading as a profile — whose it is, and the names it reads — and editing the names a reading reads. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NumerologyNameDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed, errorText } from '../../components/Owner';
import { Sheet } from '../../components/Sheet';
import { SONIC_HUB } from '../../lib/people';
import type { NsParams } from '../../lib/ns';

const NOTE = 'Đổi tên đọc thì bài tổng hợp cũ được đánh dấu để viết lại.';

/** the names as written in the sheet: empty rows left out, exactly one read */
export function cleanNames(rows: NumerologyNameDto[]): NumerologyNameDto[] {
  const out = rows.map(n => ({ label: n.label?.trim() || null, text: n.text.trim(), primary: n.primary })).filter(n => n.text);
  const i = Math.max(0, out.findIndex(n => n.primary));
  return out.map((n, k) => ({ ...n, primary: k === i }));
}

/** one row per name: the one read (radio), what the name is to the person, and the name */
function NameRows({ rows, setRows }: { rows: NumerologyNameDto[]; setRows: (r: NumerologyNameDto[]) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    box.current?.querySelector<HTMLInputElement>('.ns-namerow:last-child input:not(.lbl):not([type=radio])')?.focus();
    setAdded(false);
  }, [added]);
  const set = (i: number, patch: Partial<NumerologyNameDto>) => setRows(rows.map((n, k) => (k === i ? { ...n, ...patch } : patch.primary ? { ...n, primary: false } : n)));
  const drop = (i: number) => {
    const r = rows.filter((_, k) => k !== i);
    setRows(r.length && !r.some(n => n.primary) ? r.map((n, k) => ({ ...n, primary: k === 0 })) : r);
  };
  return (
    <div className="tv-f"><span>Các tên đọc</span>
      <div className="ns-namerows" ref={box}>{rows.map((n, i) => (
        <div key={i} className="ns-namerow">
          <input type="radio" name="ns-primary" checked={n.primary} onChange={() => set(i, { primary: true })} aria-label="Đọc theo tên này" />
          <input className="tv-input lbl" value={n.label ?? ''} onChange={e => set(i, { label: e.target.value })} placeholder="Tên gọi, tên ở nhà…" aria-label="Loại tên" />
          <input className="tv-input" value={n.text} onChange={e => set(i, { text: e.target.value })} aria-label="Tên" />
          <button type="button" onClick={() => drop(i)} aria-label="Bỏ tên này">×</button>
        </div>))}</div>
      <button type="button" className="tv-link" style={{ alignSelf: 'flex-start', marginTop: 4 }}
        onClick={() => { setRows([...rows, { label: 'Tên ở nhà', text: '', primary: !rows.length }]); setAdded(true); }}>+ Thêm tên</button>
    </div>
  );
}

/** who the reading is about: someone already here, a person from Sonic Hub (linked on save), or someone new */
export function SaveSheet({ params, subjectId, onClose }: { params: NsParams; subjectId: string | null; onClose: () => void }) {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const persons = useQuery({ queryKey: ['hub-persons'], queryFn: api.sonicHubPersons, retry: false, staleTime: 300_000 });
  const [who, setWho] = useState(subjectId ? `s:${subjectId}` : 'new');
  const [name, setName] = useState(params.full);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<NumerologyNameDto[]>(params.names);
  const nav = useNavigate(), qc = useQueryClient();
  const linked = new Set((subjects.data ?? []).flatMap(s => s.links.filter(l => l.system === SONIC_HUB).map(l => l.externalId)));
  const hub = (persons.data ?? []).filter(x => !linked.has(x.id));
  const save = useMutation({
    mutationFn: async () => {
      const b = params.birth, birth = { calendar: b.calendar, year: b.year, month: b.month, day: b.day, leapMonth: b.leapMonth };
      let sid: string;
      if (who.startsWith('s:')) sid = who.slice(2);
      else if (who.startsWith('h:')) sid = (await api.linkSonicHub(who.slice(2))).id;
      else sid = (await api.createSubject({ displayName: name.trim(), gender: params.gender, birth })).id;
      return api.createProfile({
        subjectId: sid, discipline: 'numerology', label: label.trim() || null, note: note.trim() || null, viewYear: params.viewYear,
        gender: params.gender, birth, names: cleanNames(rows),
      });
    },
    onSuccess: p => { void qc.invalidateQueries({ queryKey: ['subjects'] }); void qc.invalidateQueries({ queryKey: ['subject'] }); onClose(); nav(`/nhan-so-hoc/profile/${p.id}`, { replace: true }); },
  });
  const invalid = (who === 'new' && !name.trim()) || !cleanNames(rows).length;
  return (
    <Sheet className="tv ns" closable title="Lưu hồ sơ nhân số học" sub="Gắn vào một người; hồ sơ giữ nguyên ngày sinh và các tên như lúc lưu." onClose={onClose}>
      {subjects.isError ? <Failed error={subjects.error} /> : (
        <div className="tv-form" style={{ marginTop: 12 }}>
          <label className="tv-f"><span>Cho ai</span>
            <select value={who} onChange={e => setWho(e.target.value)}>
              <option value="new">Người mới{params.full ? `: ${params.full}` : ''}</option>
              {!!subjects.data?.length && <optgroup label="Người đã có ở đây">{subjects.data.map(s => <option key={s.id} value={`s:${s.id}`}>{s.displayName}</option>)}</optgroup>}
              {!!hub.length && <optgroup label="Người trong Sonic Hub (liên kết khi lưu)">{hub.map(x => <option key={x.id} value={`h:${x.id}`}>{x.displayName || x.name}{x.isSelf ? ' (chủ nhà)' : ''}</option>)}</optgroup>}
            </select></label>
          {who === 'new' && <label className="tv-f"><span>Tên người</span><input value={name} onChange={e => setName(e.target.value)} data-autofocus /></label>}
          <label className="tv-f half"><span>Nhãn</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: theo tên khai sinh" /></label>
          <label className="tv-f half"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
          <NameRows rows={rows} setRows={setRows} />
          {who.startsWith('h:') && <p className="tv-muted" style={{ fontSize: 12.5, margin: 0, gridColumn: 'span 6' }}>Người này được liên kết với Sonic Hub; hồ sơ giữ đúng ngày sinh và các tên đang xem.</p>}
        </div>
      )}
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      <div className="sheet-foot"><span className="tv-muted" style={{ fontSize: 12.5 }}>{NOTE}</span>
        <button type="button" className="tv-btn son" disabled={save.isPending || invalid || subjects.isError} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
      </div>
    </Sheet>
  );
}

/** a saved profile's label and note, or the profile deleted (with the synthesis written for it) */
export function ProfileSheet({ profile, onClose }: { profile: ProfileDto; onClose: () => void }) {
  const [label, setLabel] = useState(profile.label ?? '');
  const [note, setNote] = useState(profile.note ?? '');
  const [ask, setAsk] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.updateProfile(profile.id, { label: label.trim() || null, note: note.trim() || null }),
    onSuccess: () => { for (const k of ['profile', 'subjects', 'subject', 'brief']) void qc.invalidateQueries({ queryKey: [k] }); onClose(); },
  });
  const del = useMutation({
    mutationFn: () => api.deleteProfile(profile.id),
    onSuccess: () => {
      onClose();
      nav(`/nguoi/${profile.subject.id}`, { replace: true });
      /* once this page has gone, the deleted profile's queries are dropped (asking for them again would only 404) */
      setTimeout(() => { for (const k of [['profile', profile.id], ['ns-profile-reading', profile.id], ['ai-readings', profile.id]]) qc.removeQueries({ queryKey: k }); }, 100);
      for (const k of ['subjects', 'subject', 'brief']) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
  return (
    <Sheet className="tv ns" title="Sửa hồ sơ" sub="Ngày sinh của hồ sơ giữ nguyên như lúc lưu; muốn đọc ngày khác thì xem lại từ trang Nhân số học." onClose={onClose}>
      <div className="tv-form" style={{ marginTop: 12 }}>
        <label className="tv-f half"><span>Nhãn</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: theo tên khai sinh" /></label>
        <label className="tv-f half"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
      </div>
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      {del.isError && <p className="tv-err">{errorText(del.error)}</p>}
      <div className="sheet-foot">
        {ask
          ? <span className="tv-row" style={{ alignItems: 'center' }}><span className="tv-muted" style={{ fontSize: 13 }}>Xoá hồ sơ và bài tổng hợp?</span>
              <button type="button" className="tv-btn son" disabled={del.isPending} onClick={() => del.mutate()}>Xoá</button>
              <button type="button" className="tv-btn ghost" onClick={() => setAsk(false)}>Không</button></span>
          : <span><button type="button" className="tv-link" onClick={() => setAsk(true)}>Xoá hồ sơ này</button></span>}
        <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
        <button type="button" className="tv-btn son" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Sheet>
  );
}

/** the names read: a saved profile is changed (its synthesis is then marked to be rewritten); a link only redrawn */
export function NamesSheet({ names, profileId, onClose, onSave }: {
  names: NumerologyNameDto[]; profileId?: string; onClose: () => void; onSave: (names: NumerologyNameDto[]) => void;
}) {
  const [rows, setRows] = useState<NumerologyNameDto[]>(names.length ? names : [{ label: 'Tên gọi', text: '', primary: true }]);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (list: NumerologyNameDto[]) => { if (profileId) await api.updateProfile(profileId, { names: list }); return list; },
    onSuccess: list => {
      if (profileId) for (const k of ['profile', 'ns-profile-reading', 'ai-readings', 'subjects', 'subject', 'brief']) void qc.invalidateQueries({ queryKey: [k] });
      onSave(list);
    },
  });
  return (
    <Sheet className="tv ns" closable title="Sửa các tên đọc" sub="Tên được chọn là tên bài đọc nói đến; các tên khác vẫn xem được." onClose={onClose}>
      <div className="tv-form" style={{ marginTop: 12 }}><NameRows rows={rows} setRows={setRows} /></div>
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      <div className="sheet-foot"><span className="tv-muted" style={{ fontSize: 12.5 }}>{NOTE}</span>
        <button type="button" className="tv-btn son" disabled={save.isPending} onClick={() => save.mutate(cleanNames(rows))}>{save.isPending ? 'Đang lưu…' : 'Dùng các tên này'}</button>
      </div>
    </Sheet>
  );
}
