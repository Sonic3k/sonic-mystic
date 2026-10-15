/* Talks to the Sonic Hub API: reads a person (to link them), lists people (to pick one), and sends or withdraws the
   brief Sonic Hub keeps beside a person. */
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BriefDto, SonicHubPersonDto } from '@mystic/engine/api';
import { APP_CONFIG } from '../common/tokens.js';
import type { AppConfig } from '../config.js';

/** the fields of a Sonic Hub person this service reads */
export interface SonicHubPerson {
  id: string; name: string; displayName?: string | null; nickname?: string | null; avatarUrl?: string | null; isSelf?: boolean | null;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null; birthDay?: number | null; birthMonth?: number | null; birthYear?: number | null;
  birthTime?: string | null; birthTimeApprox?: boolean | null; birthTimeZone?: string | null; birthUtcOffsetMinutes?: number | null;
  birthPlace?: string | null; birthLatitude?: number | null; birthLongitude?: number | null;
}

/** a call Sonic Hub answered with an error (404: no such person there) */
export class SonicHubError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

@Injectable()
export class SonicHubClient {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get configured(): boolean { return !!this.config.sonicHub.apiUrl; }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const base = this.config.sonicHub.apiUrl;
    if (!base) throw new ServiceUnavailableException('Chưa cấu hình SONIC_HUB_API_URL');
    const headers: Record<string, string> = { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) };
    if (this.config.syncToken) headers['x-sync-token'] = this.config.syncToken;
    const res = await fetch(`${base}/api${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new SonicHubError(`Sonic Hub ${init.method ?? 'GET'} ${path}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`, res.status);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  persons(): Promise<SonicHubPersonDto[]> {
    return this.call<SonicHubPerson[]>('/persons').then(list => list.map(p => ({
      id: p.id, name: p.name, displayName: p.displayName ?? null, nickname: p.nickname ?? null, avatarUrl: p.avatarUrl ?? null, isSelf: !!p.isSelf,
    })));
  }

  person(id: string): Promise<SonicHubPerson> { return this.call<SonicHubPerson>(`/persons/${encodeURIComponent(id)}`); }

  putBrief(personId: string, brief: BriefDto): Promise<unknown> {
    return this.call(`/persons/${encodeURIComponent(personId)}/mystic-briefs/${encodeURIComponent(brief.discipline)}`, { method: 'PUT', body: JSON.stringify(brief) });
  }

  deleteBrief(personId: string, discipline: string): Promise<unknown> {
    return this.call(`/persons/${encodeURIComponent(personId)}/mystic-briefs/${encodeURIComponent(discipline)}`, { method: 'DELETE' });
  }
}
