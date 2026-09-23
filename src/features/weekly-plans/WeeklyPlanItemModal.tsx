/**
 * Weekly Plan Item Modal
 *
 * Minimal, accessible modal for creating and editing weekly plan items:
 * - Real task selection with Roadmap -> Task hierarchy
 * - Target date within selected week (or flexible weekly commitment)
 * - Planned minutes with quick preset helpers
 * - Form validation surfacing domain rule errors
 */

import React, { useState, useEffect } from 'react';
import { Task, Roadmap, WeeklyPlanItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { getDaysInWeek, WeekDayOption } from './weeklyPlanHelpers';
import { X, Calendar, Clock, AlertCircle, Plus, Check } from 'lucide-react';

interface WeeklyPlanItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'duplicate';
  weekIdentifier: string;
  roadmaps: readonly Roadmap[];
  tasks: readonly Task[];
  initialItem?: WeeklyPlanItem | null;
  defaultTargetDate?: string;
  onSubmit: (data: {
    taskId: string;
    plannedMinutes: number;
    targetDate?: string;
  }) => Promise<void>;
}

export const WeeklyPlanItemModal: React.FC<WeeklyPlanItemModalProps> = ({
  isOpen,
  onClose,
  mode,
  weekIdentifier,
  roadmaps,
  tasks,
  initialItem,
  defaultTargetDate,
  onSubmit,
}) => {
  const { formatDate, formatNumeral, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  const [taskId, setTaskId] = useState<string>('');
  const [plannedMinutes, setPlannedMinutes] = useState<number>(60);
  const [targetDate, setTargetDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const weekDays: WeekDayOption[] = React.useMemo(() => {
    return getDaysInWeek(weekIdentifier);
  }, [weekIdentifier]);

  // Roadmap lookup map
  const roadmapsMap = React.useMemo(() => {
    const map = new Map<string, Roadmap>();
    roadmaps.forEach((r) => map.set(r.id, r));
    return map;
  }, [roadmaps]);

  // Tasks grouped by roadmap
  const groupedTasks = React.useMemo(() => {
    const groups: { roadmapTitle: string; tasks: Task[] }[] = [];
    const usedTaskIds = new Set<string>();

    roadmaps.forEach((roadmap) => {
      const roadmapTasks = tasks.filter((t) => t.roadmapId === roadmap.id);
      if (roadmapTasks.length > 0) {
        groups.push({
          roadmapTitle: roadmap.title,
          tasks: roadmapTasks,
        });
        roadmapTasks.forEach((t) => usedTaskIds.add(t.id));
      }
    });

    const otherTasks = tasks.filter((t) => !usedTaskIds.has(t.id));
    if (otherTasks.length > 0) {
      groups.push({
        roadmapTitle: t('generalRoadmap'),
        tasks: otherTasks,
      });
    }

    return groups;
  }, [roadmaps, tasks, preferences.language]);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsSubmitting(false);

    if (mode === 'edit' && initialItem) {
      setTaskId(initialItem.taskId);
      setPlannedMinutes(initialItem.plannedMinutes);
      setTargetDate(initialItem.targetDate || '');
    } else if (mode === 'duplicate' && initialItem) {
      setTaskId(initialItem.taskId);
      setPlannedMinutes(initialItem.plannedMinutes);
      setTargetDate(defaultTargetDate !== undefined ? defaultTargetDate : (initialItem.targetDate || ''));
    } else {
      // Find first active task if available
      const firstActiveTask = tasks.find((t) => t.status !== 'completed' && t.status !== 'cancelled') || tasks[0];
      const initialTaskId = firstActiveTask ? firstActiveTask.id : '';
      setTaskId(initialTaskId);

      const defaultMinutes =
        firstActiveTask && firstActiveTask.estimatedMinutes > 0
          ? firstActiveTask.estimatedMinutes
          : 60;
      setPlannedMinutes(defaultMinutes);
      setTargetDate(defaultTargetDate || '');
    }
  }, [isOpen, mode, initialItem, defaultTargetDate, tasks]);

  if (!isOpen) return null;

  // Handle task selection change
  const handleTaskChange = (newTaskId: string) => {
    setTaskId(newTaskId);
    setErrorMessage(null);
    const selected = tasks.find((t) => t.id === newTaskId);
    if (selected && selected.estimatedMinutes > 0 && mode === 'create') {
      setPlannedMinutes(selected.estimatedMinutes);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!taskId) {
      setErrorMessage(t('selectTask'));
      return;
    }

    if (plannedMinutes < 0 || isNaN(plannedMinutes)) {
      setErrorMessage('Planned minutes must be a non-negative number.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        taskId,
        plannedMinutes: Math.round(plannedMinutes),
        targetDate: targetDate.trim() ? targetDate.trim() : undefined,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save weekly plan item', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save weekly plan item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTaskObj = tasks.find((t) => t.id === taskId);
  const selectedRoadmapObj = selectedTaskObj
    ? roadmapsMap.get(selectedTaskObj.roadmapId)
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-item-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-900 dark:text-neutral-100 transition-all my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="weekly-item-modal-title"
                className="text-base font-bold text-neutral-900 dark:text-neutral-100"
              >
                {mode === 'edit'
                  ? t('editPlannedItem')
                  : mode === 'duplicate'
                  ? t('duplicateItem')
                  : t('addToThisWeek')}
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                {weekIdentifier}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Task Selector */}
          <div>
            <label
              htmlFor="plan-item-task-select"
              className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              {t('selectTask')}
            </label>

            {mode === 'edit' ? (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedTaskObj?.title ?? t('unknownTask')}
                </div>
                {selectedRoadmapObj && (
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {selectedRoadmapObj.title}
                  </div>
                )}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                No tasks available. Please create a task first in the Tasks view.
              </div>
            ) : (
              <select
                id="plan-item-task-select"
                value={taskId}
                onChange={(e) => handleTaskChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                required
              >
                <option value="">{t('selectTask')}</option>
                {groupedTasks.map((group, gIdx) => (
                  <optgroup key={gIdx} label={group.roadmapTitle}>
                    {group.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.status === 'completed'
                          ? `✓ ${task.title} (${t('completed')})`
                          : task.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Target Date Option */}
          <div>
            <label
              htmlFor="plan-item-date-select"
              className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              {t('targetDate')}
            </label>
            <select
              id="plan-item-date-select"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 cursor-pointer"
            >
              <option value="">{t('flexibleWeekly')}</option>
              {weekDays.map((day) => {
                const localizedDay = formatDate(day.dateIso, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <option key={day.dateIso} value={day.dateIso}>
                    {localizedDay} ({day.dateIso})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-neutral-500 mt-1">
              Choose a specific day of this week, or leave as flexible weekly commitment.
            </p>
          </div>

          {/* Planned Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="plan-item-minutes-input"
                className="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
              >
                {t('plannedMinutes')}
              </label>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatNumeral(plannedMinutes)} min
              </span>
            </div>

            <div className="relative">
              <input
                id="plan-item-minutes-input"
                type="number"
                min="0"
                step="5"
                value={plannedMinutes}
                onChange={(e) => setPlannedMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 pl-9 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100"
                required
              />
              <Clock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Quick Duration Preset Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPlannedMinutes(mins)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                    plannedMinutes === mins
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {formatNumeral(mins)}m
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer transition disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              id="btn-save-weekly-item"
              type="submit"
              disabled={isSubmitting || !taskId}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 cursor-pointer transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{mode === 'duplicate' ? t('duplicate') : t('saveItem')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
