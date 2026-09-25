import React from 'react';
import { MapPin } from 'lucide-react';
import { ReportRoadmapItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportRoadmapsSectionProps {
  readonly roadmaps: readonly ReportRoadmapItem[];
}

export const ReportRoadmapsSection: React.FC<ReportRoadmapsSectionProps> = ({ roadmaps }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          {t('roadmapOverview')}
        </h2>
        <span className="text-[11px] text-neutral-500 font-mono">
          {formatNumeral(roadmaps.length)} {t('roadmapsCount')}
        </span>
      </div>

      {roadmaps.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noRoadmapsFound')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">{t('roadmap')}</th>
                <th className="py-2.5 px-3">{t('parentGoal')}</th>
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
              {roadmaps.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                    {r.title}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                    {r.goalTitle}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {formatNumeral(r.completedTaskCount)} / {formatNumeral(r.taskCount)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-semibold">
                    {formatNumeral(r.overallProgressPercentage)}%
                  </td>
                  <td className="py-2.5 px-3 bg-neutral-200/30 dark:bg-neutral-800/30 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(r.lifetimeActualMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(r.selectedPeriodPlannedMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHoursMinutes(r.selectedPeriodActualMinutes)}
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
