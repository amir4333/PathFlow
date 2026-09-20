/**
 * Date Range and Period Domain Abstractions
 *
 * Provides pure, deterministic date range calculations, standard period generators
 * (Today, This Week, Previous Week, Last N Days, Custom Range), and validation.
 *
 * Pure TypeScript - Zero dependencies on UI, browser DOM, or storage layers.
 */

import {
  isValidDateString,
  getWeekIdentifier,
  getWeekDateRange,
  Timestamp,
} from './types';

/**
 * Standard date range specifying inclusive calendar start and end dates.
 * Dates are ISO calendar format: YYYY-MM-DD.
 */
export interface DateRange {
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;   // YYYY-MM-DD
  readonly label?: string;
}

/**
 * Creates a validated DateRange object.
 * Throws an error if dates are invalid or startDate > endDate.
 */
export function createDateRange(
  startDate: string,
  endDate: string,
  label?: string
): DateRange {
  const cleanStart = startDate.trim().split('T')[0];
  const cleanEnd = endDate.trim().split('T')[0];

  if (!isValidDateString(cleanStart)) {
    throw new Error(`Invalid startDate provided to createDateRange: "${startDate}"`);
  }
  if (!isValidDateString(cleanEnd)) {
    throw new Error(`Invalid endDate provided to createDateRange: "${endDate}"`);
  }
  if (cleanStart > cleanEnd) {
    throw new Error(
      `Invalid date range: startDate "${cleanStart}" cannot be after endDate "${cleanEnd}"`
    );
  }

  return {
    startDate: cleanStart,
    endDate: cleanEnd,
    label: label?.trim() || undefined,
  };
}

/**
 * Type guard verifying if an unknown value is a valid DateRange.
 */
export function isValidDateRange(val: unknown): val is DateRange {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  if (typeof obj.startDate !== 'string' || typeof obj.endDate !== 'string') {
    return false;
  }
  const cleanStart = obj.startDate.trim().split('T')[0];
  const cleanEnd = obj.endDate.trim().split('T')[0];

  return (
    isValidDateString(cleanStart) &&
    isValidDateString(cleanEnd) &&
    cleanStart <= cleanEnd
  );
}

/**
 * Normalizes any Date, Timestamp, or date string into a YYYY-MM-DD calendar string.
 */
export function toCalendarDateString(input?: Date | string | number): string {
  const d = input !== undefined ? new Date(input) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date input provided to toCalendarDateString: ${input}`);
  }
  return d.toISOString().split('T')[0];
}

/**
 * Checks whether a given calendar date (or ISO timestamp) falls within the inclusive DateRange.
 */
export function isDateWithinRange(
  dateInput: string | Date | Timestamp,
  range: DateRange
): boolean {
  try {
    const calendarDate =
      typeof dateInput === 'string' && dateInput.length === 10 && isValidDateString(dateInput)
        ? dateInput
        : toCalendarDateString(dateInput);
    return calendarDate >= range.startDate && calendarDate <= range.endDate;
  } catch {
    return false;
  }
}

/**
 * Computes the number of days spanned by a DateRange (inclusive of start and end days).
 */
export function getDaysCountInRange(range: DateRange): number {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (24 * 3600 * 1000)) + 1;
}

/**
 * Returns an array of consecutive calendar date strings (YYYY-MM-DD) for every day in the range.
 * Safety capped at 366 days to prevent runaway allocations.
 */
export function getDatesInRange(range: DateRange, maxDays = 366): string[] {
  const dates: string[] = [];
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const totalDays = Math.min(getDaysCountInRange(range), maxDays);

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start.getTime() + i * 24 * 3600 * 1000);
    dates.push(current.toISOString().split('T')[0]);
  }

  return dates;
}

// -----------------------------------------------------------------------------
// Standard Review Period Generators
// -----------------------------------------------------------------------------

/**
 * Generates a DateRange for a single day ("Today" relative to reference date).
 */
export function getTodayPeriod(referenceDate?: Date | string): DateRange {
  const today = toCalendarDateString(referenceDate);
  return createDateRange(today, today, 'Today');
}

/**
 * Generates a DateRange for the current ISO week (Monday through Sunday).
 */
export function getThisWeekPeriod(referenceDate?: Date | string): DateRange {
  const weekId = getWeekIdentifier(referenceDate);
  const { startDate, endDate } = getWeekDateRange(weekId);
  return createDateRange(
    startDate.split('T')[0],
    endDate.split('T')[0],
    `This Week (${weekId})`
  );
}

/**
 * Generates a DateRange for the previous ISO week (Monday through Sunday).
 */
export function getPreviousWeekPeriod(referenceDate?: Date | string): DateRange {
  const ref = referenceDate !== undefined ? new Date(referenceDate) : new Date();
  const prevDate = new Date(ref.getTime() - 7 * 24 * 3600 * 1000);
  const weekId = getWeekIdentifier(prevDate);
  const { startDate, endDate } = getWeekDateRange(weekId);
  return createDateRange(
    startDate.split('T')[0],
    endDate.split('T')[0],
    `Previous Week (${weekId})`
  );
}

/**
 * Generates a DateRange for a specific ISO week identifier (e.g. "2026-W38").
 */
export function getWeekPeriod(weekIdentifier: string): DateRange {
  const { startDate, endDate } = getWeekDateRange(weekIdentifier);
  return createDateRange(
    startDate.split('T')[0],
    endDate.split('T')[0],
    `Week ${weekIdentifier}`
  );
}

/**
 * Generates a DateRange for the trailing N days ending on the reference date.
 * Example: days=7 returns [Today - 6 days, Today] (7 days total).
 */
export function getLastNDaysPeriod(days: number, referenceDate?: Date | string): DateRange {
  if (days < 1) {
    throw new Error(`Invalid days count: ${days}. Must be at least 1.`);
  }
  const ref = referenceDate !== undefined ? new Date(referenceDate) : new Date();
  const endDateStr = toCalendarDateString(ref);

  const startMs = new Date(`${endDateStr}T00:00:00.000Z`).getTime() - (days - 1) * 24 * 3600 * 1000;
  const startDateStr = new Date(startMs).toISOString().split('T')[0];

  return createDateRange(startDateStr, endDateStr, `Last ${days} Days`);
}
