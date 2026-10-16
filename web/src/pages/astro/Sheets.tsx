/* Saving a chart as a profile — whose it is — and editing or deleting a saved one. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BirthDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed, errorText } from '../../components/Owner';
import { Sheet } from '../../components/Sheet';
import { SONIC_HUB } from '../../lib/people';
import type { AstroParams } from '../../lib/astro';

/** the birth of a chart as a person's (and a profile's) birth */
export function birthOf(p: AstroParams): Partial<BirthDto> {
  const b = p.birth;
  return {
    calendar: 'solar', year: b.year, month: b.month, day: b.day, leapMonth: false, time: b.time, hourBranch: null, timeApprox: !!b.timeApprox,
    timeZone: b.timeZone, utcOffsetMinutes: b.utcOffsetMinutes, place: b.place, latitude: b.latitude, longitude: b.longitude,
  };
}

/** who the chart is about: someone already here, a person from Sonic Hub (linked on save), or someone new */
export function AstroSaveSheet({ params, subjectId, onClose }: { params: AstroParams; subjectId: string | null; onClose: () => void }) {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const persons = useQuery({ queryKey: ['hub-persons'], queryFn: api.sonicHubPersons, retry: false, staleTime: 300_000 });
  const [who, setWho] = useState(subjectId ? `s:${subjectId}` : 'new');
  const [name, setName] = useState(params.name);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const nav = useNavigate(), qc = useQueryClient();
  const linked = new Set((subjects.data ?? []).flatMap(s => s.links.filter(l => l.system === SONIC_HUB).map(l => l.externalId)));
  const hub = (persons.data ?? []).filter(x => !linked.has(x.id));
  const save = useMutation({
    mutationFn: async () => {
      const birth = birthOf(params);
      let sid: string;
      if (who.startsWith('s:')) sid = who.slice(2);
      else if (who.startsWith('h:')) sid = (await api.linkSonicHub(who.slice(2))).id;
      else sid = (await api.createSubject({ displayName: name.trim(), gender: params.gender, birth })).id;
      return api.createProfile({ subjectId: sid, discipline: 'astrology', label: label.trim() || null, note: note.trim() || null, gender: params.gender, birth });
    },
    onSuccess: p => { void qc.invalidateQueries({ queryKey: ['subjects'] }); void qc.invalidateQueries({ queryKey: ['subject'] }); onClose(); nav(`/chiem-tinh/profile/${p.id}`, { replace: true }); },
  });
  const invalid = who === 'new' && !name.trim();
  return (
    <Sheet className="tv as" closable title="Lưu hồ sơ chiêm tinh" sub="Gắn vào một người; hồ sơ giữ nguyên ngày giờ và nơi sinh như lúc lưu." onClose={onClose}>
      {subjects.isError ? <Failed error={subjects.error} /> : (
        <div className="tv-form" style={{ marginTop: 12 }}>
          <label className="tv-f"><span>Cho ai</span>
            <select value={who} onChange={e => setWho(e.target.value)}>
              <option value="new">Người mới{params.name ? `: ${params.name}` : ''}</option>
              {!!subjects.data?.length && <optgroup label="Người đã có ở đây">{subjects.data.map(s => <option key={s.id} value={`s:${s.id}`}>{s.displayName}</option>)}</optgroup>}
              {!!hub.length && <optgroup label="Người trong Sonic Hub (liên kết khi lưu)">{hub.map(x => <option key={x.id} value={`h:${x.id}`}>{x.displayName || x.name}{x.isSelf ? ' (chủ nhà)' : ''}</option>)}</optgroup>}
            </select></label>
          {who === 'new' && <label className="tv-f"><span>Tên người</span><input value={name} onChange={e => setName(e.target.value)} data-autofocus /></label>}
          <label className="tv-f half"><span>Nhãn</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: giờ theo giấy khai sinh" /></label>
          <label className="tv-f half"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
          {who.startsWith('h:') && <p className="tv-muted" style={{ fontSize: 12.5, margin: 0, gridColumn: 'span 6' }}>Người này được liên kết với Sonic Hub; hồ sơ giữ đúng ngày giờ đang xem.</p>}
        </div>
      )}
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      <div className="sheet-foot"><span className="tv-muted" style={{ fontSize: 12.5 }}>Bài tổng hợp được viết sau cho hồ sơ đã lưu.</span>
        <button type="button" className="tv-btn son" disabled={save.isPending || invalid || subjects.isError} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
      </div>
    </Sheet>
  );
}

/** a saved profile's label and note, or the profile deleted (with the synthesis written for it) */
export function AstroProfileSheet({ profile, onClose }: { profile: ProfileDto; onClose: () => void }) {
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
      setTimeout(() => { for (const k of [['profile', profile.id], ['astro-profile-reading', profile.id], ['ai-readings', profile.id]]) qc.removeQueries({ queryKey: k }); }, 100);
      for (const k of ['subjects', 'subject', 'brief']) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
  return (
    <Sheet className="tv as" title="Sửa hồ sơ" sub="Ngày giờ của hồ sơ giữ nguyên như lúc lưu; muốn xem giờ khác thì lập lại từ trang Chiêm tinh." onClose={onClose}>
      <div className="tv-form" style={{ marginTop: 12 }}>
        <label className="tv-f half"><span>Nhãn</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ví dụ: giờ theo giấy khai sinh" /></label>
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
