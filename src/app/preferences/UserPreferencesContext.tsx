/**
 * User Preferences Context & Provider
 *
 * Exposes language & calendar preferences and reactive formatting helpers
 * across the application component tree.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserPreferences,
  AppLanguage,
  AppCalendar,
  DEFAULT_PREFERENCES,
  loadStoredPreferences,
  saveStoredPreferences,
} from './userPreferences';
import {
  formatDate as formatWithPrefs,
  formatDateTime as formatDateTimeWithPrefs,
  formatTime as formatTimeWithPrefs,
  formatNumeral as formatNumeralWithPrefs,
  formatDurationMinutes as formatDurationWithPrefs,
} from './dateFormatting';
import { getTranslation, TranslationKey } from './translations';

export interface UserPreferencesContextValue {
  preferences: UserPreferences;
  setLanguage: (lang: AppLanguage) => void;
  setCalendar: (cal: AppCalendar) => void;
  setPreferences: (newPrefs: Partial<UserPreferences>) => void;
  formatDate: (timestamp: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (
    timestamp: string | Date | number,
    options?: { dateStyle?: 'full' | 'long' | 'medium' | 'short'; timeStyle?: 'full' | 'long' | 'medium' | 'short' }
  ) => string;
  formatTime: (timestamp: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumeral: (value: string | number) => string;
  formatDurationMinutes: (minutes: number) => string;
  t: (key: TranslationKey) => string;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export interface UserPreferencesProviderProps {
  children: React.ReactNode;
  initialPreferences?: UserPreferences;
}

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({
  children,
  initialPreferences,
}) => {
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => {
    return initialPreferences || loadStoredPreferences();
  });

  // Sync to localStorage whenever preferences change
  useEffect(() => {
    saveStoredPreferences(preferences);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = preferences.language;
      // Set direction attribute: Persian is RTL
      document.documentElement.dir = preferences.language === 'fa' ? 'rtl' : 'ltr';
    }
  }, [preferences]);

  const setLanguage = useCallback((language: AppLanguage) => {
    setPreferencesState((prev) => ({ ...prev, language }));
  }, []);

  const setCalendar = useCallback((calendar: AppCalendar) => {
    setPreferencesState((prev) => ({ ...prev, calendar }));
  }, []);

  const setPreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({
      ...prev,
      ...newPrefs,
    }));
  }, []);

  const formatDate = useCallback(
    (timestamp: string | Date | number, options?: Intl.DateTimeFormatOptions) => {
      return formatWithPrefs(timestamp, preferences, options);
    },
    [preferences]
  );

  const formatDateTime = useCallback(
    (
      timestamp: string | Date | number,
      options?: { dateStyle?: 'full' | 'long' | 'medium' | 'short'; timeStyle?: 'full' | 'long' | 'medium' | 'short' }
    ) => {
      return formatDateTimeWithPrefs(timestamp, preferences, options);
    },
    [preferences]
  );

  const formatTime = useCallback(
    (timestamp: string | Date | number, options?: Intl.DateTimeFormatOptions) => {
      return formatTimeWithPrefs(timestamp, preferences, options);
    },
    [preferences]
  );

  const formatNumeral = useCallback(
    (value: string | number) => {
      return formatNumeralWithPrefs(value, preferences);
    },
    [preferences]
  );

  const formatDurationMinutes = useCallback(
    (minutes: number) => {
      return formatDurationWithPrefs(minutes, preferences);
    },
    [preferences]
  );

  const t = useCallback(
    (key: TranslationKey) => {
      return getTranslation(key, preferences.language);
    },
    [preferences.language]
  );

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      preferences,
      setLanguage,
      setCalendar,
      setPreferences,
      formatDate,
      formatDateTime,
      formatTime,
      formatNumeral,
      formatDurationMinutes,
      t,
    }),
    [
      preferences,
      setLanguage,
      setCalendar,
      setPreferences,
      formatDate,
      formatDateTime,
      formatTime,
      formatNumeral,
      formatDurationMinutes,
      t,
    ]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return ctx;
}
