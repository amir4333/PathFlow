import React from 'react';
import { useUserPreferences } from '../../app/preferences';
import {
  Languages,
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  Database,
  Clock,
  HardDrive,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    preferences,
    setLanguage,
    setCalendar,
    formatDate,
    formatTime,
    formatNumeral,
    formatDurationMinutes,
    t,
  } = useUserPreferences();

  // Reference test timestamp: 2026-09-23T14:30:00.000Z
  const sampleIsoDate = '2026-09-23T14:30:00.000Z';
  const now = new Date();

  return (
    <div id="settings-view" className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <span>{t('settingsTitle')}</span>
        </h1>
        <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
          {t('settingsDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Preference Card */}
        <section
          aria-labelledby="language-preference-heading"
          className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="language-preference-heading"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {t('languageLabel')}
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {t('languageDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              id="pref-lang-en"
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.language === 'en'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('english')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.language === 'en' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Latin numerals (1, 2, 3)
                </div>
              </div>
              {preferences.language === 'en' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>

            <button
              id="pref-lang-fa"
              type="button"
              onClick={() => setLanguage('fa')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.language === 'fa'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('persianLanguage')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.language === 'fa' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  اعداد فارسی (۱، ۲، ۳)
                </div>
              </div>
              {preferences.language === 'fa' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </section>

        {/* Calendar Preference Card */}
        <section
          aria-labelledby="calendar-preference-heading"
          className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="calendar-preference-heading"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {t('calendarLabel')}
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {t('calendarDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              id="pref-cal-gregorian"
              type="button"
              onClick={() => setCalendar('gregorian')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.calendar === 'gregorian'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('gregorianCalendar')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.calendar === 'gregorian' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Standard solar
                </div>
              </div>
              {preferences.calendar === 'gregorian' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>

            <button
              id="pref-cal-persian"
              type="button"
              onClick={() => setCalendar('persian')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.calendar === 'persian'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('persianCalendar')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.calendar === 'persian' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Jalali solar
                </div>
              </div>
              {preferences.calendar === 'persian' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Live Format Preview Area */}
      <section
        aria-labelledby="preview-heading"
        className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-4"
      >
        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h2 id="preview-heading" className="text-xs font-bold uppercase tracking-wider">
            {t('previewTitle')}
          </h2>
        </div>
        <p className="text-xs text-neutral-500">
          {t('previewDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Active Settings Pill */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              Active Config
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 capitalize">
              {preferences.language === 'en' ? 'English' : 'فارسی'} • {preferences.calendar}
            </div>
          </div>

          {/* Current Date Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('currentDate')}
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDate(now)}
            </div>
          </div>

          {/* Sample Timestamp Date Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('sampleSessionDate')}
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDate(sampleIsoDate)}
            </div>
          </div>

          {/* Sample Duration & Time Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('sampleDuration')} & Time
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDurationMinutes(90)} • {formatTime(sampleIsoDate)}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Offline Local-First Transparency Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
          <Database className="w-4 h-4 text-neutral-500" />
          <span>Architecture & Persistence Guarantee</span>
        </div>
        <p className="leading-relaxed">
          {t('architectureNotice')}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('offlineNotice')}</span>
        </div>
      </div>
    </div>
  );
};
