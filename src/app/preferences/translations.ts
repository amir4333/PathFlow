/**
 * Minimal Localization Dictionary for Settings & Core Presentation
 *
 * Prepared for future localization expansion without requiring full application translation.
 */

export const TRANSLATIONS = {
  en: {
    settingsTitle: 'Settings & Preferences',
    settingsDesc: 'Configure your preferred language and calendar system. Changes take effect immediately and are saved locally in your browser.',
    languageLabel: 'Application Language',
    languageDesc: 'Choose the interface language. Numerals and text adapt to this setting.',
    calendarLabel: 'Calendar System',
    calendarDesc: 'Choose the calendar system used for displaying dates throughout PathFlow. Independent from language.',
    previewTitle: 'Live Format Preview',
    previewDesc: 'Demonstrating independence between language, calendar, and numeral formatting.',
    currentDate: 'Current Date',
    currentTime: 'Current Time',
    sampleSessionDate: 'Sample Work Session',
    sampleDuration: 'Duration',
    english: 'English',
    persianLanguage: 'فارسی (Persian)',
    gregorianCalendar: 'Gregorian',
    persianCalendar: 'Persian / Jalali (شمسی)',
    totalRecorded: 'Total Recorded',
    activeTimer: 'Live Timer',
    sessionHistory: 'Session History',
    logManualSession: 'Log Manual Session',
    filterHistory: 'Filter History',
    allRoadmaps: 'All Roadmaps',
    allTasks: 'All Tasks',
    fromDate: 'From Date',
    toDate: 'To Date',
    clearFilters: 'Clear Filters',
    focusedTime: 'Focused Time',
    sessionsCount: 'Sessions',
    noMatchingSessions: 'No sessions match the selected filters',
    noMatchingSessionsDesc: 'Try adjusting your date range, task, or roadmap selection.',
    offlineNotice: 'All preferences are persisted locally and work completely offline without cloud dependencies.',
    architectureNotice: 'Internal Domain & Storage: Timestamps remain strictly ISO 8601 UTC. The Persian calendar operates purely at the presentation boundary.',
  },
  fa: {
    settingsTitle: 'تنظیمات و ترجیحات کاربر',
    settingsDesc: 'زبان برنامه و سامانه گاه‌شماری (تقویم) مورد نظر خود را انتخاب کنید. تغییرات بلافاصله اعمال شده و در مرورگر ذخیره می‌شوند.',
    languageLabel: 'زبان برنامه',
    languageDesc: 'زبان رابط کاربری و قالب نمایش اعداد را مشخص کنید.',
    calendarLabel: 'سامانه گاه‌شماری (تقویم)',
    calendarDesc: 'سامانه گاه‌شماری مورد استفاده برای نمایش تاریخ‌ها در بخش‌های مختلف برنامه (مستقل از زبان).',
    previewTitle: 'پیش‌نمایش زنده قالب‌ها',
    previewDesc: 'نمایش استقلال کامل زبان از سامانه گاه‌شماری و قالب اعداد.',
    currentDate: 'تاریخ جاری',
    currentTime: 'زمان جاری',
    sampleSessionDate: 'نمونه ثبت جلسه کاری',
    sampleDuration: 'مدت زمان',
    english: 'English (انگلیسی)',
    persianLanguage: 'فارسی',
    gregorianCalendar: 'میلادی (Gregorian)',
    persianCalendar: 'شمسی / جلالی (Persian)',
    totalRecorded: 'مجموع ثبت شده',
    activeTimer: 'تایمر زنده',
    sessionHistory: 'تاریخچه جلسات',
    logManualSession: 'ثبت جلسه به صورت دستی',
    filterHistory: 'فیلتر تاریخچه',
    allRoadmaps: 'همه نقشه‌های راه',
    allTasks: 'همه وظایف',
    fromDate: 'از تاریخ',
    toDate: 'تا تاریخ',
    clearFilters: 'پاک کردن فیلترها',
    focusedTime: 'زمان تمرکز',
    sessionsCount: 'جلسات',
    noMatchingSessions: 'هیچ جلسه‌ای با فیلترهای انتخابی مطابقت ندارد',
    noMatchingSessionsDesc: 'بازه تاریخی، وظیفه یا نقشه راه انتخابی را تغییر دهید.',
    offlineNotice: 'تمامی ترجیحات به صورت محلی ذخیره شده و بدون نیاز به اینترنت یا سرور کار می‌کنند.',
    architectureNotice: 'معماری ذخیره‌سازی و داده‌ها: تمامی زمان‌ها در فرمت استاندارد بین‌المللی ISO 8601 UTC نگهداری شده و تبدیل تقویم شمسی صرفاً در لایه نمایش انجام می‌شود.',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS['en'];

export function getTranslation(key: TranslationKey, language: 'en' | 'fa'): string {
  const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}
