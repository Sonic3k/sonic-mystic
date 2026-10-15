/* A birth as stored (subjects, profiles) ⇄ as the API shows it ⇄ as the engine reads it. */
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { BirthInput } from '@mystic/engine/tuvi';
import { BirthError, birthInputOf as sharedBirthInputOf } from '@mystic/engine/birth';
import type { BirthDto, Gender } from '@mystic/engine/api';
import { pad2 } from '../common/text.js';

export interface BirthColumns {
  birthCalendar: 'solar' | 'lunar'; birthYear: number | null; birthMonth: number | null; birthDay: number | null; birthLeapMonth: boolean;
  birthTime: string | null; birthHourBranch: number | null; birthTimeApprox: boolean; birthTimeZone: string | null; birthUtcOffsetMinutes: number | null;
  birthPlace: string | null; birthLatitude: number | null; birthLongitude: number | null;
}

export const birthDto = (c: BirthColumns): BirthDto => ({
  calendar: c.birthCalendar, year: c.birthYear, month: c.birthMonth, day: c.birthDay, leapMonth: c.birthLeapMonth,
  time: c.birthTime, hourBranch: c.birthHourBranch, timeApprox: c.birthTimeApprox, timeZone: c.birthTimeZone,
  utcOffsetMinutes: c.birthUtcOffsetMinutes, place: c.birthPlace, latitude: c.birthLatitude, longitude: c.birthLongitude,
});

export const birthColumns = (b: BirthDto): BirthColumns => ({
  birthCalendar: b.calendar, birthYear: b.year, birthMonth: b.month, birthDay: b.day, birthLeapMonth: b.calendar === 'lunar' && b.leapMonth,
  birthTime: b.time, birthHourBranch: b.hourBranch, birthTimeApprox: b.timeApprox, birthTimeZone: b.timeZone,
  birthUtcOffsetMinutes: b.utcOffsetMinutes, birthPlace: b.place, birthLatitude: b.latitude, birthLongitude: b.longitude,
});

const time = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'giờ dạng HH:MM').transform(t => { const [h, m] = t.split(':').map(Number); return `${pad2(h)}:${pad2(m)}`; });

export const BirthBody = z.object({
  calendar: z.enum(['solar', 'lunar']).default('solar'),
  year: z.number().int().min(1800).max(2200).nullable().default(null),
  month: z.number().int().min(1).max(12).nullable().default(null),
  day: z.number().int().min(1).max(31).nullable().default(null),
  leapMonth: z.boolean().default(false),
  time: time.nullable().default(null),
  hourBranch: z.number().int().min(0).max(11).nullable().default(null),
  timeApprox: z.boolean().default(false),
  timeZone: z.string().max(64).nullable().default(null),
  utcOffsetMinutes: z.number().int().min(-720).max(840).nullable().default(null),
  place: z.string().max(200).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
});
export type BirthBodyInput = z.infer<typeof BirthBody>;

/** the UTC offset a zone had at a moment — for Asia/Ho_Chi_Minh before 13/6/1975 it is the South's (+8) */
export function offsetOf(zone: string, y: number, m: number, d: number, hhmm = '12:00'): number | null {
  try {
    const [h, mi] = hhmm.split(':').map(Number);
    const at = new Date(Date.UTC(y, m - 1, d, h, mi));
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((local - at.getTime()) / 60000);
  } catch {
    return null;
  }
}

/** the engine's input for a stored birth; a 400 that names what is missing when the chart cannot be set up */
export function birthInputOf(gender: Gender | null, b: BirthDto): BirthInput {
  try {
    return sharedBirthInputOf(gender, b);
  } catch (e) {
    if (e instanceof BirthError) throw new BadRequestException(e.message);
    throw e;
  }
}
