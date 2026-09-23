import React from 'react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface PlannedVsActualBarProps {
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
}

export const PlannedVsActualBar: React.FC<PlannedVsActualBarProps> = ({
  plannedMinutes,
  actualMinutes,
}) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  // Safe percentage of actual vs planned
  const percentage =
    plannedMinutes > 0 ? Math.round((actualMinutes / plannedMinutes) * 100) : 0;

  // Visual bar width cap at 100% for the primary fill
  const fillWidth = Math.min(100, percentage);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('plannedVsActual')}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {formatDurationHoursMinutes(actualMinutes)} {t('actualTime').toLowerCase()} vs{' '}
            {formatDurationHoursMinutes(plannedMinutes)} {t('plannedTime').toLowerCase()}
          </p>
        </div>

        {plannedMinutes > 0 && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <span>{formatNumeral(percentage)}%</span>
            <span className="ml-1 text-neutral-500 dark:text-neutral-400">
              {t('ratioOfPlanned')}
            </span>
          </div>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-3.5 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full"
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      {/* Comparison Legend */}
      <div className="flex items-center justify-between mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 inline-block" />
          <span>
            {t('actualTime')}: <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{formatDurationHoursMinutes(actualMinutes)}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700 inline-block" />
          <span>
            {t('plannedTime')}: <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{formatDurationHoursMinutes(plannedMinutes)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
