import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import type { EntryDto, ProfileDto, SearchResultDto, SourceDto, SubjectDto, TuViReadingDto } from '@mystic/engine/api';
import { jsonIn, scopeOk } from '../src/ai/ai.service.js';
import { loadConfig } from '../src/config.js';
import { createDb, createPool, ensureDatabase } from '../src/db/db.js';
import { importTuvi } from '../src/kb/importer.js';
import { createApp } from '../src/main.js';

/*
 * End to end against a real Postgres: the database and its role are created from the admin connection, the bundle
 * is imported, then the HTTP API is driven. Needs TEST_DATABASE_URL (a superuser connection to any database).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const dbName = `mystic_e2e_${process.pid}`;
const role = `mystic_e2e_${process.pid}`;
let base = '';
let close: () => Promise<void> = async () => {};
let appUrl = '';

async function api<T>(path: string, body?: unknown, method?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${base}/api${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
}

describe('mystic api', { skip: !adminUrl && 'TEST_DATABASE_URL not set' }, () => {
  before(async () => {
    const env = { ...process.env, DATABASE_URL: '', DATABASE_ADMIN_URL: adminUrl, MYSTIC_DB_NAME: dbName, MYSTIC_DB_USER: role, MYSTIC_DB_PASSWORD: 'e2e-pass', SONIC_HUB_API_URL: '', SYNC_WORKER: 'false', ANTHROPIC_API_KEY: '', NODE_ENV: 'test' };
    const config = loadConfig(env);
    appUrl = await ensureDatabase(config.db);
    const app = await createApp(config);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    close = async () => {
      await app.close();
      const admin = new pg.Client({ connectionString: adminUrl });
      await admin.connect();
      await admin.query(`drop database if exists "${dbName}" with (force)`);
      await admin.query(`drop role if exists "${role}"`);
      await admin.end();
    };
  });
  after(async () => { await close(); });

  test('the knowledge is imported once', async () => {
    const h = await api<{ ok: boolean; rules: number }>('/health');
    assert.equal(h.data.ok, true);
    assert.equal(h.data.rules, 4721);
    const src = await api<SourceDto[]>('/sources');
    const luan = src.data.find(s => s.code === 'tuvi.ba.luan')!;
    assert.equal(luan.kind, 'family');
    assert.equal(luan.rules, 4631);
    assert.equal(src.data.find(s => s.code === 'tuvi.bo-sung')!.kind, 'supplement');
    const pool = createPool(appUrl, false);
    const again = await importTuvi(createDb(pool), loadConfig({ ...process.env, DATABASE_URL: appUrl }).kbBundleDir);
    await pool.end();
    assert.equal(again.skipped, true);
  });

  test('an edit in the database survives a new import', async () => {
    const e = await api<EntryDto>('/sources/tuvi.ba.luan/entries/158');
    const p = e.data.passages.find(x => x.kind !== 'meta')!;
    const edited = await api(`/passages/${p.id}`, { text: `${p.text} (đã sửa)` }, 'PATCH');
    assert.equal(edited.status, 200);
    const rule = e.data.passages.flatMap(x => x.rules)[0];
    const r = await api(`/rules/${rule.code}`, { text: 'Câu đã sửa lại.' }, 'PATCH');
    assert.equal(r.status, 200);
    const bad = await api(`/rules/${rule.code}`, { condition: 'in(Sao Không Có)' }, 'PATCH');
    assert.equal(bad.status, 400);
    const pool = createPool(appUrl, false);
    const re = await importTuvi(createDb(pool), loadConfig({ ...process.env, DATABASE_URL: appUrl }).kbBundleDir, { force: true });
    await pool.end();
    assert.equal(re.skipped, false);
    assert.ok(re.keptEdited >= 2);
    const after = await api<EntryDto>('/sources/tuvi.ba.luan/entries/158');
    const p2 = after.data.passages.find(x => x.id === p.id)!;
    assert.ok(p2.text.endsWith('(đã sửa)'));
    assert.equal(p2.originalText, p.text);
  });

  test('tra cứu and lookup', async () => {
    const s = await api<SearchResultDto>(`/search?q=${encodeURIComponent('con nuôi')}`);
    assert.ok(s.data.total > 0);
    const l = await api<{ total: number }>(`/tuvi/lookup?stars=${encodeURIComponent('Tử Vi,Thiên Phủ')}&target=${encodeURIComponent('Mệnh')}`);
    assert.ok(l.data.total > 0);
    const setup = await api<{ steps: unknown[]; variants: unknown[] }>('/tuvi/setup');
    assert.ok(setup.data.steps.length >= 7);
    assert.equal(setup.data.variants.length, 3);
  });

  test('a reading has every palace, Thân and the hạn', async () => {
    const r = await api<TuViReadingDto>('/tuvi/reading', { birth: { gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5 }, viewYear: 2026 });
    assert.equal(r.status, 200);
    assert.equal(Object.keys(r.data.views).length, 13);
    assert.ok(r.data.views['Mệnh'].counts.ba > 0);
    const codes = r.data.views['Mệnh'].ba.flatMap(g => g.matches.map(m => m.rule));
    for (const c of codes) assert.ok(r.data.rules[c], c);
    const bad = await api('/tuvi/reading', { birth: { gender: 'nam', calendar: 'solar', year: 1990, month: 2, day: 30, hour: 9 } });
    assert.equal(bad.status, 400);
  });

  test('people, profiles at different times, and the brief', async () => {
    const s = await api<SubjectDto>('/subjects', { displayName: 'Người thử', gender: 'female', birth: { calendar: 'lunar', year: 1962, month: 3, day: 12, hourBranch: 6 } });
    assert.equal(s.status, 201);
    const p1 = await api<ProfileDto>('/profiles', { subjectId: s.data.id, label: 'Năm 2026', viewYear: 2026 });
    assert.equal(p1.status, 201);
    const p2 = await api<ProfileDto>('/profiles', { subjectId: s.data.id, label: 'Theo sách', viewYear: 2027, settings: { variant: 'sach' } });
    assert.equal(p2.data.settings.variant, 'sach');
    const subject = await api<SubjectDto>(`/subjects/${s.data.id}`);
    assert.equal(subject.data.profiles.length, 2);
    const reading = await api<TuViReadingDto>(`/profiles/${p1.data.id}/reading`);
    assert.equal(reading.data.chart.lunar.year, 1962);
    assert.equal(reading.data.chart.lunarZone, 8, 'before 1968: the UTC+8 calendar');
    const brief = await api<{ facts: { label: string }[]; lines: unknown[] }>(`/subjects/${s.data.id}/brief`);
    assert.equal(brief.status, 200);
    assert.ok(brief.data.facts.some(f => f.label === 'Mệnh'));
    const noAi = await api(`/profiles/${p1.data.id}/ai-readings`, { scope: 'tong-quan' });
    assert.equal(noAi.status, 503);
    assert.equal((await api(`/profiles/${p2.data.id}`, undefined, 'DELETE')).status, 204);
    assert.equal((await api(`/subjects/${s.data.id}`, undefined, 'DELETE')).status, 204);
  });

  test('Sonic Hub pushes need the sync token', async () => {
    const r = await api('/links/sonic-hub/abc', { name: 'X' }, 'PUT');
    assert.equal(r.status, 403);
  });
});

describe('ai helpers', () => {
  test('reads an answer with stray text and raw line breaks', () => {
    const j = jsonIn('Đây là bài:\n{"sections":[{"title":"Mệnh","ba":[{"text":"dòng một\ndòng hai","refs":["a.1"]}],"them":[]}],"caution":"x"}\ncảm ơn') as { sections: { ba: { text: string }[] }[] };
    assert.equal(j.sections[0].ba[0].text, 'dòng một\ndòng hai');
    assert.equal(jsonIn('không có json'), null);
  });
  test('scopes', () => {
    for (const s of ['tong-quan', 'Mệnh', 'Thân', 'Quan Lộc', 'han-2026']) assert.ok(scopeOk(s), s);
    for (const s of ['', 'han-26', 'Cung lạ']) assert.ok(!scopeOk(s), s);
  });
});
