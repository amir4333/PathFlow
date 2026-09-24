import React from 'react';
import { Activity, Clock, CheckCircle2, Calendar, FileText } from 'lucide-react';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TimelineEventItem {
  readonly id: string;
  readonly type: 'session_recorded' | 'task_completed' | 'commitment_completed';
  readonly timestamp: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly badge?: string;
  readonly durationMinutes?: number;
  readonly notes?: string;
}

export interface TeacherTimelineSectionProps {
  readonly events: readonly TimelineEventItem[];
  readonly title?: string;
}

export const TeacherTimelineSection: React.FC<TeacherTimelineSectionProps> = ({
  events,
  title,
}) => {
  const { preferences, formatDate, formatTime, formatDurationHoursMinutes, formatNumeral } =
    useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const sectionTitle = title ?? t('activityTimeline');

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {sectionTitle}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(events.length)}
          </span>
        </div>
      </div>

      {/* Timeline List */}
      {events.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          {t('noTimelineEvents')}
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
          {events.map((event) => {
            const isSession = event.type === 'session_recorded';
            const isTask = event.type === 'task_completed';
            const isCommitment = event.type === 'commitment_completed';

            return (
              <div key={event.id} className="relative group text-xs">
                {/* Timeline Node Dot */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white dark:bg-neutral-900 ${
                    isSession
                      ? 'border-emerald-500 text-emerald-500'
                      : isTask
                      ? 'border-blue-500 text-blue-500'
                      : 'border-purple-500 text-purple-500'
                  }`}
                >
                  {isSession && <Clock className="w-2.5 h-2.5" />}
                  {isTask && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {isCommitment && <Calendar className="w-2.5 h-2.5" />}
                </div>

                {/* Event Content Box */}
                <div className="bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800 rounded-lg p-3 space-y-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {event.title}
                      </span>
                      {event.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium">
                          {event.badge}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0 font-mono">
                      {formatDate(event.timestamp, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                      {event.timestamp.includes('T') && !event.timestamp.endsWith('00:00:00.000Z') && (
                        <span>• {formatTime(event.timestamp)}</span>
                      )}
                    </div>
                  </div>

                  {event.subtitle && (
                    <div className="text-neutral-600 dark:text-neutral-400 text-[11px]">
                      {event.subtitle}
                    </div>
                  )}

                  {event.durationMinutes !== undefined && event.durationMinutes > 0 && (
                    <div className="pt-1 flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium font-mono text-[11px]">
                      <Clock className="w-3 h-3 mr-0.5" />
                      <span>{formatDurationHoursMinutes(event.durationMinutes)}</span>
                    </div>
                  )}

                  {event.notes && event.notes.trim() !== '' && (
                    <div className="mt-1 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500 dark:text-neutral-400 flex items-start space-x-1 text-[11px]">
                      <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="italic">{event.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
