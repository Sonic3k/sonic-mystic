/* The Mystic API, typed by the contract in @mystic/engine/api. */
import type {
  AiReadingDto, AiStatusDto, BirthDto, BriefDto, CatalogDto, DisciplineDto, EntryDto, EntrySummaryDto, Gender, LookupResultDto,
  PassageDto, ProfileDto, RuleDto, SearchResultDto, SetupDto, SonicHubPersonDto, SourceDto, SubjectDto, TuViReadingDto, TuViRequest, TuViSettings,
} from '@mystic/engine/api';

const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN = 'mystic.adminToken';

/** the owner's token, when the API asks for one (kept in this browser only) */
export const adminToken = {
  get(): string | null { try { return localStorage.getItem(TOKEN); } catch { return null; } },
  set(v: string | null) { try { if (v) localStorage.setItem(TOKEN, v); else localStorage.removeItem(TOKEN); } catch { /* private mode */ } },
};

export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const t = adminToken.get();
  if (t) headers['x-admin-token'] = t;
  const res = await fetch(`${API}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try { const j = await res.json(); msg = Array.isArray(j.message) ? j.message.join('; ') : j.message ?? j.error ?? msg; } catch { /* not json */ }
    throw new ApiError(msg, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
const get = <T,>(p: string) => call<T>('GET', p);
const q = (o: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : '';
};

export interface SubjectInput { displayName: string; gender: Gender | null; birth: Partial<BirthDto>; note?: string | null }
export interface RulePatch { text?: string; context?: string | null; condition?: string | null; tone?: RuleDto['tone']; active?: boolean; reviewNote?: string | null }
export interface ProfileInput {
  subjectId: string; label?: string | null; viewYear?: number | null; note?: string | null;
  gender?: Gender | null; birth?: Partial<BirthDto> | null; settings?: Partial<TuViSettings>;
}

export interface ProfilePatch { label?: string | null; viewYear?: number | null; note?: string | null; settings?: Partial<TuViSettings> }

export const api = {
  disciplines: () => get<DisciplineDto[]>('/disciplines'),
  sources: (discipline = 'tuvi') => get<SourceDto[]>(`/sources${q({ discipline })}`),
  entries: (source: string) => get<EntrySummaryDto[]>(`/sources/${encodeURIComponent(source)}/entries`),
  entry: (source: string, key: string | number) => get<EntryDto>(`/sources/${encodeURIComponent(source)}/entries/${encodeURIComponent(String(key))}`),
  search: (text: string, limit = 150) => get<SearchResultDto>(`/search${q({ q: text, limit })}`),
  lookup: (stars: string[], target?: string) => get<LookupResultDto>(`/tuvi/lookup${q({ stars: stars.join(','), target })}`),
  setup: () => get<SetupDto>('/tuvi/setup'),
  catalog: () => get<CatalogDto>('/tuvi/catalog'),
  reading: (r: TuViRequest) => call<TuViReadingDto>('POST', '/tuvi/reading', r),
  editPassage: (id: number, text: string) => call<PassageDto>('PATCH', `/passages/${id}`, { text }),
  editRule: (code: string, patch: RulePatch) => call<RuleDto>('PATCH', `/rules/${encodeURIComponent(code)}`, patch),

  subjects: () => get<SubjectDto[]>('/subjects'),
  subject: (id: string) => get<SubjectDto>(`/subjects/${id}`),
  createSubject: (b: SubjectInput) => call<SubjectDto>('POST', '/subjects', b),
  updateSubject: (id: string, b: SubjectInput) => call<SubjectDto>('PUT', `/subjects/${id}`, b),
  deleteSubject: (id: string) => call<void>('DELETE', `/subjects/${id}`),
  brief: (id: string) => get<BriefDto>(`/subjects/${id}/brief`),
  sonicHubPersons: () => get<SonicHubPersonDto[]>('/links/sonic-hub/persons'),
  linkSonicHub: (personId: string) => call<SubjectDto>('POST', `/links/sonic-hub/${encodeURIComponent(personId)}`),

  createProfile: (b: ProfileInput) => call<ProfileDto>('POST', '/profiles', b),
  profile: (id: string) => get<ProfileDto>(`/profiles/${id}`),
  profileReading: (id: string, year?: number) => get<TuViReadingDto>(`/profiles/${id}/reading${q({ year })}`),
  updateProfile: (id: string, b: ProfilePatch) => call<ProfileDto>('PATCH', `/profiles/${id}`, b),
  deleteProfile: (id: string) => call<void>('DELETE', `/profiles/${id}`),

  aiStatus: () => get<AiStatusDto>('/ai/status'),
  aiReadings: (profileId: string) => get<AiReadingDto[]>(`/profiles/${profileId}/ai-readings`),
  generate: (profileId: string, scope: string, viewYear: number) => call<AiReadingDto>('POST', `/profiles/${profileId}/ai-readings`, { scope, viewYear }),
  removeReading: (id: string) => call<void>('DELETE', `/ai-readings/${id}`),
};

export const SOURCES = { luan: 'tuvi.ba.luan', phan1: 'tuvi.ba.phan1', supplement: 'tuvi.bo-sung' } as const;
