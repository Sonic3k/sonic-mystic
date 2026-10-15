// Uploads the built Nhân số học bundle (kb/bundle/numerology) to a Mystic API. The book's text is not in the
// repository, so a deployed API gets the book this way; the database then keeps it (and any edit made there).
// Run: MYSTIC_API_URL=https://… [ADMIN_TOKEN=…] npm run upload:numerology -w @mystic/kb [-- --force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bundle/numerology');
const base = process.env.MYSTIC_API_URL?.replace(/\/$/, '');
if (!base) throw new Error('Đặt MYSTIC_API_URL (địa chỉ API, ví dụ https://…up.railway.app)');
if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error(`Chưa có gói sách ở ${dir} (npm run kb:numerology)`);
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const bundle = { manifest: read('manifest.json'), book: read('book.json'), rules: read('rules.json').rules, tables: read('tables.json') };
const body = gzipSync(JSON.stringify(bundle));
const force = process.argv.includes('--force');
const headers = { 'content-type': 'application/gzip', ...(process.env.ADMIN_TOKEN ? { 'x-admin-token': process.env.ADMIN_TOKEN } : {}) };
const res = await fetch(`${base}/api/numerology/bundle${force ? '?force=1' : ''}`, { method: 'PUT', headers, body });
const text = await res.text();
if (!res.ok) { console.error(`✗ ${res.status} ${text.slice(0, 500)}`); process.exit(1); }
const r = JSON.parse(text);
console.log(r.skipped
  ? `gói ${r.version} đã có trên máy chủ (thêm --force để nạp lại)`
  : `đã nạp gói ${r.version}: ${r.written} dòng, giữ ${r.keptEdited} chỗ đã sửa, bỏ ${r.removed} (${r.ms} ms) — ${(body.length / 1024).toFixed(0)} KB nén`);
