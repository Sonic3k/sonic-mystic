import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { gzipSync } from 'node:zlib';
import pg from 'pg';
import type {
  AiReadingDto, AstrologyBookDto, AstrologyChartDto, AstrologyEntryDto, AstrologyLookupDto, AstrologyReadingDto, BriefDto, EntryDto, NumerologyBookDto,
  NumerologyEntryDto, NumerologyLookupDto, NumerologyReadingDto, ProfileDto, SearchResultDto, SourceDto, SubjectDto, TuViReadingDto,
} from '@mystic/engine/api';
import { jsonIn, scopeOk } from '../src/ai/ai.service.js';
import { loadConfig } from '../src/config.js';
import { createDb, createPool, ensureDatabase } from '../src/db/db.js';
import { importTuvi } from '../src/kb/importer.js';
import { importNumerology, readNumerologyBundle } from '../src/kb/numerology-importer.js';
import { importAstrology, readAstrologyBundle } from '../src/kb/astrology-importer.js';
import { createApp } from '../src/main.js';

/*
 * End to end against a real Postgres: the database and its role are created from the admin connection, the bundle
 * is imported, then the HTTP API is driven. Needs TEST_DATABASE_URL (a superuser connection to any database).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const numerologyDir = join(loadConfig({ DATABASE_URL: 'x' }).kbBundleDir, 'numerology');
const hasBook = existsSync(join(numerologyDir, 'manifest.json'));
const astrologyDir = join(loadConfig({ DATABASE_URL: 'x' }).kbBundleDir, 'astrology');
const hasAstrology = existsSync(join(astrologyDir, 'manifest.json'));
const dbName = `mystic_e2e_${process.pid}`;
const role = `mystic_e2e_${process.pid}`;
const ADMIN = 'e2e-admin-token';
let base = '';
let close: () => Promise<void> = async () => {};
let appUrl = '';

/** a call as the owner (with the admin token), or as anyone when anon */
async function api<T>(path: string, body?: unknown, method?: string, opts: { anon?: boolean } = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${base}/api${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', ...(opts.anon ? {} : { 'x-admin-token': ADMIN }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
}
const anon = <T>(path: string, body?: unknown, method?: string) => api<T>(path, body, method, { anon: true });

describe('mystic api', { skip: !adminUrl && 'TEST_DATABASE_URL not set' }, () => {
  before(async () => {
    const env = { ...process.env, DATABASE_URL: '', DATABASE_ADMIN_URL: adminUrl, MYSTIC_DB_NAME: dbName, MYSTIC_DB_USER: role, MYSTIC_DB_PASSWORD: 'e2e-pass', SONIC_HUB_API_URL: '', SYNC_WORKER: 'false', ANTHROPIC_API_KEY: '', ADMIN_TOKEN: ADMIN, NODE_ENV: 'test' };
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
    const notes = src.data.find(s => s.code === 'tuvi.grandma.notes')!;
    assert.equal(notes.kind, 'family');
    assert.equal(notes.rules, 4631);
    assert.equal(src.data.find(s => s.code === 'tuvi.supplement')!.kind, 'supplement');
    const pool = createPool(appUrl, false);
    const again = await importTuvi(createDb(pool), loadConfig({ ...process.env, DATABASE_URL: appUrl }).kbBundleDir);
    await pool.end();
    assert.equal(again.skipped, true);
  });

  test('an edit in the database survives a new import', async () => {
    const e = await api<EntryDto>('/sources/tuvi.grandma.notes/entries/158');
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
    const after = await api<EntryDto>('/sources/tuvi.grandma.notes/entries/158');
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
    const r = await api<TuViReadingDto>('/tuvi/reading', { birth: { gender: 'male', calendar: 'solar', year: 1990, month: 2, day: 8, hour: 9, minute: 5 }, viewYear: 2026 });
    assert.equal(r.status, 200);
    assert.equal(Object.keys(r.data.views).length, 13);
    assert.ok(r.data.views['Mệnh'].counts.grandma > 0);
    const codes = r.data.views['Mệnh'].grandma.flatMap(g => g.matches.map(m => m.rule));
    for (const c of codes) assert.ok(r.data.rules[c], c);
    const bad = await api('/tuvi/reading', { birth: { gender: 'male', calendar: 'solar', year: 1990, month: 2, day: 30, hour: 9 } });
    assert.equal(bad.status, 400);
  });

  test('people, profiles at different times, and the brief', async () => {
    const s = await api<SubjectDto>('/subjects', { displayName: 'Người thử', gender: 'female', birth: { calendar: 'lunar', year: 1962, month: 3, day: 12, hourBranch: 6 } });
    assert.equal(s.status, 201);
    const p1 = await api<ProfileDto>('/profiles', { subjectId: s.data.id, label: 'Năm 2026', viewYear: 2026 });
    assert.equal(p1.status, 201);
    const p2 = await api<ProfileDto>('/profiles', { subjectId: s.data.id, label: 'Theo sách', viewYear: 2027, settings: { variant: 'books' } });
    assert.equal(p2.data.settings?.variant, 'books');
    const subject = await api<SubjectDto>(`/subjects/${s.data.id}`);
    assert.equal(subject.data.profiles.length, 2);
    const reading = await api<TuViReadingDto>(`/profiles/${p1.data.id}/reading`);
    assert.equal(reading.data.chart.lunar.year, 1962);
    assert.equal(reading.data.chart.lunarZone, 8, 'before 1968: the UTC+8 calendar');
    const brief = await api<{ facts: { label: string }[]; lines: unknown[] }>(`/subjects/${s.data.id}/brief`);
    assert.equal(brief.status, 200);
    assert.ok(brief.data.facts.some(f => f.label === 'Mệnh'));
    const noAi = await api(`/profiles/${p1.data.id}/ai-readings`, { scope: 'overview' });
    assert.equal(noAi.status, 503);
    assert.equal((await api(`/profiles/${p2.data.id}`, undefined, 'DELETE')).status, 204);
    assert.equal((await api(`/subjects/${s.data.id}`, undefined, 'DELETE')).status, 204);
  });

  test('a reading weighed section by section, its Nhận định, and the person\'s Nhận định chung', async () => {
    const s = await api<SubjectDto>('/subjects', { displayName: 'Người cân', gender: 'female', birth: { calendar: 'solar', year: 1985, month: 7, day: 15, time: '06:30' } });
    const p = await api<ProfileDto>('/profiles', { subjectId: s.data.id, viewYear: 2026 });
    assert.equal(p.status, 201);
    const r = await api<TuViReadingDto>(`/profiles/${p.data.id}/reading?year=2026`);
    const menh = r.data.views['Mệnh'].grandma.flatMap(g => g.matches.map(m => m.rule))[0];
    // a line of the year's hạn: the overview may cite it now that it speaks of the year it is read in
    const han = [...(r.data.han.dai?.grandma ?? []), ...r.data.han.tieu.grandma].flatMap(g => g.matches.map(m => m.rule)).find(c => c !== menh)!;
    // a passage of grandma's notes on how a chart is weighed, cited by its id
    const passage = (await api<EntryDto>('/sources/tuvi.grandma.notes/entries/158')).data.passages.find(x => x.kind !== 'meta')!;
    const w = await api<AiReadingDto>(`/profiles/${p.data.id}/readings/overview`, {
      viewYear: 2026,
      sections: [
        { title: 'Cách cân', weight: 'intro', items: [{ layer: 'primary', text: 'Xếp theo sức nặng.', refs: [`p:${passage.id}`] }] },
        { title: 'Mệnh: trọng điểm', weight: 'key', basis: ['Sao sáng', 'Không gặp Tuần Triệt'], items: [{ layer: 'primary', text: 'Lời bà về Mệnh.', refs: [menh] }, { layer: 'added', text: 'Luận thêm.' }] },
        { title: 'Năm 2026', weight: 'current', items: [{ layer: 'primary', text: 'Lời bà về hạn.', refs: [han] }] },
        { title: 'Sao nhỏ', weight: 'minor', items: [{ layer: 'added', text: 'Quá nhỏ.' }] },
      ],
    }, 'PUT');
    assert.equal(w.status, 200, JSON.stringify(w.data));
    assert.equal(w.data.dropped, undefined);
    assert.deepEqual(w.data.sections.map(x => x.weight), ['intro', 'key', 'current', 'minor']);
    assert.deepEqual(w.data.sections[1].basis, ['Sao sáng', 'Không gặp Tuần Triệt']);
    assert.deepEqual(w.data.sections[3].basis, []);
    const intro = w.data.sections[0].items[0];
    assert.equal(intro.layer, 'primary');
    assert.equal(intro.refs[0].quoted, passage.text);
    assert.deepEqual([intro.refs[0].src?.kind, intro.refs[0].src?.source, intro.refs[0].src?.paraRef], ['family', 'tuvi.grandma.notes', passage.ref]);
    assert.equal(w.data.sections[1].items[0].refs[0].src?.kind, 'family');
    assert.equal(w.data.sections[2].items[0].refs[0].code, han);
    assert.equal(w.data.subjectId, s.data.id);
    // the brief quotes what weighs, not the note on how it was weighed
    const b = await api<BriefDto>(`/subjects/${s.data.id}/brief`);
    assert.equal(b.data.lines[0].text, 'Lời bà về Mệnh.');
    // a reading whose every rule is another chart's is refused
    assert.equal((await api(`/profiles/${p.data.id}/readings/overview`, { sections: [{ title: 'x', items: [{ layer: 'primary', text: 'y', refs: ['khong_co.0.0'] }] }] }, 'PUT')).status, 400);
    // the Nhận định: plain words, nothing cited
    const nd = await api<AiReadingDto>(`/profiles/${p.data.id}/readings/summary`, { viewYear: 2026, sections: [{ title: 'Con người', items: [{ layer: 'primary', text: 'Một người hiền.', refs: [menh] }] }] }, 'PUT');
    assert.equal(nd.status, 200, JSON.stringify(nd.data));
    assert.deepEqual(nd.data.sections[0].items.map(i => [i.layer, i.refs.length]), [['added', 0]]);
    const list = await api<AiReadingDto[]>(`/profiles/${p.data.id}/ai-readings`);
    assert.deepEqual(list.data.map(x => [x.scope, x.stale]).sort(), [['overview', false], ['summary', false]]);
    // the person as a whole
    const all = await api<AiReadingDto>(`/subjects/${s.data.id}/readings/summary`, { sections: [{ title: 'Con người', items: [{ layer: 'added', text: 'Gộp cả ba môn.' }] }] }, 'PUT');
    assert.equal(all.status, 200, JSON.stringify(all.data));
    assert.equal(all.data.profileId, null);
    assert.equal((await api(`/subjects/${s.data.id}/readings/overview`, { sections: [{ title: 'x', items: [{ layer: 'added', text: 'y' }] }] }, 'PUT')).status, 400);
    const mine = await api<AiReadingDto[]>(`/subjects/${s.data.id}/readings`);
    assert.deepEqual(mine.data.map(x => [x.scope, x.profileId, x.sections[0].items[0].text]), [['summary', null, 'Gộp cả ba môn.']]);
    assert.equal((await api<SubjectDto>(`/subjects/${s.data.id}`)).data.profiles[0].aiReadings, 2);
    assert.equal((await api(`/ai-readings/${all.data.id}`, undefined, 'DELETE')).status, 204);
    assert.equal((await api<AiReadingDto[]>(`/subjects/${s.data.id}/readings`)).data.length, 0);
    assert.equal((await api(`/subjects/${s.data.id}`, undefined, 'DELETE')).status, 204);
  });

  test('Sonic Hub pushes need the sync token', async () => {
    const r = await api('/links/sonic-hub/abc', { name: 'X' }, 'PUT');
    assert.equal(r.status, 403);
    assert.equal((await api('/links/sonic-hub/abc', undefined, 'DELETE')).status, 403);
  });

  test('the family\'s own data needs the admin token once it is set', async () => {
    assert.equal((await anon('/subjects')).status, 401);
    assert.equal((await anon('/tuvi/catalog')).status, 200);
  });

  /* Nhân số học: the book's bundle is not in the repository, so these run where it is built (npm run kb:numerology) */
  describe('nhân số học', { skip: !hasBook && 'the numerology bundle is not built here' }, () => {
    const quynh = { birth: { year: 1974, month: 5, day: 1 }, gender: 'female', names: [{ text: 'Quỳnh' }] };

    test('the book is imported once, and anyone reads it', async () => {
      const h = await api<{ numerology: { rules: number } | null }>('/health');
      assert.equal(h.data.numerology?.rules, 585);
      const src = await api<SourceDto[]>('/sources?discipline=numerology');
      assert.equal(src.data[0].code, 'numerology.ldqh');
      const pool = createPool(appUrl, false);
      const again = await importNumerology(createDb(pool), readNumerologyBundle(numerologyDir)!);
      await pool.end();
      assert.equal(again.skipped, true);
      // the numbers, the book, its readings and lookups: no token needed, even with ADMIN_TOKEN set
      const c = await anon<{ chart: { ruling: number } }>('/numerology/chart', quynh);
      assert.equal(c.status, 200);
      assert.equal(c.data.chart.ruling, 9);
      for (const path of ['/numerology/book', '/numerology/book/p5.9', '/numerology/catalog', '/numerology/lookup?symbols=ruling:9', '/sources/numerology.ldqh/entries']) assert.equal((await anon(path)).status, 200, path);
      assert.equal((await anon('/numerology/reading', quynh)).status, 200);
      const s1 = await anon<SearchResultDto>(`/search?discipline=numerology&q=${encodeURIComponent('kim tự tháp')}`);
      assert.ok(s1.data.total > 0);
    });

    test('a reading reads as the book reads the author\'s own chart', async () => {
      const r = await api<NumerologyReadingDto>('/numerology/reading', quynh);
      assert.equal(r.status, 200);
      assert.deepEqual(r.data.sections.map(s => s.topic), ['ruling', 'birthday', 'grid', 'arrows', 'name', 'peaks', 'peaks', 'peaks', 'peaks', 'stages', 'year']);
      for (const s of r.data.sections) for (const g of s.groups) for (const m of g.matches) assert.ok(r.data.rules[m.rule], m.rule);
      assert.ok(r.data.sections[0].groups.some(g => g.entry === 'p5.9.summary'));
      const y = await api<NumerologyReadingDto>('/numerology/reading', { ...quynh, viewYear: 2019 });
      assert.equal(y.data.pyear, 9);
      const lunar = await api<NumerologyReadingDto>('/numerology/reading', { birth: { calendar: 'lunar', year: 1962, month: 3, day: 12 } });
      assert.deepEqual([lunar.data.solar.day, lunar.data.solar.month, lunar.data.solar.year, lunar.data.solar.fromLunar], [16, 4, 1962, true]);
      assert.equal((await api('/numerology/reading', { birth: { year: 1990, month: 2, day: 30 } })).status, 400);
    });

    test('the book, section by section, and lookups', async () => {
      const toc = await api<NumerologyBookDto>('/numerology/book');
      assert.equal(toc.data.toc.length, 315);
      assert.equal(toc.data.topics.find(t => t.code === 'ruling')?.entry, 'p5');
      const e = await api<NumerologyEntryDto>('/numerology/book/p5.9');
      assert.deepEqual(e.data.sections.map(s => s.code), ['p5.9', 'p5.9.purpose', 'p5.9.conditions', 'p5.9.traits', 'p5.9.to-overcome', 'p5.9.growth', 'p5.9.careers', 'p5.9.summary']);
      assert.equal(e.data.next?.code, 'p5.10');
      assert.ok(e.data.sections.flatMap(s => s.passages).every(p => p.role === 'rule' || p.role === 'advice' || p.rule === null));
      assert.equal((await api('/numerology/book/no-such-entry')).status, 404);
      const l = await api<NumerologyLookupDto>('/numerology/lookup?symbols=empty-arrow:4-5-6');
      assert.ok(l.data.groups.some(g => g.entry === 'p7.456-empty'));
      assert.ok(l.data.groups.flatMap(g => g.rules).every(r => !r.entry.startsWith('p7.456') || r.entry.startsWith('p7.456-empty')));
    });

    test('an edit of the book survives a new import, and the reading shows it', async () => {
      const e = await api<NumerologyEntryDto>('/numerology/book/p5.9.summary');
      const p = e.data.sections[0].passages[0];
      assert.equal((await api(`/passages/${p.id}`, { text: `${p.text} (đã sửa)` }, 'PATCH')).status, 200);
      const bad = await api(`/rules/${p.rule!.code}`, { condition: 'ruling(12)' }, 'PATCH');
      assert.equal(bad.status, 400);
      const bundle = JSON.parse(JSON.stringify(readNumerologyBundle(numerologyDir)));
      const gz = (b: unknown) => gzipSync(JSON.stringify(b));
      const put = (body: Buffer, type = 'application/gzip', q = '?force=1') => fetch(`${base}/api/numerology/bundle${q}`, { method: 'PUT', headers: { 'content-type': type, 'x-admin-token': ADMIN }, body });
      assert.equal((await put(gz(bundle), 'application/json')).status, 400);
      const broken = JSON.parse(JSON.stringify(bundle));
      broken.rules[0].t = 'chữ khác';
      assert.equal((await put(gz(broken))).status, 400);
      assert.equal((await fetch(`${base}/api/numerology/bundle?force=1`, { method: 'PUT', headers: { 'content-type': 'application/gzip' }, body: gz(bundle) })).status, 401);
      const re = await put(gz(bundle));
      assert.equal(re.status, 200);
      const report = await re.json() as { skipped: boolean; keptEdited: number };
      assert.equal(report.skipped, false);
      assert.ok(report.keptEdited >= 1);
      const r = await api<NumerologyReadingDto>('/numerology/reading', quynh);
      assert.ok(r.data.rules[p.rule!.code].text.endsWith('(đã sửa)'));
      assert.equal((await api(`/passages/${p.id}`, { text: p.text }, 'PATCH')).status, 200);
    });

    test('profiles: the names read, a reading written with Claude, staleness, the brief', async () => {
      const s = await api<SubjectDto>('/subjects', { displayName: 'Lê Thị Quỳnh', gender: 'female', birth: { calendar: 'solar', year: 1974, month: 5, day: 1 } });
      const p = await api<ProfileDto>('/profiles', { subjectId: s.data.id, discipline: 'numerology' });
      assert.equal(p.status, 201);
      assert.deepEqual(p.data.names?.map(n => [n.text, n.primary]), [['Quỳnh', true], ['Thị Quỳnh', false], ['Lê Thị Quỳnh', false]]);
      assert.equal(p.data.settings, null);
      // a person's list of profiles names the one each reads, and keeps its birth
      const sum = (await api<SubjectDto>(`/subjects/${s.data.id}`)).data.profiles[0];
      assert.deepEqual([sum.name, sum.gender, sum.birth.day, sum.birth.month, sum.birth.year], ['Quỳnh', 'female', 1, 5, 1974]);
      const r = await api<NumerologyReadingDto>(`/profiles/${p.data.id}/reading`);
      assert.equal(r.data.chart.ruling, 9);
      const codes = r.data.sections[0].groups.flatMap(g => g.matches.map(m => m.rule));
      // a passage of the book this chart did not match (how another number reads) may be cited on how it was weighed
      const other = (await api<NumerologyEntryDto>('/numerology/book/p5.11')).data.sections.flatMap(x => x.passages).find(x => x.rule && !codes.includes(x.rule.code))!.rule!;
      const w = await api<AiReadingDto>(`/profiles/${p.data.id}/readings/synthesis`, {
        viewYear: 2026, caution: 'Chỉ để tham khảo.',
        sections: [
          { title: 'Cách cân', weight: 'intro', items: [{ layer: 'primary', text: 'Theo thứ bậc sách đặt ra.', refs: [other.code] }] },
          { title: 'Con số chủ đạo 9', weight: 'key', items: [{ layer: 'primary', text: 'Tóm lược.', refs: [codes[0], 'ldqh.b0'] }, { layer: 'primary', text: 'Không dẫn.', refs: [] }, { layer: 'added', text: 'Luận thêm.' }] },
        ],
      }, 'PUT');
      assert.equal(w.status, 200);
      assert.deepEqual(w.data.dropped, ['ldqh.b0']);
      assert.deepEqual(w.data.sections[1].items.map(i => i.layer), ['primary', 'added', 'added']);
      assert.deepEqual([w.data.sections[0].items[0].layer, w.data.sections[0].items[0].refs[0].src?.kind, w.data.sections[0].items[0].refs[0].src?.paraRef], ['primary', 'book', other.page]);
      assert.equal(w.data.author, 'claude');
      const list = await api<AiReadingDto[]>(`/profiles/${p.data.id}/ai-readings`);
      assert.deepEqual(list.data.map(x => [x.scope, x.stale]), [['synthesis', false]]);
      const b = await api<BriefDto>(`/subjects/${s.data.id}/brief?discipline=numerology`);
      assert.equal(b.data.facts.find(f => f.label === 'Con số chủ đạo')?.value, '9');
      assert.deepEqual(b.data.lines.map(l => l.layer), ['primary', 'added']);
      const renamed = await api<ProfileDto>(`/profiles/${p.data.id}`, { names: [{ label: 'Tên ở nhà', text: 'Bông', primary: true }] }, 'PATCH');
      assert.deepEqual(renamed.data.names, [{ label: 'Tên ở nhà', text: 'Bông', primary: true }]);
      assert.equal((await api<SubjectDto>(`/subjects/${s.data.id}`)).data.profiles[0].name, 'Bông');
      const after = await api<AiReadingDto[]>(`/profiles/${p.data.id}/ai-readings`);
      assert.equal(after.data[0].stale, true);
      assert.equal((await api(`/profiles/${p.data.id}/readings/han-2026`, { sections: [{ title: 'x', items: [{ layer: 'added', text: 'y' }] }] }, 'PUT')).status, 400);
      assert.equal((await api(`/profiles/${p.data.id}/ai-readings`, { scope: 'synthesis' })).status, 503);
      assert.equal((await api(`/subjects/${s.data.id}`, undefined, 'DELETE')).status, 204);
    });
  });
  /* Chiêm tinh: anyone may compute a chart (Swiss Ephemeris); the sources' text is the owner's. Woolfolk prints Oprah
     Winfrey's chart (ch. 9): born 29/1/1954, 4:30 CST, Kosciusko, Mississippi. */
  const oprah = { birth: { year: 1954, month: 1, day: 29, time: '04:30', utcOffsetMinutes: -360, timeZone: null, place: 'Kosciusko, Mississippi', latitude: 33.05, longitude: -89.583333 }, gender: 'female' };
  test('chiêm tinh: a chart as Woolfolk prints it, from the ephemeris', async () => {
    const c = await anon<AstrologyChartDto>('/astrology/chart', oprah);
    assert.equal(c.status, 200);
    const pl = c.data.chart.placements;
    assert.deepEqual([pl.sun!.sign, pl.sun!.house, pl.moon!.sign, pl.moon!.house, pl.asc!.sign, pl.jupiter!.retro], ['aquarius', 2, 'sagittarius', 11, 'sagittarius', true]);
    assert.equal(pl.saturn!.text, "9°02' Bò Cạp");
    // the span of times that read the same chart: AC at 29°41' Nhân Mã turns to Ma Kết within minutes
    assert.ok(c.data.window && c.data.window.after < 10, JSON.stringify(c.data.window));
    // by its time zone (the database knows Chicago's offset in 1954)
    const z = await anon<AstrologyChartDto>('/astrology/chart', { ...oprah, birth: { ...oprah.birth, utcOffsetMinutes: null, timeZone: 'America/Chicago' } });
    assert.equal(z.data.offsetMinutes, -360);
    // no time: no houses, and the chart says so
    const n = await anon<AstrologyChartDto>('/astrology/chart', { birth: { year: 1954, month: 1, day: 29, time: null, utcOffsetMinutes: -360 } });
    assert.equal(n.data.chart.houses, null);
    assert.ok(n.data.chart.notes.length >= 1);
    assert.equal((await anon('/astrology/chart', { birth: { year: 1990, month: 2, day: 30, time: null } })).status, 400);
    assert.equal((await anon('/astrology/chart', { birth: { year: 1990, month: 2, day: 3, time: '25:00' } })).status, 400);
  });

  describe('chiêm tinh: the sources', { skip: !hasAstrology && 'the astrology bundle is not built here' }, () => {
    test('the sources are imported once, and anyone reads them', async () => {
      const h = await api<{ astrology: { rules: number; sources: number } | null }>('/health');
      assert.equal(h.data.astrology?.sources, 6);
      assert.ok((h.data.astrology?.rules ?? 0) > 2000);
      const src = await api<SourceDto[]>('/sources?discipline=astrology');
      assert.equal(src.data.length, 6);
      const pool = createPool(appUrl, false);
      const again = await importAstrology(createDb(pool), readAstrologyBundle(astrologyDir)!);
      await pool.end();
      assert.equal(again.skipped, true);
      for (const path of ['/astrology/book', '/astrology/catalog', '/astrology/lookup?symbols=sun@aquarius']) assert.equal((await anon(path)).status, 200, path);
      assert.equal((await anon('/astrology/reading', oprah)).status, 200);
    });

    test('a reading: every part, every passage cited, why it was chosen', async () => {
      const r = await api<AstrologyReadingDto>('/astrology/reading', oprah);
      assert.equal(r.status, 200);
      const topics = [...new Set(r.data.sections.map(s => s.topic))];
      for (const t of ['sun', 'moon', 'asc', 'planet', 'sign', 'house', 'aspect', 'pattern', 'dominant', 'point', 'love']) assert.ok(topics.includes(t as never), t);
      for (const s of r.data.sections) for (const g of s.groups) for (const m of g.matches) assert.ok(r.data.rules[m.rule], m.rule);
      const sun = r.data.sections.find(s => s.topic === 'sun')!;
      assert.ok(sun.groups.some(g => g.source === 'astrology.woolfolk' && g.matches[0].why.some(w => /Bảo Bình/.test(w))));
      const woolfolk = Object.values(r.data.rules).find(x => x.voice === 'woolfolk')!;
      assert.ok(woolfolk.en && woolfolk.en.length > 0 && woolfolk.en !== woolfolk.text);
      assert.equal(r.data.sources.find(s => s.code === 'astrology.woolfolk')?.translator, 'Claude');
      // a woman reads Woolfolk's words on the Aquarius woman, not on the man
      const love = r.data.sections.find(s => s.topic === 'love')!;
      assert.ok(love.groups.some(g => /phụ nữ/.test(g.title)) && !love.groups.some(g => /đàn ông/.test(g.title)));
      const dom = r.data.chart.dominant.tests.find(t => t.body === 'mercury')!;
      assert.equal(dom.level, 'very-strong');
    });

    test('the sources, section by section, and lookups', async () => {
      const toc = await api<AstrologyBookDto>('/astrology/book');
      assert.equal(toc.data.sources.length, 6);
      const kw = toc.data.sources.find(s => s.source.code === 'astrology.hk-keywords')!;
      const venus = kw.toc.find(e => e.code === 'venus-taurus')!;
      const e = await api<AstrologyEntryDto>(`/astrology/book/hk-keywords/${venus.code}`);
      assert.equal(e.status, 200);
      assert.equal(e.data.source.label, 'Lời cô');
      const dig = await api<AstrologyEntryDto>('/astrology/book/hk/' + toc.data.sources.find(s => s.source.code === 'astrology.hk')!.toc.find(x => /^BẢNG VƯỢNG/.test(x.title))!.code);
      assert.equal(dig.data.sections[0].tables[0].rows.length, 10);
      const l = await api<AstrologyLookupDto>('/astrology/lookup?symbols=moon@sagittarius');
      assert.ok(l.data.total >= 1);
      assert.ok(l.data.groups.every(g => g.rules.every(x => x.when.includes('sagittarius'))));
      assert.equal((await api('/astrology/book/hk/no-such-entry')).status, 404);
      // a whole chapter, shallowly: its own passages, then only the titles of its sections
      const ch = await api<AstrologyEntryDto>('/astrology/book/woolfolk/w1?shallow=1');
      assert.ok(ch.data.sections[0].passages.length > 0);
      assert.ok(ch.data.sections.length > 12 && ch.data.sections.slice(1).every(x => x.passages.length === 0 && x.depth === 1));
      assert.ok(ch.data.sections.some(x => x.title === 'Bảo Bình (20/1 – 18/2)'));
    });

    test('profiles: a chart of a person, a reading written with Claude, the brief', async () => {
      const s = await api<SubjectDto>('/subjects', { displayName: 'Oprah Winfrey', gender: 'female', birth: { calendar: 'solar', ...oprah.birth, timeApprox: false, leapMonth: false, hourBranch: null } });
      assert.equal(s.status, 201);
      const p = await api<ProfileDto>('/profiles', { subjectId: s.data.id, discipline: 'astrology' });
      assert.equal(p.status, 201);
      const r = await api<AstrologyReadingDto>(`/profiles/${p.data.id}/reading`);
      assert.equal(r.data.chart.placements.asc!.sign, 'sagittarius');
      const codes = r.data.sections.find(x => x.topic === 'sun')!.groups.flatMap(g => g.matches.map(m => m.rule));
      const w = await api<AiReadingDto>(`/profiles/${p.data.id}/readings/synthesis`, {
        caution: 'Chỉ để tham khảo.',
        sections: [{ title: 'Mặt Trời ở Bảo Bình', items: [{ layer: 'primary', text: 'Tóm lược.', refs: [codes[0], 'woolfolk.b0'] }, { layer: 'added', text: 'Luận thêm.' }] }],
      }, 'PUT');
      assert.equal(w.status, 200);
      assert.deepEqual(w.data.dropped, ['woolfolk.b0']);
      const b = await api<BriefDto>(`/subjects/${s.data.id}/brief?discipline=astrology`);
      assert.equal(b.data.title, 'Chiêm tinh');
      assert.ok(b.data.facts.some(f => f.label === 'Cung Mọc' && /Nhân Mã/.test(f.value)));
      assert.equal((await api(`/profiles/${p.data.id}/readings/han-2026`, { sections: [{ title: 'x', items: [{ layer: 'added', text: 'y' }] }] }, 'PUT')).status, 400);
      assert.equal((await api(`/subjects/${s.data.id}`, undefined, 'DELETE')).status, 204);
    });
  });
});

describe('ai helpers', () => {
  test('reads an answer with stray text and raw line breaks', () => {
    const j = jsonIn('Đây là bài:\n{"sections":[{"title":"Mệnh","primary":[{"text":"dòng một\ndòng hai","refs":["a.1"]}],"added":[]}],"caution":"x"}\ncảm ơn') as { sections: { primary: { text: string }[] }[] };
    assert.equal(j.sections[0].primary[0].text, 'dòng một\ndòng hai');
    assert.equal(jsonIn('không có json'), null);
  });
  test('scopes', () => {
    for (const s of ['overview', 'Mệnh', 'Thân', 'Quan Lộc', 'han-2026']) assert.ok(scopeOk(s), s);
    for (const s of ['', 'han-26', 'tong-quan', 'Cung lạ']) assert.ok(!scopeOk(s), s);
  });
});
