import React from 'react';
import { Clock, CheckCircle2, ListTodo, CalendarClock, Compass } from 'lucide-react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ProgressSummaryCardsProps {
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly varianceMinutes: number;
  readonly completedTasksCount: number;
  readonly tasksWorkedOnCount: number;
  readonly plannedCommitmentsCount: number;
  readonly completedCommitmentsCount: number;
}

export const ProgressSummaryCards: React.FC<ProgressSummaryCardsProps> = ({
  plannedMinutes,
  actualMinutes,
  varianceMinutes,
  completedTasksCount,
  tasksWorkedOnCount,
  plannedCommitmentsCount,
  completedCommitmentsCount,
}) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  // Format variance neutrally
  const formattedVariance =
    varianceMinutes > 0
      ? `+${formatDurationHoursMinutes(varianceMinutes)}`
      : varianceMinutes < 0
      ? `-${formatDurationHoursMinutes(Math.abs(varianceMinutes))}`
      : formatDurationHoursMinutes(0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Planned Time */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('plannedTime')}</span>
          <CalendarClock className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationHoursMinutes(plannedMinutes)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('timeAllocated')}
          </div>
        </div>
      </div>

      {/* Actual Time */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('actualTime')}</span>
          <Clock className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationHoursMinutes(actualMinutes)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('timeSpent')}
          </div>
        </div>
      </div>

      {/* Difference / Variance (Neutral) */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('difference')}</span>
          <Compass className="w-4 h-4 text-neutral-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-800 dark:text-neutral-200">
            {formattedVariance}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('actualTime')} – {t('plannedTime')}
          </div>
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('tasksCompleted')}</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(completedTasksCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {tasksWorkedOnCount > 0
              ? `${formatNumeral(completedTasksCount)} / ${formatNumeral(tasksWorkedOnCount)} ${t('tasksWorkedOn').toLowerCase()}`
              : t('completed')}
          </div>
        </div>
      </div>

      {/* Tasks Worked On */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('tasksWorkedOn')}</span>
          <ListTodo className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(tasksWorkedOnCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('tasksCount')}
          </div>
        </div>
      </div>

      {/* Planned Commitments */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('plannedCommitments')}</span>
          <CalendarClock className="w-4 h-4 text-purple-500" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(completedCommitmentsCount)} / {formatNumeral(plannedCommitmentsCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {plannedCommitmentsCount > 0
              ? `${formatNumeral(Math.round((completedCommitmentsCount / plannedCommitmentsCount) * 100))}% ${t('completed').toLowerCase()}`
              : t('completedCommitments')}
          </div>
        </div>
      </div>
    </div>
  );
};
