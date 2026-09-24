import React from 'react';
import { Calendar, CheckCircle2, Clock, CalendarClock, Compass, Layers } from 'lucide-react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface WeeklyPlanItemPreview {
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle?: string;
  readonly plannedMinutes: number;
  readonly targetDate?: string;
  readonly isCompleted: boolean;
}

export interface TeacherWeeklyPlanSectionProps {
  readonly plannedCommitmentsCount: number;
  readonly completedCommitmentsCount: number;
  readonly totalPlannedMinutes: number;
  readonly datedCommitmentsCount?: number;
  readonly flexibleCommitmentsCount?: number;
  readonly activeDaysCount: number;
  readonly weeklyPlanItems?: readonly WeeklyPlanItemPreview[];
}

export const TeacherWeeklyPlanSection: React.FC<TeacherWeeklyPlanSectionProps> = ({
  plannedCommitmentsCount,
  completedCommitmentsCount,
  totalPlannedMinutes,
  datedCommitmentsCount,
  flexibleCommitmentsCount,
  activeDaysCount,
  weeklyPlanItems = [],
}) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('weeklyPlanningSummary')}
          </h2>
        </div>
      </div>

      {/* Factual Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        {/* Planned Commitments */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
          <div className="text-neutral-500 dark:text-neutral-400 font-medium">{t('plannedCommitments')}</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatNumeral(plannedCommitmentsCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('completedCommitments')}: {formatNumeral(completedCommitmentsCount)}
          </div>
        </div>

        {/* Total Planned Time */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
          <div className="text-neutral-500 dark:text-neutral-400 font-medium">{t('totalPlannedTime')}</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatDurationHoursMinutes(totalPlannedMinutes)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('timeAllocated')}
          </div>
        </div>

        {/* Dated Commitments */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
          <div className="text-neutral-500 dark:text-neutral-400 font-medium">{t('datedCommitments')}</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatNumeral(datedCommitmentsCount ?? 0)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('datedTime')}
          </div>
        </div>

        {/* Flexible Commitments */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800">
          <div className="text-neutral-500 dark:text-neutral-400 font-medium">{t('flexibleCommitmentsCount')}</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatNumeral(flexibleCommitmentsCount ?? 0)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('flexibleTime')}
          </div>
        </div>

        {/* Active Days */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800 col-span-2 sm:col-span-1">
          <div className="text-neutral-500 dark:text-neutral-400 font-medium">{t('activeDaysCount')}</div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatNumeral(activeDaysCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('activeDays')}
          </div>
        </div>
      </div>

      {/* Commitments Table (if items present) */}
      {weeklyPlanItems.length > 0 ? (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold select-none">
              <tr>
                <th className="py-2.5 px-4">{t('plannedItems')}</th>
                <th className="py-2.5 px-4">{t('targetDate')}</th>
                <th className="py-2.5 px-4 text-right">{t('plannedMinutes')}</th>
                <th className="py-2.5 px-4 text-right">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {weeklyPlanItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition"
                >
                  <td className="py-2.5 px-4 font-medium text-neutral-900 dark:text-neutral-100">
                    {item.taskTitle ?? `${t('unknownTask')} (${item.taskId.slice(0, 8)})`}
                  </td>
                  <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-400">
                    {item.targetDate ? (
                      formatDate(item.targetDate, { month: 'short', day: 'numeric', weekday: 'short' })
                    ) : (
                      <span className="italic text-neutral-400">{t('flexibleWeekly')}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-neutral-800 dark:text-neutral-200">
                    {formatDurationHoursMinutes(item.plannedMinutes)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {item.isCompleted ? t('completed') : t('inProgress')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : plannedCommitmentsCount === 0 ? (
        <div className="text-center py-6 text-xs text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          {t('noPlansInPeriod')}
        </div>
      ) : null}
    </div>
  );
};
