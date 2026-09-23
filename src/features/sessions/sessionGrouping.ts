/**
 * Session History Presentation & Daily Grouping Module (Phase 9C-2)
 *
 * Provides pure presentation-layer grouping and derivation for completed work sessions:
 * 1. Groups sessions into calendar days based on the user's active calendar preference (Gregorian or Persian/Jalali).
 * 2. Derives per-day session count and total focused duration.
 * 3. Identifies relative day markers ("Today" / "Yesterday" or "امروز" / "دیروز") while preserving exact calendar dates.
 * 4. Ensures deterministic newest-day-first and newest-session-first ordering.
 *
 * NOTE: Operates strictly at the presentation boundary; does not alter domain models or storage.
 */

import { Session } from '../../domain';
import {
  UserPreferences,
  AppCalendar,
  AppLanguage,
  DEFAULT_PREFERENCES,
} from '../../app/preferences/userPreferences';
import {
  formatDate,
  formatNumeral,
  formatDurationHoursMinutes,
  parseToDate,
} from '../../app/preferences/dateFormatting';

export interface SessionDayGroup {
  /**
   * Calendar day identifier in the active calendar system (e.g. '2026-09-22' or '1405-06-31').
   */
  readonly dateKey: string;

  /**
   * Localized formatted calendar date (e.g. "September 22, 2026", "۳۱ شهریور ۱۴۰۵", "31 Shahrivar 1405").
   */
  readonly formattedDate: string;

  /**
   * Relative day label if the date matches reference "Today" or "Yesterday".
   */
  readonly relativeLabel?: 'Today' | 'Yesterday' | 'امروز' | 'دیروز';

  /**
   * Completed sessions belonging to this day, ordered newest first.
   */
  readonly sessions: readonly Session[];

  /**
   * Number of sessions completed during this calendar day.
   */
  readonly sessionCount: number;

  /**
   * Total focused minutes accumulated during this calendar day.
   */
  readonly totalMinutes: number;

  /**
   * Pre-formatted total focused time (e.g. "2h 40m" or "۲ ساعت و ۴۰ دقیقه").
   */
  readonly formattedTotalTime: string;

  /**
   * Pre-formatted sessions count string (e.g. "3 sessions" or "۳ جلسه").
   */
  readonly formattedSessionCount: string;
}

/**
 * Derives a calendar-aware day key (YYYY-MM-DD or JY-JM-JD) from an ISO timestamp
 * using the user's active calendar preference.
 */
export function getCalendarDayKey(
  timestamp: string | Date | number,
  calendar: AppCalendar = 'gregorian',
  timeZone?: string
): string {
  const date = parseToDate(timestamp);
  if (!date) return '';

  const calOption = calendar === 'persian' ? 'persian' : 'gregory';
  try {
    const parts = new Intl.DateTimeFormat(`en-u-ca-${calOption}`, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timeZone || 'UTC',
    }).formatToParts(date);

    const y = parts.find((p) => p.type === 'year')?.value || '';
    const m = parts.find((p) => p.type === 'month')?.value || '';
    const d = parts.find((p) => p.type === 'day')?.value || '';
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Checks whether a given calendar date key represents Today or Yesterday relative to a reference date.
 */
export function getRelativeDayLabel(
  dateKey: string,
  calendar: AppCalendar,
  language: AppLanguage,
  referenceDate: Date | string = new Date(),
  timeZone?: string
): 'Today' | 'Yesterday' | 'امروز' | 'دیروز' | undefined {
  const ref = parseToDate(referenceDate);
  if (!ref) return undefined;

  const todayKey = getCalendarDayKey(ref, calendar, timeZone);
  if (dateKey === todayKey) {
    return language === 'fa' ? 'امروز' : 'Today';
  }

  const yesterdayDate = new Date(ref.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getCalendarDayKey(yesterdayDate, calendar, timeZone);
  if (dateKey === yesterdayKey) {
    return language === 'fa' ? 'دیروز' : 'Yesterday';
  }

  return undefined;
}

/**
 * Groups an array of completed sessions into daily buckets with summaries.
 *
 * @param sessions List of completed sessions (typically from querySessionHistory).
 * @param preferences User's active language and calendar preferences.
 * @param referenceDate Optional reference timestamp for relative "Today"/"Yesterday" calculation (defaults to Date.now()).
 * @param timeZone Optional timezone (defaults to 'UTC' for deterministic canonical alignment).
 */
export function groupSessionsByDay(
  sessions: readonly Session[],
  preferences: UserPreferences = DEFAULT_PREFERENCES,
  referenceDate: Date | string = new Date(),
  timeZone?: string
): SessionDayGroup[] {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  // 1. Ensure sessions are sorted newest first by canonical startedAt
  const sortedSessions = [...sessions].sort((a, b) => {
    const diff = Date.parse(b.startedAt) - Date.parse(a.startedAt);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });

  // 2. Bucket into groups preserving chronological order of appearance (newest day first)
  const groupMap = new Map<string, Session[]>();
  for (const session of sortedSessions) {
    const key = getCalendarDayKey(session.startedAt, preferences.calendar, timeZone);
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(session);
    } else {
      groupMap.set(key, [session]);
    }
  }

  // 3. Build enriched daily summaries
  const dayGroups: SessionDayGroup[] = [];
  for (const [dateKey, daySessions] of groupMap.entries()) {
    const sessionCount = daySessions.length;
    const totalMinutes = daySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const formattedDate = formatDate(daySessions[0].startedAt, preferences, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const relativeLabel = getRelativeDayLabel(
      dateKey,
      preferences.calendar,
      preferences.language,
      referenceDate,
      timeZone
    );

    const formattedTotalTime = formatDurationHoursMinutes(totalMinutes, preferences);

    const formattedSessionCount =
      preferences.language === 'fa'
        ? `${formatNumeral(sessionCount, preferences)} جلسه`
        : `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`;

    dayGroups.push({
      dateKey,
      formattedDate,
      relativeLabel,
      sessions: daySessions,
      sessionCount,
      totalMinutes,
      formattedTotalTime,
      formattedSessionCount,
    });
  }

  return dayGroups;
}
