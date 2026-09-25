import React from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { ReportWeeklyPlanningSummary } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportWeeklyPlanningSectionProps {
  readonly weeklyPlanning: ReportWeeklyPlanningSummary;
}

export const ReportWeeklyPlanningSection: React.FC<ReportWeeklyPlanningSectionProps> = ({
  weeklyPlanning,
}) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2 gap-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          {t('weeklyPlanningSummary')}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-500">
          <span>
            {formatNumeral(weeklyPlanning.completedCommitmentsCount)} / {formatNumeral(weeklyPlanning.plannedCommitmentsCount)} {t('completedCommitments')}
          </span>
          <span>•</span>
          <span>
            {formatDurationHoursMinutes(weeklyPlanning.totalPlannedMinutes)} {t('plannedTime')}
          </span>
          <span>•</span>
          <span>
            {formatNumeral(weeklyPlanning.datedCommitmentsCount)} {t('datedCommitments')} / {formatNumeral(weeklyPlanning.flexibleCommitmentsCount)} {t('flexibleCommitmentsCount')}
          </span>
        </div>
      </div>

      {weeklyPlanning.commitments.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noPlansInPeriod')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">{t('task')}</th>
                <th className="py-2.5 px-3">{t('roadmap')}</th>
                <th className="py-2.5 px-3 text-center">{t('date')}</th>
                <th className="py-2.5 px-3 text-right">{t('plannedTime')}</th>
                <th className="py-2.5 px-3 text-center">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {weeklyPlanning.commitments.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.taskTitle}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                    {item.roadmapTitle}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-neutral-600 dark:text-neutral-400">
                    {item.targetDate ? formatDate(item.targetDate) : t('flexibleTime')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHoursMinutes(item.plannedMinutes)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                        item.isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {item.isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          {t('completedFilter')}
                        </>
                      ) : (
                        t('inProgressFilter')
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
