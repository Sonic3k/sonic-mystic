/* Apparent ("true") solar time at a birthplace — an optional basis for the birth hour. Some schools read the giờ from
   the sun rather than the clock; grandma's notes do not say, so the chart keeps the clock unless asked.
   Equation of time: NOAA's series (good to about half a minute). */

/** day of the year, 1-based, for a Gregorian date */
const dayOfYear = (d: number, m: number, y: number) => {
  const start = Date.UTC(y, 0, 1), at = Date.UTC(y, m - 1, d);
  return Math.round((at - start) / 86_400_000) + 1;
};

/** minutes the sun runs ahead (+) or behind (−) mean time on a date */
export function equationOfTime(d: number, m: number, y: number, hour = 12): number {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const g = (2 * Math.PI / (leap ? 366 : 365)) * (dayOfYear(d, m, y) - 1 + (hour - 12) / 24);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
}

export interface SolarClock { day: number; month: number; year: number; hour: number; minute: number; shiftMinutes: number }

/** clock time (with its UTC offset) → apparent solar time at a longitude; the date moves when it crosses midnight */
export function trueSolarTime(d: number, m: number, y: number, hour: number, minute: number, longitude: number, utcOffsetMinutes: number): SolarClock {
  const shift = 4 * longitude - utcOffsetMinutes + equationOfTime(d, m, y, hour + minute / 60);
  let total = Math.round(hour * 60 + minute + shift), dayShift = 0;
  while (total < 0) { total += 1440; dayShift--; }
  while (total >= 1440) { total -= 1440; dayShift++; }
  const at = new Date(Date.UTC(y, m - 1, d + dayShift));
  return { day: at.getUTCDate(), month: at.getUTCMonth() + 1, year: at.getUTCFullYear(), hour: Math.floor(total / 60), minute: total % 60, shiftMinutes: Math.round(shift) };
}
