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
    <section id="report-overview-section" className="mb-8 print-avoid-break">
      <div className="report-section-header flex items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-400 pb-2">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 print:text-neutral-950 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 print:text-blue-700 shrink-0" />
          {t('executiveSummary')}
        </h2>
        <span className="report-overview-ratio text-[11px] text-neutral-600 dark:text-neutral-400 print:text-neutral-800 font-semibold tabular-nums">
          {formatNumeral(overview.timeCompletionPercentage)}% {t('ratioOfPlanned')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Metric 1: Goals & Roadmaps */}
        <div className="report-metric-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 print:bg-white print:border-neutral-400">
          <div className="report-metric-label flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 print:text-neutral-800 font-medium mb-1">
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span>{t('activeGoals')}</span>
          </div>
          <div className="report-metric-value text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100 print:text-neutral-950">
            {formatNumeral(overview.activeGoalsCount)}{' '}
            <span className="report-metric-subvalue text-xs font-normal text-neutral-600 dark:text-neutral-400 print:text-neutral-800">
              / {formatNumeral(overview.activeRoadmapsCount)} {t('roadmapsCount')}
            </span>
          </div>
        </div>

        {/* Metric 2: Task Progress */}
        <div className="report-metric-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 print:bg-white print:border-neutral-400">
          <div className="report-metric-label flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 print:text-neutral-800 font-medium mb-1">
            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
            <span>{t('tasksCompleted')}</span>
          </div>
          <div className="report-metric-value text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100 print:text-neutral-950">
            {formatNumeral(overview.tasksCompletedCount)}{' '}
            <span className="report-metric-subvalue text-xs font-normal text-neutral-600 dark:text-neutral-400 print:text-neutral-800">
              ({formatNumeral(overview.tasksWorkedOnCount)} {t('tasksWorkedOn')})
            </span>
          </div>
        </div>

        {/* Metric 3: Time Spent vs Planned */}
        <div className="report-metric-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 print:bg-white print:border-neutral-400">
          <div className="report-metric-label flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 print:text-neutral-800 font-medium mb-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{t('actualTime')} / {t('plannedTime')}</span>
          </div>
          <div className="report-metric-value text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100 print:text-neutral-950">
            {formatDurationHoursMinutes(overview.actualMinutes)}{' '}
            <span className="report-metric-subvalue text-xs font-normal text-neutral-600 dark:text-neutral-400 print:text-neutral-800">
              / {formatDurationHoursMinutes(overview.plannedMinutes)}
            </span>
          </div>
        </div>

        {/* Metric 4: Sessions & Commitments */}
        <div className="report-metric-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 print:bg-white print:border-neutral-400">
          <div className="report-metric-label flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 print:text-neutral-800 font-medium mb-1">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span>{t('totalSessions')}</span>
          </div>
          <div className="report-metric-value text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100 print:text-neutral-950">
            {formatNumeral(overview.sessionCount)}{' '}
            <span className="report-metric-subvalue text-xs font-normal text-neutral-600 dark:text-neutral-400 print:text-neutral-800">
              ({formatNumeral(overview.completedCommitmentsCount)} / {formatNumeral(overview.plannedCommitmentsCount)} {t('completedCommitments')})
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
