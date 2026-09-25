import React from 'react';
import { Target, MapPin, CheckSquare, Clock, CalendarClock, Activity } from 'lucide-react';
import { ReportOverview } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportOverviewSectionProps {
  readonly overview: ReportOverview;
}

export const ReportOverviewSection: React.FC<ReportOverviewSectionProps> = ({ overview }) => {
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t('executiveSummary')}
        </h2>
        <span className="text-[11px] text-neutral-500 font-mono">
          {overview.timeCompletionPercentage}% {t('ratioOfPlanned')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Metric 1: Goals & Roadmaps */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <Target className="w-3.5 h-3.5" />
            <span>{t('activeGoals')}</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(overview.activeGoalsCount)}{' '}
            <span className="text-xs font-normal text-neutral-500">
              / {formatNumeral(overview.activeRoadmapsCount)} {t('roadmapsCount')}
            </span>
          </div>
        </div>

        {/* Metric 2: Task Progress */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{t('tasksCompleted')}</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(overview.tasksCompletedCount)}{' '}
            <span className="text-xs font-normal text-neutral-500">
              ({formatNumeral(overview.tasksWorkedOnCount)} {t('tasksWorkedOn')})
            </span>
          </div>
        </div>

        {/* Metric 3: Time Spent vs Planned */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('actualTime')} / {t('plannedTime')}</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationHoursMinutes(overview.actualMinutes)}{' '}
            <span className="text-xs font-normal text-neutral-500">
              / {formatDurationHoursMinutes(overview.plannedMinutes)}
            </span>
          </div>
        </div>

        {/* Metric 4: Sessions & Commitments */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
          <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>{t('totalSessions')}</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {formatNumeral(overview.sessionCount)}{' '}
            <span className="text-xs font-normal text-neutral-500">
              ({formatNumeral(overview.completedCommitmentsCount)} / {formatNumeral(overview.plannedCommitmentsCount)} {t('completedCommitments')})
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
