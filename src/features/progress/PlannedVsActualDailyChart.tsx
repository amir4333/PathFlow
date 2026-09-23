import React, { useState } from 'react';
import { BarChart3, Clock, CalendarClock, Table as TableIcon } from 'lucide-react';
import { DailyPeriodReview } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { getDayNameTranslationKey } from '../weekly-plans/weeklyPlanHelpers';
import { preparePlannedVsActualDailyData } from './progressChartData';

export interface PlannedVsActualDailyChartProps {
  readonly dailyBreakdown: readonly DailyPeriodReview[];
}

export const PlannedVsActualDailyChart: React.FC<PlannedVsActualDailyChartProps> = ({
  dailyBreakdown,
}) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } =
    useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [showDataTable, setShowDataTable] = useState(false);

  const chartData = preparePlannedVsActualDailyData(dailyBreakdown);

  if (chartData.isEmpty) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-2 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('dailyPlannedVsActual')}
          </h2>
        </div>
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
          <p>{t('noDailyActivity')}</p>
        </div>
      </div>
    );
  }

  const { items, maxMinutes } = chartData;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('dailyPlannedVsActual')}
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('plannedVsActual')}
          </p>
        </div>

        {/* Legend & Table Toggle */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 text-neutral-600 dark:text-neutral-300">
            <span className="w-3 h-3 rounded-xs bg-indigo-500 dark:bg-indigo-400 inline-block" />
            <span>{t('plannedTime')}</span>
          </div>

          <div className="flex items-center space-x-1.5 text-neutral-600 dark:text-neutral-300">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 dark:bg-emerald-400 inline-block" />
            <span>{t('actualTime')}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDataTable((prev) => !prev)}
            aria-label={t('viewDataTable')}
            className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 transition-colors ${
              showDataTable
                ? 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('viewDataTable')}</span>
          </button>
        </div>
      </div>

      {/* Accessible Bar Chart */}
      <div
        role="region"
        aria-label={t('dailyPlannedVsActual')}
        className="w-full overflow-x-auto pb-2"
      >
        <div className="min-w-[480px]">
          {/* Vertical Bar Grid */}
          <div className="grid grid-flow-col auto-cols-fr gap-3 items-end h-56 pt-6 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            {items.map((item, index) => {
              const dayNameKey = getDayNameTranslationKey(item.dayOfWeek);
              const localizedDayName = t(dayNameKey);
              const localizedDate = formatDate(item.date, {
                month: 'short',
                day: 'numeric',
              });

              const plannedHeightPercent = Math.min(100, Math.round((item.plannedMinutes / maxMinutes) * 100));
              const actualHeightPercent = Math.min(100, Math.round((item.actualMinutes / maxMinutes) * 100));
              const isHovered = activeTooltipIndex === index;

              return (
                <div
                  key={item.date}
                  className="flex flex-col items-center h-full justify-end relative group focus-within:z-10"
                  onMouseEnter={() => setActiveTooltipIndex(index)}
                  onMouseLeave={() => setActiveTooltipIndex(null)}
                >
                  {/* Tooltip Popup */}
                  {isHovered && (
                    <div
                      role="tooltip"
                      className="absolute bottom-full mb-2 z-20 px-3 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg text-xs shadow-lg pointer-events-none whitespace-nowrap space-y-1 transition-opacity"
                    >
                      <div className="font-semibold border-b border-neutral-700 dark:border-neutral-300 pb-1">
                        {localizedDayName} ({localizedDate})
                      </div>
                      <div className="flex items-center justify-between space-x-3">
                        <span className="text-neutral-300 dark:text-neutral-600">{t('plannedTime')}:</span>
                        <span className="font-medium">{formatDurationHoursMinutes(item.plannedMinutes)}</span>
                      </div>
                      <div className="flex items-center justify-between space-x-3">
                        <span className="text-neutral-300 dark:text-neutral-600">{t('actualTime')}:</span>
                        <span className="font-medium">{formatDurationHoursMinutes(item.actualMinutes)}</span>
                      </div>
                      <div className="flex items-center justify-between space-x-3 pt-1 border-t border-neutral-800 dark:border-neutral-200 text-[11px]">
                        <span className="text-neutral-400 dark:text-neutral-500">{t('difference')}:</span>
                        <span className="font-mono">
                          {item.varianceMinutes >= 0 ? '+' : ''}
                          {formatDurationHoursMinutes(item.varianceMinutes)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Paired Bars Container */}
                  <div className="w-full flex items-end justify-center space-x-1 sm:space-x-1.5 h-full px-1">
                    {/* Planned Bar */}
                    <div
                      className="w-1/2 max-w-[20px] bg-indigo-500/80 hover:bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 rounded-t-sm transition-all duration-200 relative"
                      style={{ height: `${Math.max(item.plannedMinutes > 0 ? 4 : 0, plannedHeightPercent)}%` }}
                      tabIndex={0}
                      aria-label={`${localizedDayName} ${t('plannedTime')}: ${formatDurationHoursMinutes(item.plannedMinutes)}`}
                    />

                    {/* Actual Bar */}
                    <div
                      className="w-1/2 max-w-[20px] bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-t-sm transition-all duration-200 relative"
                      style={{ height: `${Math.max(item.actualMinutes > 0 ? 4 : 0, actualHeightPercent)}%` }}
                      tabIndex={0}
                      aria-label={`${localizedDayName} ${t('actualTime')}: ${formatDurationHoursMinutes(item.actualMinutes)}`}
                    />
                  </div>

                  {/* Axis Label */}
                  <div className="text-center mt-2.5">
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[64px]">
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

      {/* Accessible Data Table (Toggleable) */}
      {showDataTable && (
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right text-neutral-600 dark:text-neutral-400">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 uppercase font-semibold">
              <tr>
                <th className="px-3 py-2 rounded-s-md">{t('dailyReview')}</th>
                <th className="px-3 py-2">{t('plannedTime')}</th>
                <th className="px-3 py-2">{t('actualTime')}</th>
                <th className="px-3 py-2 rounded-e-md">{t('difference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((item) => {
                const dayNameKey = getDayNameTranslationKey(item.dayOfWeek);
                const localizedDayName = t(dayNameKey);
                const localizedDate = formatDate(item.date, {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <tr key={item.date} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                      {localizedDayName}, {localizedDate}
                    </td>
                    <td className="px-3 py-2">{formatDurationHoursMinutes(item.plannedMinutes)}</td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatDurationHoursMinutes(item.actualMinutes)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {item.varianceMinutes >= 0 ? '+' : ''}
                      {formatDurationHoursMinutes(item.varianceMinutes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
