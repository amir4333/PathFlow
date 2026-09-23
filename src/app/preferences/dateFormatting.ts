/**
 * Date and Calendar Presentation Layer
 *
 * Provides pure formatting utilities honoring:
 * - Language: 'en' | 'fa'
 * - Calendar: 'gregorian' | 'persian' (Jalali)
 *
 * All underlying business logic, models, and repositories continue to store
 * standard ISO 8601 UTC timestamps. Conversion and formatting happens strictly
 * at this presentation boundary.
 */

import { UserPreferences, DEFAULT_PREFERENCES } from './userPreferences';

/**
 * Persian (Eastern Arabic-Indic) digits mapping.
 */
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts any standard ASCII Arabic digits (0-9) to Persian digits (۰-۹).
 */
export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] || digit);
}

/**
 * Converts any Persian digits (۰-۹) back to ASCII digits (0-9).
 */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

/**
 * Formats a number or string numeral according to the user's language preference.
 * - 'fa' -> Persian digits (e.g. '۱۴۰۵')
 * - 'en' -> Latin digits (e.g. '1405')
 */
export function formatNumeral(
  value: number | string,
  preferences: UserPreferences = DEFAULT_PREFERENCES
): string {
  if (preferences.language === 'fa') {
    return toPersianDigits(value);
  }
  return String(value);
}

/**
 * Normalizes input into a valid Date instance. Returns null if invalid.
 */
export function parseToDate(input: string | Date | number): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Builds the Intl locale tag with Unicode calendar and numeral extensions.
 */
function getIntlLocale(preferences: UserPreferences): string {
  const lang = preferences.language === 'fa' ? 'fa' : 'en';
  const calendar = preferences.calendar === 'persian' ? 'persian' : 'gregory';
  const numbering = preferences.language === 'fa' ? 'arabext' : 'latn';
  return `${lang}-u-ca-${calendar}-nu-${numbering}`;
}

/**
 * Formats a timestamp into a human-readable date string.
 *
 * Examples:
 * - English + Gregorian: "September 23, 2026"
 * - English + Persian: "1 Mehr 1405" (or "Mehr 1, 1405")
 * - Persian + Gregorian: "۲۳ سپتامبر ۲۰۲۶"
 * - Persian + Persian: "۱ مهر ۱۴۰۵"
 */
export function formatDate(
  timestamp: string | Date | number,
  preferences: UserPreferences = DEFAULT_PREFERENCES,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseToDate(timestamp);
  if (!date) return String(timestamp);

  const locale = getIntlLocale(preferences);

  // Sensible default formatting options if none provided
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: options?.month || 'long',
    day: 'numeric',
    ...options,
  };

  try {
    const formatted = new Intl.DateTimeFormat(locale, defaultOptions).format(date);

    // If English + Persian calendar, Intl outputs "Mehr 1, 1405 AP".
    // Clean trailing " AP" / " AH" and normalize "Month Day, Year" to "Day Month Year" for clean consistency
    if (preferences.language === 'en' && preferences.calendar === 'persian') {
      const cleaned = formatted.replace(/\s*(AP|AH)$/i, '').trim();
      const monthFirstMatch = cleaned.match(/^([A-Za-z]+)\s+(\d+),\s+(\d+)$/);
      if (monthFirstMatch) {
        const [, month, day, year] = monthFirstMatch;
        return `${day} ${month} ${year}`;
      }
      return cleaned;
    }

    return formatted;
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a timestamp into a time string (e.g. "02:30 PM" or "۱۴:۳۰").
 */
export function formatTime(
  timestamp: string | Date | number,
  preferences: UserPreferences = DEFAULT_PREFERENCES,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseToDate(timestamp);
  if (!date) return '';

  const locale = getIntlLocale(preferences);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: preferences.language === 'en',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Formats a timestamp into date and time together.
 */
export function formatDateTime(
  timestamp: string | Date | number,
  preferences: UserPreferences = DEFAULT_PREFERENCES,
  options?: { dateStyle?: 'full' | 'long' | 'medium' | 'short'; timeStyle?: 'full' | 'long' | 'medium' | 'short' }
): string {
  const date = parseToDate(timestamp);
  if (!date) return String(timestamp);

  const d = formatDate(date, preferences, {
    dateStyle: options?.dateStyle || 'medium',
  });
  const t = formatTime(date, preferences);

  if (preferences.language === 'fa') {
    return `${d}، ساعت ${t}`;
  }
  return `${d} at ${t}`;
}

/**
 * Formats a duration in minutes with localized units and numerals.
 * e.g., 90 -> "90m" in English, "۹۰ دقیقه" in Persian.
 */
export function formatDurationMinutes(
  minutes: number,
  preferences: UserPreferences = DEFAULT_PREFERENCES
): string {
  const formattedNum = formatNumeral(minutes, preferences);
  if (preferences.language === 'fa') {
    return `${formattedNum} دقیقه`;
  }
  return `${formattedNum}m`;
}

/**
 * Formats a duration in minutes into a concise hours and minutes string with localized units and numerals.
 * e.g., 80 -> "1h 20m" in English, "۱ ساعت و ۲۰ دقیقه" in Persian.
 * 45 -> "45m" in English, "۴۵ دقیقه" in Persian.
 * 120 -> "2h" in English, "۲ ساعت" in Persian.
 * 0 -> "0m" in English, "۰ دقیقه" in Persian.
 */
export function formatDurationHoursMinutes(
  totalMinutes: number,
  preferences: UserPreferences = DEFAULT_PREFERENCES
): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (preferences.language === 'fa') {
    if (hours > 0 && minutes > 0) {
      return `${formatNumeral(hours, preferences)} ساعت و ${formatNumeral(minutes, preferences)} دقیقه`;
    }
    if (hours > 0) {
      return `${formatNumeral(hours, preferences)} ساعت`;
    }
    return `${formatNumeral(minutes, preferences)} دقیقه`;
  }

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

