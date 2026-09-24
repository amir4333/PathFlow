import React from 'react';
import { Clock, CheckSquare, Layers, FileText, Calendar } from 'lucide-react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TeacherSessionItem {
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle?: string;
  readonly roadmapTitle?: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMinutes: number;
  readonly notes?: string;
}

export interface TeacherRecentSessionsSectionProps {
  readonly sessions: readonly TeacherSessionItem[];
}

export const TeacherRecentSessionsSection: React.FC<TeacherRecentSessionsSectionProps> = ({ sessions }) => {
  const { preferences, formatDate, formatTime, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('recentWorkRecorded')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(sessions.length)} {t('sessionsCount')}
          </span>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          {t('noSessionsInPeriod')}
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="p-3.5 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition text-xs"
            >
              {/* Task, Roadmap & Notes */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                    {session.taskTitle ?? `Task #${session.taskId.slice(0, 8)}`}
                  </span>
                  {session.roadmapTitle && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                      <Layers className="w-2.5 h-2.5 mr-1 text-neutral-400" />
                      {session.roadmapTitle}
                    </span>
                  )}
                </div>

                {/* Notes if recorded */}
                {session.notes && session.notes.trim() !== '' && (
                  <div className="flex items-start space-x-1.5 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60 p-2 rounded-md text-[11px] max-w-xl">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span className="break-words">{session.notes}</span>
                  </div>
                )}
              </div>

              {/* Date, Time & Duration */}
              <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center text-right">
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">
                    {formatDate(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div>
                    {formatTime(session.startedAt)} – {formatTime(session.endedAt)}
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-semibold text-xs border border-emerald-200/60 dark:border-emerald-900/60">
                  {formatDurationHoursMinutes(session.durationMinutes)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
