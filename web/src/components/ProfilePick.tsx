/* The chart's name beside the person's name; when the person has several charts in this room, it switches between
   them (another birth time, another name read…). */
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ProfileDto } from '@mystic/engine/api';
import { api } from '../api';

const URL_OF: Record<string, string> = { tuvi: '/tu-vi/profile/', astrology: '/astrology/profile/', numerology: '/numerology/profile/' };

export function ProfilePick({ profile, fallback, extra }: { profile: ProfileDto | null; fallback: string; extra?: string[] }) {
  const nav = useNavigate();
  const subject = useQuery({ queryKey: ['subject', profile?.subject.id], queryFn: () => api.subject(profile!.subject.id), enabled: !!profile, retry: false, staleTime: 60_000 });
  const tags = (extra ?? []).map(t => <small key={t}>{t}</small>);
  if (!profile) return <>{tags}</>;
  const list = (subject.data?.profiles ?? []).filter(p => p.discipline === profile.discipline).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const name = (p: { label: string | null; name?: string | null }) => p.label || (profile.discipline === 'numerology' && p.name) || fallback;
  if (list.length < 2) return <>{(profile.label || !extra?.length) && <small>{profile.label || fallback}</small>}{tags}</>;
  return (
    <>
      <small className="pick">
        <select value={profile.id} aria-label="Lá số khác của người này" onChange={e => nav(URL_OF[profile.discipline] + e.target.value)}>
          {list.map(p => <option key={p.id} value={p.id}>{name(p)}{p.discipline === 'tuvi' && p.viewYear ? ` · năm ${p.viewYear}` : ''}</option>)}
        </select>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      </small>
      {tags}
    </>
  );
}
