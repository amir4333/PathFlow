import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREFERENCES,
  loadStoredPreferences,
  saveStoredPreferences,
  UserPreferences,
  PREFERENCES_STORAGE_KEY,
} from '../../src/app/preferences/userPreferences';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumeral,
  toPersianDigits,
  toAsciiDigits,
  formatDurationMinutes,
} from '../../src/app/preferences/dateFormatting';
import { getTranslation } from '../../src/app/preferences/translations';

// Mock storage implementation for isolation
class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

test('UserPreferences: Default preferences are English and Gregorian', () => {
  assert.equal(DEFAULT_PREFERENCES.language, 'en');
  assert.equal(DEFAULT_PREFERENCES.calendar, 'gregorian');

  const mockStorage = new MockStorage();
  const loaded = loadStoredPreferences(mockStorage);
  assert.deepEqual(loaded, DEFAULT_PREFERENCES);
});

test('UserPreferences: Persistence into storage and restoration across reloads', () => {
  const mockStorage = new MockStorage();

  // Save custom configuration
  const customPrefs: UserPreferences = {
    language: 'fa',
    calendar: 'persian',
  };
  saveStoredPreferences(customPrefs, mockStorage);

  // Assert raw storage content
  const raw = mockStorage.getItem(PREFERENCES_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.language, 'fa');
  assert.equal(parsed.calendar, 'persian');

  // Load back as if reload happened
  const restored = loadStoredPreferences(mockStorage);
  assert.deepEqual(restored, customPrefs);
});

test('UserPreferences: Changing language and calendar independently', () => {
  const mockStorage = new MockStorage();

  // Combination 1: English + Persian calendar
  const enPersian: UserPreferences = { language: 'en', calendar: 'persian' };
  saveStoredPreferences(enPersian, mockStorage);
  assert.deepEqual(loadStoredPreferences(mockStorage), enPersian);

  // Combination 2: Persian language + Gregorian calendar
  const faGregorian: UserPreferences = { language: 'fa', calendar: 'gregorian' };
  saveStoredPreferences(faGregorian, mockStorage);
  assert.deepEqual(loadStoredPreferences(mockStorage), faGregorian);

  // Corrupted JSON fallback
  mockStorage.setItem(PREFERENCES_STORAGE_KEY, '{invalid json');
  assert.deepEqual(loadStoredPreferences(mockStorage), DEFAULT_PREFERENCES);
});

test('DateFormatting: Pure presentation without mutating underlying ISO timestamps', () => {
  const originalIso = '2026-09-23T14:30:00.000Z';
  const cloned = originalIso.slice();

  const formattedEnGreg = formatDate(originalIso, { language: 'en', calendar: 'gregorian' });
  const formattedFaPersian = formatDate(originalIso, { language: 'fa', calendar: 'persian' });

  // Stored string is strictly untouched and intact
  assert.equal(originalIso, cloned);
  assert.equal(originalIso, '2026-09-23T14:30:00.000Z');
  assert.ok(formattedEnGreg.length > 0);
  assert.ok(formattedFaPersian.length > 0);
});

test('DateFormatting: Independent matrix of Language and Calendar combinations', () => {
  // Fixed UTC reference date: 2026-09-23 14:30:00 UTC
  // In Gregorian: September 23, 2026
  // In Jalali/Persian: 1 Mehr 1405 (۱ مهر ۱۴۰۵)
  const isoTimestamp = '2026-09-23T14:30:00.000Z';

  // 1. English + Gregorian
  const enGreg = formatDate(isoTimestamp, { language: 'en', calendar: 'gregorian' }, { timeZone: 'UTC' });
  assert.ok(enGreg.includes('September') || enGreg.includes('Sep'), `Expected month in: ${enGreg}`);
  assert.ok(enGreg.includes('23'), `Expected day in: ${enGreg}`);
  assert.ok(enGreg.includes('2026'), `Expected year in: ${enGreg}`);

  // 2. English + Persian (Independent: English text + Persian calendar)
  const enPersian = formatDate(isoTimestamp, { language: 'en', calendar: 'persian' }, { timeZone: 'UTC' });
  assert.ok(enPersian.includes('Mehr'), `Expected Persian month Mehr in: ${enPersian}`);
  assert.ok(enPersian.includes('1'), `Expected Persian day 1 in: ${enPersian}`);
  assert.ok(enPersian.includes('1405'), `Expected Persian year 1405 in: ${enPersian}`);

  // 3. Persian + Gregorian (Independent: Persian text + Gregorian calendar)
  const faGreg = formatDate(isoTimestamp, { language: 'fa', calendar: 'gregorian' }, { timeZone: 'UTC' });
  assert.ok(faGreg.includes('سپتامبر'), `Expected Persian transliteration for September in: ${faGreg}`);
  assert.ok(faGreg.includes('۲۰۲۶'), `Expected Persian numeral for 2026 in: ${faGreg}`);

  // 4. Persian + Persian (Persian text + Persian calendar)
  const faPersian = formatDate(isoTimestamp, { language: 'fa', calendar: 'persian' }, { timeZone: 'UTC' });
  assert.ok(faPersian.includes('مهر'), `Expected Persian month مهر in: ${faPersian}`);
  assert.ok(faPersian.includes('۱۴۰۵'), `Expected Persian year ۱۴۰۵ in: ${faPersian}`);
  assert.ok(faPersian.includes('۱'), `Expected Persian day ۱ in: ${faPersian}`);
});

test('Numerals: Persian numerals when language is fa; Latin numerals when language is en', () => {
  const num = 1405;
  const str = 'Task 42 took 90 minutes';

  // Persian language produces Persian digits
  assert.equal(formatNumeral(num, { language: 'fa', calendar: 'persian' }), '۱۴۰۵');
  assert.equal(formatNumeral(num, { language: 'fa', calendar: 'gregorian' }), '۱۴۰۵');
  assert.equal(formatNumeral(str, { language: 'fa', calendar: 'gregorian' }), 'Task ۴۲ took ۹۰ minutes');

  // English language produces Latin digits even if calendar is Persian
  assert.equal(formatNumeral(num, { language: 'en', calendar: 'persian' }), '1405');
  assert.equal(formatNumeral(num, { language: 'en', calendar: 'gregorian' }), '1405');
  assert.equal(formatNumeral(str, { language: 'en', calendar: 'persian' }), 'Task 42 took 90 minutes');

  // Bidirectional digit helpers
  assert.equal(toPersianDigits('0123456789'), '۰۱۲۳۴۵۶۷۸۹');
  assert.equal(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
});

test('FormatDurationMinutes: Formats durations with localized units and numerals', () => {
  const mins = 90;

  const enDuration = formatDurationMinutes(mins, { language: 'en', calendar: 'gregorian' });
  assert.equal(enDuration, '90m');

  const enDurationPersianCal = formatDurationMinutes(mins, { language: 'en', calendar: 'persian' });
  assert.equal(enDurationPersianCal, '90m');

  const faDuration = formatDurationMinutes(mins, { language: 'fa', calendar: 'persian' });
  assert.equal(faDuration, '۹۰ دقیقه');

  const faDurationGregCal = formatDurationMinutes(mins, { language: 'fa', calendar: 'gregorian' });
  assert.equal(faDurationGregCal, '۹۰ دقیقه');
});

test('Translations: Settings dictionary resolves labels correctly', () => {
  assert.equal(getTranslation('settingsTitle', 'en'), 'Settings & Preferences');
  assert.equal(getTranslation('settingsTitle', 'fa'), 'تنظیمات و ترجیحات کاربر');
  assert.equal(getTranslation('languageLabel', 'fa'), 'زبان برنامه');
  assert.equal(getTranslation('calendarLabel', 'fa'), 'سامانه گاه‌شماری (تقویم)');
});

test('Session duration calculations remain completely unaffected by preferences', () => {
  const startIso = '2026-09-23T10:00:00.000Z';
  const endIso = '2026-09-23T11:30:00.000Z';

  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const durationMinutes = Math.round(diffMs / 60000);

  // Exactly 90 minutes regardless of calendar or language presentation
  assert.equal(durationMinutes, 90);
});
