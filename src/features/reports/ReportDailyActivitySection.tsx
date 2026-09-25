import React from 'react';
import { Calendar } from 'lucide-react';
import { ReportDailyActivityItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportDailyActivitySectionProps {
  readonly dailyActivity: readonly ReportDailyActivityItem[];
}

export const ReportDailyActivitySection: React.FC<ReportDailyActivitySectionProps> = ({
  dailyActivity,
}) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const getDayName = (dayOfWeek: number) => {
    switch (dayOfWeek) {
      case 1:
        return t('monday');
      case 2:
        return t('tuesday');
      case 3:
        return t('wednesday');
      case 4:
        return t('thursday');
      case 5:
        return t('friday');
      case 6:
        return t('saturday');
      case 7:
        return t('sunday');
      default:
        return '';
    }
  };

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          {t('dailyActivityBreakdown')}
        </h2>
        <span className="text-[11px] text-neutral-500 font-mono">
          {formatNumeral(dailyActivity.length)} {t('activeDays')}
        </span>
      </div>

      {dailyActivity.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noDailyActivity')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">{t('date')}</th>
                <th className="py-2.5 px-3 text-right">{t('plannedTime')}</th>
                <th className="py-2.5 px-3 text-right">{t('actualTime')}</th>
                <th className="py-2.5 px-3 text-center">{t('totalSessions')}</th>
                <th className="py-2.5 px-3 text-center">{t('tasksWorkedOn')}</th>
                <th className="py-2.5 px-3 text-center">{t('tasksCompleted')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {dailyActivity.map((day) => {
                const hasActivity = day.actualMinutes > 0 || day.plannedMinutes > 0 || day.sessionCount > 0;
                return (
                  <tr
                    key={day.date}
                    className={`hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 ${
                      hasActivity ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50/30 dark:bg-neutral-900/30 opacity-75'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatDate(day.date)}
                      </span>{' '}
                      <span className="text-[11px] text-neutral-500">({getDayName(day.dayOfWeek)})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                      {formatDurationHoursMinutes(day.plannedMinutes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatDurationHoursMinutes(day.actualMinutes)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {formatNumeral(day.sessionCount)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {formatNumeral(day.tasksWorkedOnCount)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {formatNumeral(day.tasksCompletedCount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
