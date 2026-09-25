import React from 'react';
import { CheckSquare } from 'lucide-react';
import { ReportTaskItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportTasksSectionProps {
  readonly tasks: readonly ReportTaskItem[];
}

export const ReportTasksSection: React.FC<ReportTasksSectionProps> = ({ tasks }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('taskProgress')}
        </h2>
        <span className="text-[11px] text-neutral-500 font-mono">
          {formatNumeral(tasks.length)} {t('tasksCount')}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noTasksFound')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">{t('task')}</th>
                <th className="py-2.5 px-3">{t('roadmap')}</th>
                <th className="py-2.5 px-3 text-center">{t('status')}</th>
                <th className="py-2.5 px-3 bg-neutral-200/50 dark:bg-neutral-800/50 text-right">
                  {t('lifetimeActualTime')}
                </th>
                <th className="py-2.5 px-3 bg-blue-50/50 dark:bg-blue-950/20 text-right">
                  {t('periodPlannedTime')}
                </th>
                <th className="py-2.5 px-3 bg-blue-50/50 dark:bg-blue-950/20 text-right">
                  {t('periodActualTime')}
                </th>
                <th className="py-2.5 px-3 text-center">{t('totalSessions')}</th>
                <th className="py-2.5 px-3 text-right">{t('completionDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                    <div className="flex items-center gap-1.5">
                      <span>{task.title}</span>
                      {task.priority && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                    {task.roadmapTitle}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        task.isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 bg-neutral-200/30 dark:bg-neutral-800/30 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(task.lifetimeActualMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDurationHoursMinutes(task.selectedPeriodPlannedMinutes)}
                  </td>
                  <td className="py-2.5 px-3 bg-blue-50/30 dark:bg-blue-950/10 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHoursMinutes(task.selectedPeriodActualMinutes)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {formatNumeral(task.selectedPeriodSessionCount)}{' '}
                    <span className="text-neutral-400 text-[10px]">
                      ({formatNumeral(task.lifetimeSessionCount)})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-neutral-500">
                    {task.completionDate ?? '—'}
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
