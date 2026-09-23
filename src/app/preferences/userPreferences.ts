/**
 * User Preferences Domain & Persistence Model
 *
 * Defines independent user preferences for:
 * 1. Application language ('en' | 'fa')
 * 2. Calendar system ('gregorian' | 'persian')
 *
 * Persisted locally in browser localStorage for offline-first resilience.
 * Does not alter or mutate underlying ISO 8601 UTC timestamps in the domain or database.
 */

export type AppLanguage = 'en' | 'fa';
export type AppCalendar = 'gregorian' | 'persian';

export interface UserPreferences {
  readonly language: AppLanguage;
  readonly calendar: AppCalendar;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  calendar: 'gregorian',
};

export const PREFERENCES_STORAGE_KEY = 'pathflow_user_preferences';

/**
 * Loads stored user preferences from localStorage with fallback to defaults.
 */
export function loadStoredPreferences(storage?: Storage): UserPreferences {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = targetStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);

    const language: AppLanguage = parsed.language === 'fa' ? 'fa' : 'en';
    const calendar: AppCalendar = parsed.calendar === 'persian' ? 'persian' : 'gregorian';

    return { language, calendar };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Persists user preferences into localStorage.
 */
export function saveStoredPreferences(preferences: UserPreferences, storage?: Storage): void {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) return;

  try {
    targetStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.warn('Failed to save user preferences to localStorage', err);
  }
}
