import React, { useState, useEffect, useMemo } from 'react';
import { Task, Roadmap, Session } from '../../domain';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useActiveSession } from './ActiveSessionContext';
import {
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export interface ManualSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (session: Session) => void;
  preselectedTaskId?: string;
}

/**
 * Formats a Date object into 'YYYY-MM-DDTHH:mm' local string for datetime-local input
 */
function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export const ManualSessionModal: React.FC<ManualSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
  preselectedTaskId,
}) => {
  const application = useApplication();
  const { activeSession, activeTask } = useActiveSession();

  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [roadmapsMap, setRoadmapsMap] = useState<Record<string, Roadmap>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [startTimeLocal, setStartTimeLocal] = useState<string>('');
  const [endTimeLocal, setEndTimeLocal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Load available tasks and roadmaps
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      try {
        setIsLoadingData(true);
        const [tasks, roadmaps] = await Promise.all([
          application.tasks.listTasks(),
          application.roadmaps.listRoadmaps(),
        ]);

        if (isMounted) {
          const rMap: Record<string, Roadmap> = {};
          roadmaps.forEach((r) => {
            rMap[r.id] = r;
          });
          setRoadmapsMap(rMap);

          // Sort: in_progress first, then todo, then completed, then alphabetically
          const sorted = [...tasks].sort((a, b) => {
            if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
            if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
            if (a.status === 'todo' && b.status !== 'todo') return -1;
            if (b.status === 'todo' && a.status !== 'todo') return 1;
            return a.title.localeCompare(b.title);
          });
          setAvailableTasks(sorted);

          // Set initial task selection
          if (preselectedTaskId && sorted.some((t) => t.id === preselectedTaskId)) {
            setSelectedTaskId(preselectedTaskId);
          } else if (sorted.length > 0) {
            setSelectedTaskId(sorted[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load tasks for manual session entry', err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }

    // Default times: ended just now, started 60 minutes ago
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setStartTimeLocal(toLocalDatetimeInputValue(oneHourAgo));
    setEndTimeLocal(toLocalDatetimeInputValue(now));
    setError(null);

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, application, preselectedTaskId]);

  // Derived duration calculation
  const derivedDuration = useMemo<{
    minutes: number;
    formatted: string;
    isValid: boolean;
    errorReason?: string;
  }>(() => {
    if (!startTimeLocal || !endTimeLocal) {
      return { minutes: 0, formatted: '--', isValid: false };
    }

    const startMs = new Date(startTimeLocal).getTime();
    const endMs = new Date(endTimeLocal).getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      return { minutes: 0, formatted: '--', isValid: false, errorReason: 'Invalid date/time' };
    }

    if (endMs <= startMs) {
      return {
        minutes: 0,
        formatted: '0 min',
        isValid: false,
        errorReason: 'End time must be after start time',
      };
    }

    const nowMs = Date.now();
    if (startMs > nowMs + 60000) {
      return {
        minutes: 0,
        formatted: '0 min',
        isValid: false,
        errorReason: 'Session cannot start in the future',
      };
    }

    const totalMinutes = Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));
    if (totalMinutes === 0) {
      return {
        minutes: 0,
        formatted: '0 min',
        isValid: false,
        errorReason: 'Duration must be at least 1 minute',
      };
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    let formatted = `${totalMinutes} min`;
    if (hours > 0) {
      formatted += ` (${hours}h ${remainingMins}m)`;
    }

    return { minutes: totalMinutes, formatted, isValid: true };
  }, [startTimeLocal, endTimeLocal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeSession) {
      setError(
        `Cannot record manual session: a live active timer is currently in progress for Task "${activeTask?.title || activeSession.taskId}". Please complete or discard the active timer first.`
      );
      return;
    }

    if (!selectedTaskId) {
      setError('Please select a task.');
      return;
    }

    if (!derivedDuration.isValid) {
      setError(derivedDuration.errorReason || 'Please enter valid start and end times.');
      return;
    }

    try {
      setIsSubmitting(true);
      const startISO = new Date(startTimeLocal).toISOString();
      const endISO = new Date(endTimeLocal).toISOString();

      const created = await application.sessions.createManualSession({
        taskId: selectedTaskId,
        startedAt: startISO,
        endedAt: endISO,
      });

      onSessionCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record manual session.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="manual-session-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="manual-session-modal"
        className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Record Completed Session
              </h2>
              <p className="text-xs text-neutral-500">
                Log a past work block executed offline without the active timer.
              </p>
            </div>
          </div>
          <button
            id="btn-close-manual-session-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Active Session Warning Banner */}
          {activeSession && (
            <div
              id="manual-session-active-conflict-warning"
              className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Live Timer in Progress</span>
                <span>
                  An active session is currently running for{' '}
                  <strong className="font-medium text-amber-900 dark:text-amber-200">
                    {activeTask?.title || activeSession.taskId}
                  </strong>
                  . To prevent state collisions, please stop or discard the running timer before logging a manual session.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              id="manual-session-form-error"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Selector */}
          <div>
            <label
              htmlFor="manual-session-task-select"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
            >
              Target Task <span className="text-rose-500">*</span>
            </label>
            {isLoadingData ? (
              <div className="text-xs text-neutral-400 py-2">Loading tasks...</div>
            ) : availableTasks.length === 0 ? (
              <div className="text-xs text-neutral-500 py-2 italic">
                No tasks available. Create a task in Roadmaps or Tasks first.
              </div>
            ) : (
              <select
                id="manual-session-task-select"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {availableTasks.map((task) => {
                  const roadmap = roadmapsMap[task.roadmapId];
                  return (
                    <option key={task.id} value={task.id}>
                      {task.title}
                      {roadmap ? ` (${roadmap.title})` : ''}
                      {task.status === 'completed' ? ' [Completed]' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Date & Time Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="manual-session-start-time"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-session-start-time"
                type="datetime-local"
                value={startTimeLocal}
                onChange={(e) => setStartTimeLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="manual-session-end-time"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="manual-session-end-time"
                type="datetime-local"
                value={endTimeLocal}
                onChange={(e) => setEndTimeLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Derived Duration Calculation Box */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                Derived Duration:
              </span>
            </div>
            <div>
              {derivedDuration.isValid ? (
                <span
                  id="manual-session-derived-duration"
                  className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400"
                >
                  {derivedDuration.formatted}
                </span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {derivedDuration.errorReason || 'Enter valid time range'}
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              id="btn-cancel-manual-session"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-manual-session"
              disabled={
                isSubmitting ||
                !selectedTaskId ||
                !derivedDuration.isValid ||
                Boolean(activeSession)
              }
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Record Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
