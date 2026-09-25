import React from 'react';
import { Target, CheckCircle2, Clock } from 'lucide-react';
import { ReportGoalItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportGoalsSectionProps {
  readonly goals: readonly ReportGoalItem[];
}

export const ReportGoalsSection: React.FC<ReportGoalsSectionProps> = ({ goals }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2 gap-1">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('goalOverview')}
        </h2>
        <span className="text-[11px] text-neutral-500 italic">
          {t('lifetimeVsPeriodNotice')}
        </span>
      </div>

      {goals.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noGoalsFound')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">{t('goal')}</th>
                <th className="py-2.5 px-3">{t('status')}</th>
                <th className="py-2.5 px-3 text-center">{t('roadmapsCount')}</th>
                <th className="py-2.5 px-3 text-center">{t('tasksCompleted')}</th>
                <th className="py-2.5 px-3 text-center">{t('overallProgress')}</th>
                <th className="py-2.5 px-3 bg-neutral-200/50 dark:bg-neutral-800/50 text-right">
                  {t('lifetimeActualTime')}
                </th>
                <th className="py-2.5 px-3 bg-blue-50/50 dark:bg-blue-950/20 text-right">
                  {t('periodPlannedTime')}
                </th>
                <th className="py-2.5 px-3 bg-blue-50/50 dark:bg-blue-950/20 text-right">
                  {t('periodActualTime')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {goals.map((g) => (
                <tr key={g.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {g.title}
                    </div>
                    {g.description && (
                      <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                        {g.description}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {g.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {formatNumeral(g.roadmapCount)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {formatNumeral(g.completedTaskCount)} / {formatNumeral(g.taskCount)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-semibold font-mono">
                      <span>{formatNumeral(g.overallProgressPercentage)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 bg-neutral-200/30 dark:bg-neutral-800/30 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(g.lifetimeActualMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(g.selectedPeriodPlannedMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHoursMinutes(g.selectedPeriodActualMinutes)}
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
