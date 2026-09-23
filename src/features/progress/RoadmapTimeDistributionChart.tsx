import React from 'react';
import { PieChart, Clock, Compass, Target } from 'lucide-react';
import { RoadmapPeriodProgress } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { prepareRoadmapDistributionData } from './progressChartData';

export interface RoadmapTimeDistributionChartProps {
  readonly roadmaps: readonly RoadmapPeriodProgress[];
}

export const RoadmapTimeDistributionChart: React.FC<RoadmapTimeDistributionChartProps> = ({
  roadmaps,
}) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const chartData = prepareRoadmapDistributionData(roadmaps);

  if (chartData.isEmpty) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-2 mb-3">
          <PieChart className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('roadmapDistribution')}
          </h2>
        </div>
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
          <p>{t('noRoadmapActivity')}</p>
        </div>
      </div>
    );
  }

  const { items, totalActualMinutes } = chartData;

  // Color palette for horizontal bars (neutral, high contrast, clean)
  const barColors = [
    'bg-indigo-600 dark:bg-indigo-500',
    'bg-blue-600 dark:bg-blue-500',
    'bg-teal-600 dark:bg-teal-500',
    'bg-violet-600 dark:bg-violet-500',
    'bg-amber-600 dark:bg-amber-500',
    'bg-emerald-600 dark:bg-emerald-500',
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('roadmapDistribution')}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {formatDurationHoursMinutes(totalActualMinutes)} {t('actualTime').toLowerCase()} across{' '}
            {formatNumeral(items.length)} {t('roadmapsCount').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Horizontal Distribution Bars */}
      <div
        className="space-y-3.5"
        role="region"
        aria-label={t('roadmapDistribution')}
      >
        {items.map((item, idx) => {
          const colorClass = barColors[idx % barColors.length];

          return (
            <div key={item.roadmapId} className="space-y-1.5">
              {/* Roadmap Header & Numeric Summary */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <Compass className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {item.title}
                  </span>
                  {item.goalTitle && item.goalTitle !== 'General' && (
                    <span className="hidden md:inline-flex items-center text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      <Target className="w-2.5 h-2.5 mr-1 text-neutral-400" />
                      {item.goalTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <strong className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {formatDurationHoursMinutes(item.actualMinutes)}
                  </strong>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono w-10 text-right">
                    {formatNumeral(item.percentageOfTotalActual)}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                  style={{ width: `${Math.max(4, Math.min(100, item.percentageOfTotalActual))}%` }}
                  role="progressbar"
                  aria-valuenow={item.percentageOfTotalActual}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.title}: ${formatDurationHoursMinutes(item.actualMinutes)} (${formatNumeral(item.percentageOfTotalActual)}%)`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
