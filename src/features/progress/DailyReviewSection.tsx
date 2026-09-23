import React from 'react';
import { Calendar, Clock, CalendarClock, ListTodo, CheckCircle2 } from 'lucide-react';
import { DailyPeriodReview } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { getDayNameTranslationKey } from '../weekly-plans/weeklyPlanHelpers';

export interface DailyReviewSectionProps {
  readonly dailyBreakdown: readonly DailyPeriodReview[];
}

export const DailyReviewSection: React.FC<DailyReviewSectionProps> = ({ dailyBreakdown }) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } =
    useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('dailyReview')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(dailyBreakdown.length)} {t('activeDays').toLowerCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {dailyBreakdown.map((day) => {
          const dayNameKey = getDayNameTranslationKey(day.dayOfWeek);
          const localizedDayName = t(dayNameKey);
          const localizedDate = formatDate(day.date, {
            month: 'short',
            day: 'numeric',
          });

          const hasActivity = day.actualMinutes > 0 || day.plannedMinutes > 0 || day.sessionCount > 0;

          return (
            <div
              key={day.date}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
                hasActivity
                  ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70'
                  : 'border-neutral-100 dark:border-neutral-900 bg-white/40 dark:bg-neutral-950/40 opacity-75'
              }`}
            >
              {/* Day Header */}
              <div className="border-b border-neutral-200/60 dark:border-neutral-800 pb-2 mb-2.5">
                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {localizedDayName}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {localizedDate}
                </div>
              </div>

              {/* Stats List */}
              <div className="space-y-1.5 text-xs">
                {/* Planned */}
                <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center space-x-1">
                    <CalendarClock className="w-3 h-3 text-neutral-400" />
                    <span>{t('plannedTime')}</span>
                  </span>
                  <strong className="text-neutral-900 dark:text-neutral-200 font-medium">
                    {formatDurationHoursMinutes(day.plannedMinutes)}
                  </strong>
                </div>

                {/* Actual */}
                <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    <span>{t('actualTime')}</span>
                  </span>
                  <strong className="text-neutral-900 dark:text-neutral-200 font-medium">
                    {formatDurationHoursMinutes(day.actualMinutes)}
                  </strong>
                </div>

                {/* Sessions */}
                <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                  <span>{t('sessionsCount')}</span>
                  <span className="text-neutral-800 dark:text-neutral-300 font-medium">
                    {formatNumeral(day.sessionCount)}
                  </span>
                </div>

                {/* Tasks Worked On */}
                <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center space-x-1">
                    <ListTodo className="w-3 h-3 text-neutral-400" />
                    <span>{t('tasksWorkedOn')}</span>
                  </span>
                  <span className="text-neutral-800 dark:text-neutral-300 font-medium">
                    {formatNumeral(day.tasksWorkedOnCount)}
                  </span>
                </div>

                {/* Tasks Completed */}
                <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>{t('completed')}</span>
                  </span>
                  <span className="text-neutral-800 dark:text-neutral-300 font-medium">
                    {formatNumeral(day.tasksCompletedCount)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
