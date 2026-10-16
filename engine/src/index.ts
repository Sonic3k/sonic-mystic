/* Huyền học engines. Each discipline lives in its own folder and is imported by name:
     import { buildChart } from '@mystic/engine/tuvi';
   The root lists what exists, for pages that show every discipline. */
export const ENGINE_VERSION = '1.2.0';

export const DISCIPLINES = [
  { code: 'tuvi', name: 'Tử vi', ready: true },
  { code: 'astrology', name: 'Chiêm tinh', ready: true },
  { code: 'numerology', name: 'Nhân số học', ready: true },
  { code: 'iching', name: 'Kinh Dịch', ready: false },
  { code: 'tarot', name: 'Tarot', ready: false },
] as const;
export type DisciplineCode = (typeof DISCIPLINES)[number]['code'];
