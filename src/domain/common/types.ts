/**
 * Common domain primitives, identifier types, and timestamp utilities.
 * Pure TypeScript - Zero dependencies on UI, browser DOM, or storage layers.
 */

/**
 * Standard identifier type across all PathFlow domain entities.
 * UUID v4 format string ensuring distributed, collision-resistant generation offline.
 */
export type EntityId = string;

/**
 * Generates a new EntityId.
 * Uses native Web Crypto API (crypto.randomUUID) when available,
 * with an RFC4122 v4 compliant fallback for universal runtime compatibility.
 */
export function generateEntityId(): EntityId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates whether an unknown value qualifies as a valid non-empty EntityId.
 */
export function isValidEntityId(id: unknown): id is EntityId {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * ISO 8601 UTC timestamp string representation (e.g., "2026-09-20T08:50:00.000Z").
 * Provides deterministic chronological ordering, JSON serializability, and timezone neutrality.
 */
export type Timestamp = string;

/**
 * Creates a normalized ISO 8601 UTC timestamp string.
 */
export function createTimestamp(date?: Date | number | string): Timestamp {
  if (date === undefined) {
    return new Date().toISOString();
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date provided to createTimestamp: ${date}`);
  }
  return parsed.toISOString();
}

/**
 * Validates whether a value is a valid parseable ISO timestamp string.
 */
export function isValidTimestamp(val: unknown): val is Timestamp {
  if (typeof val !== 'string' || val.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(val);
  return !isNaN(parsed);
}

/**
 * Computes elapsed duration in whole minutes between two timestamps.
 * Returns 0 if endedAt is identical to startedAt.
 */
export function calculateDurationMinutes(startedAt: Timestamp, endedAt: Timestamp): number {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp provided to calculateDurationMinutes');
  }
  return Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));
}

/**
 * Computes ISO 8601 week identifier string (e.g. "2026-W38") for a given date or timestamp.
 */
export function getWeekIdentifier(dateInput?: Date | string | number): string {
  const d = dateInput !== undefined ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to getWeekIdentifier: ${dateInput}`);
  }
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  date.setUTCDate(date.getUTCDate() + 3 - day);
  const year = date.getUTCFullYear();
  const week1 = new Date(Date.UTC(year, 0, 4));
  const week1Day = (week1.getUTCDay() + 6) % 7;
  week1.setUTCDate(week1.getUTCDate() + 3 - week1Day);
  const weekNo = 1 + Math.round((date.getTime() - week1.getTime()) / (7 * 24 * 3600 * 1000));
  const weekStr = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${year}-W${weekStr}`;
}

/**
 * Returns the ISO 8601 UTC date range (Monday 00:00:00.000Z to Sunday 23:59:59.999Z)
 * for a given weekIdentifier (e.g. "2026-W38").
 */
export function getWeekDateRange(weekIdentifier: string): { startDate: Timestamp; endDate: Timestamp } {
  const match = weekIdentifier.trim().match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid weekIdentifier format: "${weekIdentifier}". Expected format "YYYY-Www" (e.g. "2026-W38").`
    );
  }
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid week number: ${week}. Must be between 1 and 53.`);
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const mondayWeek1 = new Date(Date.UTC(year, 0, 4 - jan4Day));
  const targetMonday = new Date(mondayWeek1.getTime() + (week - 1) * 7 * 24 * 3600 * 1000);
  const targetSunday = new Date(targetMonday.getTime() + 6 * 24 * 3600 * 1000);

  const startYMD = targetMonday.toISOString().split('T')[0];
  const endYMD = targetSunday.toISOString().split('T')[0];
  return {
    startDate: `${startYMD}T00:00:00.000Z`,
    endDate: `${endYMD}T23:59:59.999Z`,
  };
}

/**
 * Validates whether an unknown value is a valid ISO 8601 week identifier string (e.g. "2026-W38").
 */
export function isValidWeekIdentifier(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/);
  return match !== null;
}

/**
 * Validates whether an unknown value is a valid calendar date string in YYYY-MM-DD format.
 * Accurately guards calendar limits (e.g. non-existent dates like February 30th).
 */
export function isValidDateString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Checks whether a given calendar date (YYYY-MM-DD) falls within a given ISO week (e.g. "2026-W38").
 */
export function isDateInWeek(dateStr: string, weekIdentifier: string): boolean {
  if (!isValidDateString(dateStr) || !isValidWeekIdentifier(weekIdentifier)) {
    return false;
  }
  try {
    return getWeekIdentifier(dateStr) === weekIdentifier.trim();
  } catch {
    return false;
  }
}
