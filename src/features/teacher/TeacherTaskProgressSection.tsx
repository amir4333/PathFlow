import React, { useState } from 'react';
import { CheckSquare, Compass, Clock, CalendarClock, Activity, Filter } from 'lucide-react';
import { TaskPeriodActivity } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TeacherTaskProgressSectionProps {
  readonly tasks: readonly TaskPeriodActivity[];
}

type TaskFilterOption = 'all' | 'worked-on' | 'completed' | 'in-progress';

export const TeacherTaskProgressSection: React.FC<TeacherTaskProgressSectionProps> = ({ tasks }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [filter, setFilter] = useState<TaskFilterOption>('all');

  const filteredTasks = tasks.filter((task) => {
    switch (filter) {
      case 'worked-on':
        return task.actualMinutes > 0 || task.sessionCount > 0;
      case 'completed':
        return task.isCompleted || task.status === 'completed';
      case 'in-progress':
        return task.status === 'in_progress';
      case 'all':
      default:
        return true;
    }
  });

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header with Title and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('taskProgress')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(filteredTasks.length)} {t('allTasks')}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="inline-flex p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md transition-all shrink-0 ${
              filter === 'all'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('allTasksFilter')} ({formatNumeral(tasks.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('worked-on')}
            className={`px-3 py-1 rounded-md transition-all shrink-0 ${
              filter === 'worked-on'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('workedOnFilter')} ({formatNumeral(tasks.filter((t) => t.actualMinutes > 0 || t.sessionCount > 0).length)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-md transition-all shrink-0 ${
              filter === 'completed'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('completedFilter')} ({formatNumeral(tasks.filter((t) => t.isCompleted || t.status === 'completed').length)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('in-progress')}
            className={`px-3 py-1 rounded-md transition-all shrink-0 ${
              filter === 'in-progress'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('inProgressFilter')} ({formatNumeral(tasks.filter((t) => t.status === 'in_progress').length)})
          </button>
        </div>
      </div>

      {/* Read-Only Task Table */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          {t('noTasksFound')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold select-none">
              <tr>
                <th className="py-2.5 px-4">{t('allTasks')}</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">{t('roadmapOverview')}</th>
                <th className="py-2.5 px-4">{t('status')}</th>
                <th className="py-2.5 px-4 text-right">{t('plannedTime')}</th>
                <th className="py-2.5 px-4 text-right">{t('actualTime')}</th>
                <th className="py-2.5 px-4 text-right hidden md:table-cell">{t('sessionsCount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {filteredTasks.map((task) => (
                <tr
                  key={task.taskId}
                  className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          task.isCompleted
                            ? 'bg-emerald-500'
                            : task.status === 'in_progress'
                            ? 'bg-blue-500'
                            : 'bg-neutral-300 dark:bg-neutral-600'
                        }`}
                      />
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                        {task.title}
                      </span>
                    </div>
                    {/* Small screen roadmap label */}
                    <div className="sm:hidden text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 ml-4 flex items-center space-x-1">
                      <Compass className="w-2.5 h-2.5" />
                      <span>{task.roadmapTitle}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium">
                      <Compass className="w-3 h-3 mr-1 text-neutral-400" />
                      {task.roadmapTitle}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        task.isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400">
                    {task.plannedMinutes > 0 ? formatDurationHoursMinutes(task.plannedMinutes) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {task.actualMinutes > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatDurationHoursMinutes(task.actualMinutes)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 hidden md:table-cell">
                    {task.sessionCount > 0 ? formatNumeral(task.sessionCount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
