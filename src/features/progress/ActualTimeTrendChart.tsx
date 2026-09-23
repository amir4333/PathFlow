import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import { DailyPeriodReview } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { getDayNameTranslationKey } from '../weekly-plans/weeklyPlanHelpers';
import { prepareActualTimeTrendData } from './progressChartData';

export interface ActualTimeTrendChartProps {
  readonly dailyBreakdown: readonly DailyPeriodReview[];
}

export const ActualTimeTrendChart: React.FC<ActualTimeTrendChartProps> = ({
  dailyBreakdown,
}) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } =
    useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  const chartData = prepareActualTimeTrendData(dailyBreakdown);

  if (chartData.isEmpty) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center space-x-2 mb-3">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('actualTimeTrend')}
          </h2>
        </div>
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
          <p>{t('noDailyActivity')}</p>
        </div>
      </div>
    );
  }

  const { points, maxMinutes, totalActualMinutes, averageMinutesPerDay } = chartData;

  // SVG dimensions for scalable responsive line/area chart
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingLeft = 30;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;

  const usableWidth = svgWidth - paddingLeft - paddingRight;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const pointCount = points.length;
  const xStep = pointCount > 1 ? usableWidth / (pointCount - 1) : usableWidth / 2;

  // Calculate coordinates for each point
  const coords = points.map((p, idx) => {
    const x = pointCount === 1 ? svgWidth / 2 : paddingLeft + idx * xStep;
    const yRatio = p.actualMinutes / maxMinutes;
    const y = paddingTop + usableHeight * (1 - yRatio);
    return { x, y, point: p };
  });

  // Construct SVG line path (M x y L x y ...)
  const linePath = coords.reduce(
    (acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`,
    ''
  );

  // Construct SVG area path (closes along the bottom)
  const bottomY = paddingTop + usableHeight;
  const firstX = coords[0]?.x ?? paddingLeft;
  const lastX = coords[coords.length - 1]?.x ?? (paddingLeft + usableWidth);
  const areaPath = `${linePath} L ${lastX.toFixed(1)},${bottomY} L ${firstX.toFixed(1)},${bottomY} Z`;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('actualTimeTrend')}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {formatDurationHoursMinutes(totalActualMinutes)} {t('actualTime').toLowerCase()}
          </p>
        </div>

        {/* Average context badge */}
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>
            {formatDurationHoursMinutes(averageMinutesPerDay)} / day
          </span>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative w-full overflow-hidden" role="region" aria-label={t('actualTimeTrend')}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="actualTimeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background horizontal guide lines */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={svgWidth - paddingRight}
            y2={paddingTop}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-neutral-200 dark:text-neutral-800"
            strokeWidth="1"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + usableHeight / 2}
            x2={svgWidth - paddingRight}
            y2={paddingTop + usableHeight / 2}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-neutral-200 dark:text-neutral-800"
            strokeWidth="1"
          />
          <line
            x1={paddingLeft}
            y1={bottomY}
            x2={svgWidth - paddingRight}
            y2={bottomY}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
            strokeWidth="1"
          />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#actualTimeGradient)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {coords.map((c, idx) => {
            const isSelected = activePointIndex === idx;
            const dayNameKey = getDayNameTranslationKey(c.point.dayOfWeek);
            const localizedDayName = t(dayNameKey);

            return (
              <g key={c.point.date}>
                {/* Visual Circle */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 6 : 4}
                  className="fill-white dark:fill-neutral-900 stroke-emerald-500 transition-all duration-150 cursor-pointer"
                  strokeWidth={isSelected ? 3 : 2}
                  tabIndex={0}
                  aria-label={`${localizedDayName}: ${formatDurationHoursMinutes(c.point.actualMinutes)}`}
                  onMouseEnter={() => setActivePointIndex(idx)}
                  onMouseLeave={() => setActivePointIndex(null)}
                  onFocus={() => setActivePointIndex(idx)}
                  onBlur={() => setActivePointIndex(null)}
                />

                {/* X-Axis Day Label */}
                <text
                  x={c.x}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  className="text-[11px] fill-neutral-500 dark:fill-neutral-400 font-medium"
                >
                  {localizedDayName.slice(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip Box */}
        {activePointIndex !== null && coords[activePointIndex] && (
          <div
            className="absolute z-10 px-3 py-1.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg text-xs shadow-lg pointer-events-none transform -translate-x-1/2"
            style={{
              left: `${(coords[activePointIndex].x / svgWidth) * 100}%`,
              top: '0px',
            }}
          >
            <div className="font-semibold">
              {t(getDayNameTranslationKey(coords[activePointIndex].point.dayOfWeek))},{' '}
              {formatDate(coords[activePointIndex].point.date, { month: 'short', day: 'numeric' })}
            </div>
            <div className="flex items-center space-x-2 mt-0.5 text-neutral-300 dark:text-neutral-600">
              <span>{t('actualTime')}:</span>
              <span className="font-bold text-white dark:text-neutral-900">
                {formatDurationHoursMinutes(coords[activePointIndex].point.actualMinutes)}
              </span>
            </div>
            {coords[activePointIndex].point.sessionCount > 0 && (
              <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {formatNumeral(coords[activePointIndex].point.sessionCount)} {t('sessionsCount')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
