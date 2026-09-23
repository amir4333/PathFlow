import React, { useState } from 'react';
import { Target, Layers, CheckCircle2, Clock } from 'lucide-react';
import { GoalPeriodProgress } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface GoalProgressSectionProps {
  readonly goals: readonly GoalPeriodProgress[];
}

export const GoalProgressSection: React.FC<GoalProgressSectionProps> = ({ goals }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');

  const activeGoals = goals.filter((g) => g.hasActivityInPeriod);
  const displayedGoals = filterMode === 'active' ? activeGoals : goals;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('goalProgress')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(displayedGoals.length)}
          </span>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center space-x-1 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterMode === 'active'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('activeGoals')} ({formatNumeral(activeGoals.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('allGoals')} ({formatNumeral(goals.length)})
          </button>
        </div>
      </div>

      {displayedGoals.length === 0 ? (
        <div className="text-center py-6 text-sm text-neutral-500 dark:text-neutral-400">
          {filterMode === 'active' ? t('noActivityInPeriodDesc') : t('noTasksScheduled')}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedGoals.map((goal) => (
            <div
              key={goal.goalId}
              className="border border-neutral-100 dark:border-neutral-800 rounded-lg p-3.5 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {goal.title}
                  </h3>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      goal.status === 'achieved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {goal.status}
                  </span>
                </div>

                <div className="flex items-center space-x-4 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                  <span className="flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {formatNumeral(goal.totalRoadmaps)} {t('roadmapsCount').toLowerCase()}
                    </span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {formatNumeral(goal.completedTasks)} / {formatNumeral(goal.totalTasks)}{' '}
                      {t('tasksCount').toLowerCase()}
                    </span>
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center space-x-3 mt-2">
                <div
                  className="flex-1 bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={goal.taskCompletionPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${goal.title}: ${formatNumeral(goal.taskCompletionPercentage)}%`}
                >
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, goal.taskCompletionPercentage)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 min-w-10 text-right">
                  {formatNumeral(goal.taskCompletionPercentage)}%
                </span>
              </div>

              {/* Period Stats */}
              {(goal.actualMinutes > 0 || goal.plannedMinutes > 0) && (
                <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center space-x-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {t('actualTime')}: <strong>{formatDurationHoursMinutes(goal.actualMinutes)}</strong>
                    </span>
                  </span>
                  {goal.plannedMinutes > 0 && (
                    <span>
                      {t('plannedTime')}: <strong>{formatDurationHoursMinutes(goal.plannedMinutes)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
