/**
 * Weekly Board Card Component
 *
 * Compact, interactive card representing a planned commitment inside a day column
 * or flexible shelf. Supports HTML5 drag-and-drop, inline completion toggle,
 * and quick actions (Move to..., Duplicate, Edit, Delete).
 */

import React from 'react';
import { WeeklyPlanItem, Task, Roadmap } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  Copy,
  ArrowRightLeft,
  GripVertical,
} from 'lucide-react';

interface WeeklyBoardCardProps {
  item: WeeklyPlanItem;
  task?: Task;
  roadmap?: Roadmap;
  onToggleComplete: (item: WeeklyPlanItem) => void;
  onEdit: (item: WeeklyPlanItem) => void;
  onDuplicate: (item: WeeklyPlanItem) => void;
  onMove: (item: WeeklyPlanItem) => void;
  onDelete: (item: WeeklyPlanItem) => void;
}

export const WeeklyBoardCard: React.FC<WeeklyBoardCardProps> = ({
  item,
  task,
  roadmap,
  onToggleComplete,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
}) => {
  const { formatDurationHoursMinutes, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  const taskTitle = task?.title ?? t('unknownTask');
  const roadmapTitle = roadmap?.title;
  const isCompleted = Boolean(item.isCompleted);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative rounded-xl border p-2.5 transition-all select-none cursor-grab active:cursor-grabbing ${
        isCompleted
          ? 'bg-neutral-50/80 dark:bg-neutral-900/40 border-neutral-200/70 dark:border-neutral-800/70 opacity-75'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-xs'
      }`}
    >
      {/* Top row: Checkbox + Title + Drag Handle */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(item);
          }}
          aria-label={isCompleted ? 'Mark commitment incomplete' : 'Mark commitment complete'}
          className="mt-0.5 p-0.5 rounded text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition shrink-0"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            title={taskTitle}
            className={`text-xs font-semibold leading-snug line-clamp-2 ${
              isCompleted
                ? 'line-through text-neutral-400 dark:text-neutral-500'
                : 'text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {taskTitle}
          </div>

          {roadmapTitle && (
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{roadmapTitle}</span>
            </div>
          )}
        </div>

        <div
          title="Drag to move"
          className="text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 shrink-0 cursor-grab"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Bottom row: Duration badge + Action icons */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-medium border border-emerald-200/60 dark:border-emerald-900/40">
          <Clock className="w-3 h-3" />
          <span>{formatDurationHoursMinutes(item.plannedMinutes)}</span>
        </div>

        {/* Quick Actions (visible or subtly revealed) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove(item);
            }}
            aria-label={t('moveTo')}
            title={t('moveTo')}
            className="p-1 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 cursor-pointer transition"
          >
            <ArrowRightLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(item);
            }}
            aria-label={t('duplicate')}
            title={t('duplicate')}
            className="p-1 rounded text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer transition"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            aria-label={t('editPlannedItem')}
            title={t('editPlannedItem')}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            aria-label={t('deletePlannedItem')}
            title={t('deletePlannedItem')}
            className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
