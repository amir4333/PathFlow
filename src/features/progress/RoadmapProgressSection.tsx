import React, { useState } from 'react';
import { Compass, CheckCircle2, Clock, Target } from 'lucide-react';
import { RoadmapPeriodProgress } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface RoadmapProgressSectionProps {
  readonly roadmaps: readonly RoadmapPeriodProgress[];
}

export const RoadmapProgressSection: React.FC<RoadmapProgressSectionProps> = ({ roadmaps }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');

  const activeRoadmaps = roadmaps.filter((r) => r.hasActivityInPeriod);
  const displayedRoadmaps = filterMode === 'active' ? activeRoadmaps : roadmaps;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <Compass className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('roadmapProgress')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(displayedRoadmaps.length)}
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
            {t('activeRoadmaps')} ({formatNumeral(activeRoadmaps.length)})
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
            {t('allRoadmaps')} ({formatNumeral(roadmaps.length)})
          </button>
        </div>
      </div>

      {displayedRoadmaps.length === 0 ? (
        <div className="text-center py-6 text-sm text-neutral-500 dark:text-neutral-400">
          {filterMode === 'active' ? t('noActivityInPeriodDesc') : t('noTasksScheduled')}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedRoadmaps.map((roadmap) => (
            <div
              key={roadmap.roadmapId}
              className="border border-neutral-100 dark:border-neutral-800 rounded-lg p-3.5 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {roadmap.title}
                  </h3>
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                    <Target className="w-2.5 h-2.5 mr-1 text-neutral-400" />
                    {roadmap.goalTitle}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                  <span className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {formatNumeral(roadmap.completedTasks)} / {formatNumeral(roadmap.totalTasks)}{' '}
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
                  aria-valuenow={roadmap.taskCompletionPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${roadmap.title}: ${formatNumeral(roadmap.taskCompletionPercentage)}%`}
                >
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, roadmap.taskCompletionPercentage)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 min-w-10 text-right">
                  {formatNumeral(roadmap.taskCompletionPercentage)}%
                </span>
              </div>

              {/* Period Stats */}
              {(roadmap.actualMinutes > 0 || roadmap.plannedMinutes > 0) && (
                <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center space-x-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {t('actualTime')}: <strong>{formatDurationHoursMinutes(roadmap.actualMinutes)}</strong>
                    </span>
                  </span>
                  {roadmap.plannedMinutes > 0 && (
                    <span>
                      {t('plannedTime')}: <strong>{formatDurationHoursMinutes(roadmap.plannedMinutes)}</strong>
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
