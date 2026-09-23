/**
 * Weekly Plan Item Row Component
 *
 * Compact, responsive card displaying a single WeeklyPlanItem:
 * - Task Title & Roadmap badge (with graceful deleted-task fallback)
 * - Planned duration formatted with user preferences
 * - Target date badge (or flexible weekly commitment badge)
 * - Item completion toggle checkbox
 * - Edit and Delete actions
 */

import React from 'react';
import { WeeklyPlanItem, Task, Roadmap } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  Layers,
  MapPin,
  ArrowRightLeft,
  Copy,
} from 'lucide-react';

interface WeeklyPlanItemRowProps {
  item: WeeklyPlanItem;
  task?: Task;
  roadmap?: Roadmap;
  onToggleComplete: (item: WeeklyPlanItem) => void;
  onEdit: (item: WeeklyPlanItem) => void;
  onDuplicate?: (item: WeeklyPlanItem) => void;
  onMove?: (item: WeeklyPlanItem) => void;
  onDelete: (item: WeeklyPlanItem) => void;
}

export const WeeklyPlanItemRow: React.FC<WeeklyPlanItemRowProps> = ({
  item,
  task,
  roadmap,
  onToggleComplete,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
}) => {
  const { formatDate, formatDurationHoursMinutes, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  const taskTitle = task?.title ?? t('unknownTask');
  const roadmapTitle = roadmap?.title;
  const isCompleted = Boolean(item.isCompleted);

  // Target date formatting
  const formattedTargetDate = React.useMemo(() => {
    if (!item.targetDate) return null;
    return formatDate(item.targetDate, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [item.targetDate, formatDate]);

  return (
    <div
      className={`group p-3.5 sm:p-4 rounded-xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isCompleted
          ? 'bg-neutral-50/70 dark:bg-neutral-900/40 border-neutral-200/80 dark:border-neutral-800/80 opacity-80'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      {/* Left: Checkbox + Task / Roadmap Info */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onToggleComplete(item)}
          aria-label={isCompleted ? 'Mark commitment incomplete' : 'Mark commitment complete'}
          className="mt-0.5 sm:mt-0 p-1 rounded-lg text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition shrink-0"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-semibold truncate ${
                isCompleted
                  ? 'line-through text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {taskTitle}
            </span>

            {roadmapTitle && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                <MapPin className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{roadmapTitle}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-500">
            {/* Target Date Badge */}
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              <Calendar className="w-3 h-3 text-neutral-400" />
              {formattedTargetDate ? (
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {formattedTargetDate}
                </span>
              ) : (
                <span className="text-neutral-400 italic">
                  {t('flexibleWeekly')}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Duration + Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/60">
        {/* Planned Minutes Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold font-mono border border-emerald-200 dark:border-emerald-900/60">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDurationHoursMinutes(item.plannedMinutes)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {onMove && (
            <button
              type="button"
              onClick={() => onMove(item)}
              aria-label={t('moveTo')}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 cursor-pointer transition"
              title={t('moveTo')}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(item)}
              aria-label={t('duplicate')}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer transition"
              title={t('duplicate')}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={t('editPlannedItem')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
            title={t('editPlannedItem')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={t('deletePlannedItem')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer transition"
            title={t('deletePlannedItem')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
