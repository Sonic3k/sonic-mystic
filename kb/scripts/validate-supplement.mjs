// Checks kb/tuvi/supplement.json — the "bổ sung" layer (common Tử Vi knowledge, NOT grandma's notes).
// Run: node kb/scripts/validate-supplement.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '@mystic/engine/tuvi';

const kb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(kb, 'tuvi/supplement.json');
const s = JSON.parse(fs.readFileSync(file, 'utf8'));

export const PRINCIPLE_IDS = [
  'than_cu.Mệnh', 'than_cu.Phúc Đức', 'than_cu.Quan Lộc', 'than_cu.Thiên Di', 'than_cu.Tài Bạch', 'than_cu.Phu Thê',
  'menh_cuc.cuc_sinh_menh', 'menh_cuc.menh_sinh_cuc', 'menh_cuc.menh_khac_cuc', 'menh_cuc.cuc_khac_menh', 'menh_cuc.binh_hoa',
  'am_duong.thuan', 'am_duong.nghich',
  'cung_menh.cung_sinh_menh', 'cung_menh.menh_sinh_cung', 'cung_menh.cung_khac_menh', 'cung_menh.menh_khac_cung', 'cung_menh.dong_hanh',
  'menh_vcd', 'menh_chu', 'than_chu', 'dai_han', 'tieu_han', 'tam_phuong', 'mieu_ham',
];
const PALACES = [...E.PALACES, 'Thân'];
let errors = 0;
const err = m => { errors++; console.log('✗', m); };
const ids = new Set();

for (const p of PALACES) if (!s.palaces?.some(x => x.palace === p && x.about?.length > 40)) err(`palaces: thiếu hoặc quá ngắn "${p}"`);
for (const id of PRINCIPLE_IDS) if (!s.principles?.some(x => x.id === id && x.text?.length > 40)) err(`principles: thiếu "${id}"`);
for (const st of s.stars ?? []) {
  if (!E.STAR_BY_ID[st.star]) err(`stars: không có sao id "${st.star}"`);
  if (!st.about || st.about.length < 40) err(`stars ${st.star}: thiếu about`);
  for (const r of st.rules ?? []) {
    if (!r.id || ids.has(r.id)) err(`rule id trùng hoặc thiếu: ${r.id}`); ids.add(r.id);
    if (!r.text) err(`${r.id}: thiếu text`);
    if (!['cat', 'hung', 'trung', 'mixed'].includes(r.tone)) err(`${r.id}: tone "${r.tone}"`);
    for (const t of r.palaces ?? []) if (t !== '*' && !E.findTarget(t)) err(`${r.id}: cung không rõ "${t}"`);
    if (!r.palaces?.length) err(`${r.id}: thiếu palaces`);
    const p = E.parse(r.when ?? '');
    for (const m of p.errors) err(`${r.id}: điều kiện lỗi — ${m} — ${r.when}`);
  }
}
console.log(`${s.stars?.length ?? 0} stars · ${ids.size} rules · ${s.principles?.length ?? 0} principles · ${errors} errors`);
process.exit(errors ? 1 : 0);
