import React, { useState } from 'react';
import { CheckCircle2, ListTodo, CheckSquare } from 'lucide-react';
import { DailyPeriodReview } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { getDayNameTranslationKey } from '../weekly-plans/weeklyPlanHelpers';
import { prepareTaskCompletionTrendData } from './progressChartData';

export interface TaskCompletionTrendChartProps {
  readonly dailyBreakdown: readonly DailyPeriodReview[];
}

export const TaskCompletionTrendChart: React.FC<TaskCompletionTrendChartProps> = ({
  dailyBreakdown,
}) => {
  const { preferences, formatDate, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);

  const chartData = prepareTaskCompletionTrendData(dailyBreakdown);

  if (chartData.isEmpty) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center space-x-2 mb-3">
          <CheckSquare className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('taskCompletionTrend')}
          </h2>
        </div>
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
          <p>{t('noDailyActivity')}</p>
        </div>
      </div>
    );
  }

  const { points, maxTasks, totalTasksWorkedOn, totalTasksCompleted } = chartData;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('taskCompletionTrend')}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {formatNumeral(totalTasksCompleted)} {t('completed').toLowerCase()} /{' '}
            {formatNumeral(totalTasksWorkedOn)} {t('tasksWorkedOn').toLowerCase()}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 text-neutral-600 dark:text-neutral-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>{t('tasksWorkedOn')}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-neutral-600 dark:text-neutral-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>{t('tasksCompleted')}</span>
          </div>
        </div>
      </div>

      {/* Bar Chart Grid */}
      <div className="w-full overflow-x-auto pb-2" role="region" aria-label={t('taskCompletionTrend')}>
        <div className="min-w-[420px]">
          <div className="grid grid-flow-col auto-cols-fr gap-2 items-end h-44 pt-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            {points.map((p, idx) => {
              const dayNameKey = getDayNameTranslationKey(p.dayOfWeek);
              const localizedDayName = t(dayNameKey);
              const localizedDate = formatDate(p.date, {
                month: 'short',
                day: 'numeric',
              });

              const workedHeightPercent = Math.min(100, Math.round((p.tasksWorkedOnCount / maxTasks) * 100));
              const completedHeightPercent = Math.min(100, Math.round((p.tasksCompletedCount / maxTasks) * 100));
              const isHovered = activeTooltipIndex === idx;

              return (
                <div
                  key={p.date}
                  className="flex flex-col items-center h-full justify-end relative group focus-within:z-10"
                  onMouseEnter={() => setActiveTooltipIndex(idx)}
                  onMouseLeave={() => setActiveTooltipIndex(null)}
                >
                  {/* Tooltip Popup */}
                  {isHovered && (
                    <div
                      role="tooltip"
                      className="absolute bottom-full mb-2 z-20 px-3 py-1.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg text-xs shadow-lg pointer-events-none whitespace-nowrap space-y-1"
                    >
                      <div className="font-semibold border-b border-neutral-700 dark:border-neutral-300 pb-0.5">
                        {localizedDayName} ({localizedDate})
                      </div>
                      <div className="flex items-center justify-between space-x-3">
                        <span className="text-neutral-300 dark:text-neutral-600">{t('tasksWorkedOn')}:</span>
                        <span className="font-medium">{formatNumeral(p.tasksWorkedOnCount)}</span>
                      </div>
                      <div className="flex items-center justify-between space-x-3">
                        <span className="text-neutral-300 dark:text-neutral-600">{t('tasksCompleted')}:</span>
                        <span className="font-medium">{formatNumeral(p.tasksCompletedCount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Bars Container */}
                  <div className="w-full flex items-end justify-center space-x-1 h-full px-1">
                    {/* Worked On Bar */}
                    <div
                      className="w-1/2 max-w-[16px] bg-blue-500/80 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400 rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${Math.max(p.tasksWorkedOnCount > 0 ? 6 : 0, workedHeightPercent)}%`,
                      }}
                      tabIndex={0}
                      aria-label={`${localizedDayName} ${t('tasksWorkedOn')}: ${formatNumeral(p.tasksWorkedOnCount)}`}
                    />

                    {/* Completed Bar */}
                    <div
                      className="w-1/2 max-w-[16px] bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${Math.max(p.tasksCompletedCount > 0 ? 6 : 0, completedHeightPercent)}%`,
                      }}
                      tabIndex={0}
                      aria-label={`${localizedDayName} ${t('tasksCompleted')}: ${formatNumeral(p.tasksCompletedCount)}`}
                    />
                  </div>

                  {/* Axis Label */}
                  <div className="text-center mt-2">
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[50px]">
                      {localizedDayName.slice(0, 3)}
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {localizedDate}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
