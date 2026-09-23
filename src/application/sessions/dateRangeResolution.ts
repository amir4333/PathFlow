/**
 * Date Range & Calendar Boundary Resolution Utilities
 *
 * Resolves user-provided date filters (Gregorian or Jalali/Persian)
 * into canonical ISO 8601 UTC timestamp boundaries.
 *
 * Core Guarantees:
 * - Start date: selected calendar day at 00:00:00.000Z
 * - End date: selected calendar day through the end of that day (23:59:59.999Z)
 * - Single-day queries correctly encompass the full 24-hour day
 * - Works identically whether user thinks in Gregorian or Jalali calendar
 * - Never mutates underlying storage or writes non-ISO timestamps to IndexedDB
 */

import { ValidationError } from '../errors';

/**
 * Persian (Eastern Arabic-Indic) digits mapping.
 */
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts Persian digits to standard ASCII digits.
 */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

/**
 * Converts a Jalali (Solar Hijri) calendar date to a Gregorian calendar date.
 * Based on the astronomical algorithm by Kazimierz M. Borkowski.
 */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  const gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;

  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let g_y = gy + 400 * Math.floor(days / 146097);
  days %= 146097;

  let leap = true;
  if (days >= 36525) {
    days--;
    g_y += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
    else leap = false;
  }

  g_y += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days >= 366) {
    leap = false;
    days--;
    g_y += Math.floor(days / 365);
    days %= 365;
  }

  const isLeap = (g_y % 4 === 0 && g_y % 100 !== 0) || g_y % 400 === 0;
  const sal_a = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  const gd = days + 1;
  return { gy: g_y, gm, gd };
}

/**
 * Converts a Gregorian calendar date to a Jalali calendar date.
 */
export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number
): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy - (gy <= 1600 ? 621 : 1600);
  let days =
    365 * gy2 +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];

  if (gm > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) days++;
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/**
 * Determines whether a given year falls into the standard Jalali century ranges (1300-1500).
 */
export function isJalaliYear(year: number): boolean {
  return year >= 1300 && year <= 1500;
}

/**
 * Normalizes any date string (Gregorian or Jalali YYYY-MM-DD or full ISO)
 * into a canonical ISO 8601 UTC timestamp boundary.
 *
 * @param dateStr Date or timestamp string
 * @param isEndOfDay If true, resolves to 23:59:59.999Z; if false, 00:00:00.000Z
 */
export function parseDateBoundaryToIso(dateStr: string, isEndOfDay: boolean): string {
  const clean = toAsciiDigits(dateStr.trim());

  // If already an ISO timestamp with explicit time component
  if (clean.includes('T')) {
    const parsedTime = Date.parse(clean);
    if (isNaN(parsedTime)) {
      throw new ValidationError([`Invalid timestamp provided: "${dateStr}".`]);
    }
    return new Date(parsedTime).toISOString();
  }

  // Matches YYYY-MM-DD or YYYY/MM/DD
  const dateMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!dateMatch) {
    throw new ValidationError([
      `Invalid date format: "${dateStr}". Expected YYYY-MM-DD or ISO 8601 timestamp.`,
    ]);
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ValidationError([`Date out of bounds: "${dateStr}".`]);
  }

  let finalYear = year;
  let finalMonth = month;
  let finalDay = day;

  // If year is in Jalali range, convert to Gregorian
  if (isJalaliYear(year)) {
    const converted = jalaliToGregorian(year, month, day);
    finalYear = converted.gy;
    finalMonth = converted.gm;
    finalDay = converted.gd;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyyMmDd = `${finalYear}-${pad(finalMonth)}-${pad(finalDay)}`;

  return isEndOfDay ? `${yyyyMmDd}T23:59:59.999Z` : `${yyyyMmDd}T00:00:00.000Z`;
}

/**
 * Resolves optional start and end date filters into canonical UTC ISO boundary strings.
 * Enforces startIso <= endIso.
 */
export function resolveDateRangeBoundaries(
  startDate?: string,
  endDate?: string
): { startIso?: string; endIso?: string } {
  const startIso = startDate ? parseDateBoundaryToIso(startDate, false) : undefined;
  const endIso = endDate ? parseDateBoundaryToIso(endDate, true) : undefined;

  if (startIso && endIso) {
    if (Date.parse(startIso) > Date.parse(endIso)) {
      throw new ValidationError([
        `Start date (${startDate}) must be on or before end date (${endDate}).`,
      ]);
    }
  }

  return { startIso, endIso };
}
