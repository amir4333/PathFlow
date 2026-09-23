import React, { useState, useEffect, useCallback } from 'react';
import { Session, Task } from '../../domain';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { ActiveSessionTimer } from './ActiveSessionTimer';
import {
  Clock,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Filter,
  BarChart2,
} from 'lucide-react';

export const SessionsView: React.FC = () => {
  const application = useApplication();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, Task>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allSessions, allTasks] = await Promise.all([
        application.sessions.getAllSessions(),
        application.tasks.listTasks(),
      ]);

      // Create lookup map for fast task title resolution
      const map: Record<string, Task> = {};
      allTasks.forEach((t) => {
        map[t.id] = t;
      });
      setTasksMap(map);

      // Sort sessions descending (most recent first)
      const sorted = [...allSessions].sort((a, b) => {
        return Date.parse(b.startedAt) - Date.parse(a.startedAt);
      });
      setSessions(sorted);
    } catch (err) {
      console.error('Failed to load sessions data', err);
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalMinutesLogged = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const formatSessionDate = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSessionTime = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div id="sessions-view" className="max-w-5xl mx-auto space-y-8">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Phase 9A: Time Engine
            </span>
            <span className="text-xs text-neutral-500">Live Execution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Work Sessions & Time Tracking
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
            Execute focused blocks of deep work against actionable tasks. The timer counts upward offline and persists immutable historical sessions.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs text-left">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              Total Recorded
            </span>
            <div className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {totalMinutesLogged}m{' '}
              <span className="text-xs font-normal text-neutral-500">
                ({sessions.length} session{sessions.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Session / Timer Component */}
      <section aria-labelledby="active-session-heading">
        <h2 id="active-session-heading" className="sr-only">
          Active Session Timer
        </h2>
        <ActiveSessionTimer onSessionCompleted={loadData} />
      </section>

      {/* Historical Completed Sessions */}
      <section className="space-y-4" aria-labelledby="session-history-heading">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <h2 id="session-history-heading" className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Session History & Activity Log
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-500">
            {sessions.length} logged
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-400 animate-pulse">
            Loading session history...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 space-y-2">
            <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              No completed sessions recorded yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Start an active session using the timer above. When you stop the timer, your session will be saved here immutably.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs">
            {sessions.map((session) => {
              const task = tasksMap[session.taskId];
              const dateFormatted = formatSessionDate(session.startedAt);
              const startTime = formatSessionTime(session.startedAt);
              const endTime = formatSessionTime(session.endedAt);

              return (
                <div
                  key={session.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                        {task ? task.title : `Task #${session.taskId.slice(0, 8)}`}
                      </span>
                      {task?.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dateFormatted}
                      </span>
                      <span>•</span>
                      <span>
                        {startTime} – {endTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-start sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
                        {session.durationMinutes}m
                      </span>
                      <span className="text-[10px] text-neutral-400 block font-mono">
                        duration
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
