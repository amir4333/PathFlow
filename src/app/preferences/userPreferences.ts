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
export type Language = AppLanguage;
export type AppCalendar = 'gregorian' | 'persian';
export type AppTheme = 'light' | 'dark';

export interface UserPreferences {
  readonly language: AppLanguage;
  readonly calendar: AppCalendar;
  readonly theme?: AppTheme;
}

export const DEFAULT_PREFERENCES: UserPreferences & { readonly theme: AppTheme } = {
  language: 'en',
  calendar: 'gregorian',
  theme: 'light',
};

export const PREFERENCES_STORAGE_KEY = 'pathflow_user_preferences';

/**
 * Normalizes any unknown value into a valid AppTheme ('light' | 'dark').
 * Defaults safely to 'light'.
 */
export function resolveTheme(value: unknown): AppTheme {
  return value === 'dark' ? 'dark' : 'light';
}

/**
 * Applies the selected theme to the root <html> element.
 * - 'dark'  -> adds 'dark' class to <html>
 * - 'light' -> removes 'dark' class from <html>
 */
export function applyThemeToDocument(
  theme: AppTheme,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined
): void {
  if (!doc || !doc.documentElement) return;
  if (theme === 'dark') {
    doc.documentElement.classList.add('dark');
  } else {
    doc.documentElement.classList.remove('dark');
  }
}

/**
 * Loads stored user preferences from localStorage with fallback to defaults.
 */
export function loadStoredPreferences(
  storage?: Storage
): UserPreferences & { readonly theme: AppTheme } {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = targetStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_PREFERENCES;
    }

    const language: AppLanguage = parsed.language === 'fa' ? 'fa' : 'en';
    const calendar: AppCalendar = parsed.calendar === 'persian' ? 'persian' : 'gregorian';
    const theme: AppTheme = resolveTheme(parsed.theme);

    return { language, calendar, theme };
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
    const normalized: UserPreferences & { readonly theme: AppTheme } = {
      language: preferences.language === 'fa' ? 'fa' : 'en',
      calendar: preferences.calendar === 'persian' ? 'persian' : 'gregorian',
      theme: resolveTheme(preferences.theme),
    };
    targetStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.warn('Failed to save user preferences to localStorage', err);
  }
}
