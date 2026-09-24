import React from 'react';
import { Target, MapPin, CheckSquare, Clock, CalendarClock, Activity, CheckCircle2 } from 'lucide-react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TeacherSummaryCardsProps {
  readonly activeGoalsCount: number;
  readonly activeRoadmapsCount: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly plannedCommitmentsCount: number;
  readonly completedCommitmentsCount: number;
}

export const TeacherSummaryCards: React.FC<TeacherSummaryCardsProps> = ({
  activeGoalsCount,
  activeRoadmapsCount,
  tasksWorkedOnCount,
  tasksCompletedCount,
  plannedMinutes,
  actualMinutes,
  sessionCount,
  plannedCommitmentsCount,
  completedCommitmentsCount,
}) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
      {/* 1. Active Goals */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('activeGoals')}</span>
          <Target className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(activeGoalsCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('roadmapsCount')}: {formatNumeral(activeRoadmapsCount)}
          </div>
        </div>
      </div>

      {/* 2. Tasks Worked On & Completed */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('tasksWorkedOn')}</span>
          <CheckSquare className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(tasksWorkedOnCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('tasksCompleted')}: {formatNumeral(tasksCompletedCount)}
          </div>
        </div>
      </div>

      {/* 3. Planned vs Actual Time */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('actualTime')}</span>
          <Clock className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationHoursMinutes(actualMinutes)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('plannedTime')}: {formatDurationHoursMinutes(plannedMinutes)}
          </div>
        </div>
      </div>

      {/* 4. Sessions Count & Commitments */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
          <span className="text-xs font-medium">{t('sessionsCount')}</span>
          <Activity className="w-4 h-4 text-purple-500" />
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(sessionCount)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('completedCommitments')}: {formatNumeral(completedCommitmentsCount)} / {formatNumeral(plannedCommitmentsCount)}
          </div>
        </div>
      </div>
    </div>
  );
};
