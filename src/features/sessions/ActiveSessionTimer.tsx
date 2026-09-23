import React, { useState, useEffect } from 'react';
import { Task, Session } from '../../domain';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { useActiveSession } from './ActiveSessionContext';
import { useUserPreferences } from '../../app/preferences';
import {
  Play,
  Square,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
} from 'lucide-react';

export interface ActiveSessionTimerProps {
  onSessionCompleted?: (session: Session) => void;
  initialTaskId?: string;
  compact?: boolean;
}

export const ActiveSessionTimer: React.FC<ActiveSessionTimerProps> = ({
  onSessionCompleted,
  initialTaskId,
  compact = false,
}) => {
  const application = useApplication();
  const { navigate } = useRouter();
  const { formatTime, formatDate } = useUserPreferences();
  const {
    activeSession,
    activeTask,
    formattedTime,
    startSession,
    completeSession,
    discardSession,
    error: sessionError,
    clearError,
  } = useActiveSession();

  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState<boolean>(false);

  // Load available tasks for the selector when timer is not active
  useEffect(() => {
    let isMounted = true;
    async function loadTasks() {
      try {
        const tasks = await application.tasks.listTasks();
        if (isMounted) {
          // Sort: in_progress first, then todo, then others
          const sorted = [...tasks].sort((a, b) => {
            if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
            if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
            return a.title.localeCompare(b.title);
          });
          setAvailableTasks(sorted);
          if (!selectedTaskId && sorted.length > 0) {
            setSelectedTaskId(sorted[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load tasks for session timer', err);
      }
    }

    if (!activeSession) {
      loadTasks();
    }

    return () => {
      isMounted = false;
    };
  }, [application, activeSession, selectedTaskId]);

  const handleStart = async () => {
    if (!selectedTaskId) {
      return;
    }
    clearError();
    setActionMessage(null);
    setIsSubmitting(true);
    try {
      await startSession(selectedTaskId);
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    clearError();
    setActionMessage(null);
    setIsSubmitting(true);
    try {
      const completed = await completeSession();
      const mins = completed.durationMinutes;
      setActionMessage(`Session completed! Recorded ${mins} minute${mins === 1 ? '' : 's'}.`);
      if (onSessionCompleted) {
        onSessionCompleted(completed);
      }
    } catch (err) {
      console.error('Failed to complete session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    clearError();
    setActionMessage(null);
    setIsSubmitting(true);
    try {
      await discardSession();
      setIsDiscardConfirmOpen(false);
      setActionMessage('Active session was discarded.');
    } catch (err) {
      console.error('Failed to discard session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If compact mode is requested (e.g. for widgets or cards)
  if (compact) {
    if (activeSession) {
      return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                {activeTask?.title || 'Active Session'}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                {formattedTime}
              </span>
            </div>
          </div>
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shrink-0"
          >
            Complete
          </button>
        </div>
      );
    }
    return null;
  }

  // Active Session Running UI
  if (activeSession) {
    const timeFormatted = formatTime(activeSession.startedAt);
    const dateFormatted = formatDate(activeSession.startedAt, { month: 'short', day: 'numeric' });

    return (
      <div
        id="active-session-timer-running"
        className="p-6 sm:p-8 rounded-xl bg-white dark:bg-neutral-900 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm relative overflow-hidden"
      >
        {/* Glowing top line indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Active Task Info & Running Badge */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Focus Session
              </span>
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Started: {dateFormatted} • {timeFormatted}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {activeTask ? activeTask.title : 'Loading task details...'}
              </h3>
              {activeTask && (
                <button
                  onClick={() => navigate('tasks', { id: activeTask.id })}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 inline-flex items-center gap-1 cursor-pointer transition"
                  title="View Task Details"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTask?.description && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1">
                {activeTask.description}
              </p>
            )}
          </div>

          {/* Large Digital Clock & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 self-start md:self-center">
            <div className="text-left sm:text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Elapsed Focus Time
              </div>
              <div
                id="active-timer-display"
                className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                {formattedTime}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-complete-session"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm flex items-center gap-2 shadow-xs cursor-pointer transition disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{isSubmitting ? 'Stopping...' : 'Stop & Save'}</span>
              </button>

              {!isDiscardConfirmOpen ? (
                <button
                  id="btn-discard-session-confirm"
                  onClick={() => setIsDiscardConfirmOpen(true)}
                  disabled={isSubmitting}
                  className="p-2.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
                  title="Discard session without saving"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-lg border border-rose-200 dark:border-rose-900">
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 px-1">
                    Discard?
                  </span>
                  <button
                    onClick={handleDiscard}
                    disabled={isSubmitting}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setIsDiscardConfirmOpen(false)}
                    className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs rounded cursor-pointer"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {sessionError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{sessionError}</span>
          </div>
        )}
      </div>
    );
  }

  // No Active Session - Ready to Start UI
  return (
    <div
      id="active-session-timer-idle"
      className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <span>Start Work Session</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Select an actionable task from your roadmaps to start deep work tracking.
          </p>
        </div>
        <div className="text-xs text-neutral-400 font-mono">
          Timer counts upward offline
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {sessionError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{sessionError}</span>
          </div>
          <button
            onClick={clearError}
            className="text-xs text-rose-700 dark:text-rose-300 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {availableTasks.length === 0 ? (
        <div className="p-6 text-center rounded-lg bg-neutral-50 dark:bg-neutral-950/50 border border-dashed border-neutral-200 dark:border-neutral-800 space-y-2">
          <CheckSquare className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            No actionable tasks available
          </p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Create tasks under your milestone roadmaps first to start timing focused work sessions.
          </p>
          <button
            onClick={() => navigate('tasks')}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium cursor-pointer"
          >
            Go to Tasks
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="session-task-select"
              className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between"
            >
              <span>Target Task</span>
              <span className="text-[11px] text-neutral-400">
                {availableTasks.length} available
              </span>
            </label>
            <select
              id="session-task-select"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
            >
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.status === 'in_progress' ? ' [In Progress]' : ''} ({t.estimatedMinutes}m est)
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-start-session"
            onClick={handleStart}
            disabled={!selectedTaskId || isSubmitting}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 h-[38px] shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isSubmitting ? 'Starting...' : 'Start Session'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
