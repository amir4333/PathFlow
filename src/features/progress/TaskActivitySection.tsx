import React from 'react';
import { ListTodo, Clock, CalendarClock, Compass } from 'lucide-react';
import { TaskPeriodActivity } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TaskActivitySectionProps {
  readonly tasks: readonly TaskPeriodActivity[];
}

export const TaskActivitySection: React.FC<TaskActivitySectionProps> = ({ tasks }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ListTodo className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('taskActivity')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(tasks.length)}
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t('noActivityInPeriodDesc')}
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {tasks.map((task) => (
            <div
              key={task.taskId}
              className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    task.isCompleted
                      ? 'bg-emerald-500'
                      : task.status === 'in_progress'
                      ? 'bg-blue-500'
                      : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {task.title}
                    </span>
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                      <Compass className="w-2.5 h-2.5 mr-0.5 text-neutral-400" />
                      {task.roadmapTitle}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-2 mt-0.5">
                    <span>{t('status')}: {task.status}</span>
                    {task.sessionCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatNumeral(task.sessionCount)} {t(task.sessionCount === 1 ? 'session' : 'sessions')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Numerical Metrics */}
              <div className="flex items-center space-x-4 text-xs shrink-0 self-end sm:self-center">
                {task.actualMinutes > 0 && (
                  <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {t('actualTime')}: <strong>{formatDurationHoursMinutes(task.actualMinutes)}</strong>
                    </span>
                  </span>
                )}
                {task.plannedMinutes > 0 && (
                  <span className="flex items-center space-x-1 text-neutral-600 dark:text-neutral-400">
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>
                      {t('plannedTime')}: <strong>{formatDurationHoursMinutes(task.plannedMinutes)}</strong>
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
