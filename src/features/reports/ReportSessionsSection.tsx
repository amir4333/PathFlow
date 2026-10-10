import React from 'react';
import { Clock } from 'lucide-react';
import { ReportSessionsSummary } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportSessionsSectionProps {
  readonly sessionsSummary: ReportSessionsSummary;
}

export const ReportSessionsSection: React.FC<ReportSessionsSectionProps> = ({ sessionsSummary }) => {
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <section className="mb-8">
      <div className="report-section-header flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2 gap-1">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          {t('sessionsSummary')}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 font-semibold tabular-nums">
          <span>{formatNumeral(sessionsSummary.totalSessionsCount)} {t('totalSessions')}</span>
          <span>•</span>
          <span>{formatDurationHoursMinutes(sessionsSummary.totalDurationMinutes)}</span>
          <span>•</span>
          <span>{formatNumeral(sessionsSummary.activeDaysCount)} {t('activeDays')}</span>
        </div>
      </div>

      {sessionsSummary.recentSessions.length === 0 ? (
        <div className="print-avoid-break p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
          {t('noSessionsInPeriod')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/75 dark:bg-neutral-800/75 border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 font-semibold">
                <th className="py-2.5 px-3 text-start">{t('date')} / {t('timeSpent')}</th>
                <th className="py-2.5 px-3 text-start">{t('task')}</th>
                <th className="py-2.5 px-3 text-start">{t('roadmap')}</th>
                <th className="py-2.5 px-3 text-end">{t('duration')}</th>
                <th className="py-2.5 px-3 text-start">{t('notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sessionsSummary.recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                  <td className="py-2.5 px-3 text-start tabular-nums text-neutral-700 dark:text-neutral-300">
                    {formatDate(session.startedAt, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-start font-semibold text-neutral-900 dark:text-neutral-100">
                    {session.taskTitle === 'Unknown Task' ? t('unknownTask') : session.taskTitle}
                  </td>
                  <td className="py-2.5 px-3 text-start text-neutral-600 dark:text-neutral-400">
                    {session.roadmapTitle ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-end tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHoursMinutes(session.durationMinutes)}
                  </td>
                  <td className="py-2.5 px-3 text-start text-neutral-500 max-w-xs truncate print:whitespace-normal print:overflow-visible print:max-w-none">
                    {session.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
