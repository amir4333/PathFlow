/**
 * Weekly Board View Component
 *
 * Compact, interactive 7-day planning board (Monday through Sunday) alongside
 * a dedicated flexible commitments section.
 * - Derived daily planned-minute summaries & load indicators (empty/light/moderate/heavy)
 * - Native HTML5 drag-and-drop between day columns and flexible drop zone
 * - Quick "+ Add" button on each day and flexible shelf
 * - Full localization honoring English/Persian languages and Gregorian/Persian calendars
 */

import React, { useState } from 'react';
import { WeeklyPlan, WeeklyPlanItem, Task, Roadmap } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  calculateWeeklyPlanDailyBreakdown,
  getDayNameTranslationKey,
  getDailyCapacityLevel,
  DailyCapacityLevel,
} from './weeklyPlanHelpers';
import { WeeklyBoardCard } from './WeeklyBoardCard';
import { Plus, Sparkles, Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface WeeklyBoardViewProps {
  plan: WeeklyPlan | null;
  tasks: readonly Task[];
  roadmaps: readonly Roadmap[];
  onToggleComplete: (item: WeeklyPlanItem) => void;
  onEdit: (item: WeeklyPlanItem) => void;
  onDuplicate: (item: WeeklyPlanItem) => void;
  onMove: (item: WeeklyPlanItem) => void;
  onDelete: (item: WeeklyPlanItem) => void;
  onQuickAdd: (targetDate?: string) => void;
  onMoveItemDirect: (itemId: string, newTargetDate?: string) => Promise<void>;
}

export const WeeklyBoardView: React.FC<WeeklyBoardViewProps> = ({
  plan,
  tasks,
  roadmaps,
  onToggleComplete,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onQuickAdd,
  onMoveItemDirect,
}) => {
  const { formatDate, formatDurationHoursMinutes, formatNumeral, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  // Maps for fast lookup
  const tasksMap = React.useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const roadmapsMap = React.useMemo(() => {
    const map = new Map<string, Roadmap>();
    roadmaps.forEach((r) => map.set(r.id, r));
    return map;
  }, [roadmaps]);

  // Derive 7-day breakdown and flexible items
  const breakdown = React.useMemo(() => {
    if (!plan) return null;
    return calculateWeeklyPlanDailyBreakdown(plan);
  }, [plan]);

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== zoneId) {
      setDragOverZone(zoneId);
    }
  };

  const handleDragLeave = (zoneId: string) => {
    if (dragOverZone === zoneId) {
      setDragOverZone(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate?: string) => {
    e.preventDefault();
    setDragOverZone(null);
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    try {
      await onMoveItemDirect(itemId, targetDate);
    } catch (err) {
      console.error('Failed to move item via drag and drop', err);
    }
  };

  const getCapacityBadgeStyle = (level: DailyCapacityLevel) => {
    switch (level) {
      case 'light':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
      case 'moderate':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60';
      case 'heavy':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';
      case 'empty':
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent';
    }
  };

  const getCapacityLabel = (level: DailyCapacityLevel) => {
    switch (level) {
      case 'light':
        return t('capacityLight');
      case 'moderate':
        return t('capacityModerate');
      case 'heavy':
        return t('capacityHeavy');
      case 'empty':
      default:
        return t('capacityEmpty');
    }
  };

  const flexibleItems = breakdown?.unallocatedItems ?? [];
  const flexibleMinutes = breakdown?.unallocatedMinutes ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. Flexible Commitments Shelf */}
      <section
        onDragOver={(e) => handleDragOver(e, 'flexible')}
        onDragLeave={() => handleDragLeave('flexible')}
        onDrop={(e) => handleDrop(e, undefined)}
        className={`p-4 rounded-2xl border transition-all ${
          dragOverZone === 'flexible'
            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/40'
            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {t('flexibleCommitments')}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono font-medium">
                  {formatDurationHoursMinutes(flexibleMinutes)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {t('flexibleCommitmentsDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onQuickAdd(undefined)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 cursor-pointer transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('quickAdd')}</span>
          </button>
        </div>

        {/* Flexible Cards Grid */}
        <div className="mt-3">
          {flexibleItems.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/40 dark:bg-neutral-950/30">
              <p className="text-xs text-neutral-400">
                No flexible commitments for this week. Drag items here or click + Add.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {flexibleItems.map((item) => {
                const task = tasksMap.get(item.taskId);
                const roadmap = task ? roadmapsMap.get(task.roadmapId) : undefined;
                return (
                  <WeeklyBoardCard
                    key={item.id}
                    item={item}
                    task={task}
                    roadmap={roadmap}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                    onDelete={onDelete}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 2. Seven-Day Board Columns (Monday through Sunday) */}
      <section>
        <div className="flex overflow-x-auto pb-4 gap-3 snap-x lg:grid lg:grid-cols-7 lg:overflow-visible">
          {breakdown?.days.map((day) => {
            const dayKey = getDayNameTranslationKey(day.dayOfWeek);
            const dayName = t(dayKey);
            const formattedDate = formatDate(day.date, {
              month: 'short',
              day: 'numeric',
            });
            const capacityLevel = getDailyCapacityLevel(day.plannedMinutes);
            const capacityBadgeClass = getCapacityBadgeStyle(capacityLevel);
            const capacityLabel = getCapacityLabel(capacityLevel);
            const isDragOver = dragOverZone === day.date;

            return (
              <div
                key={day.date}
                onDragOver={(e) => handleDragOver(e, day.date)}
                onDragLeave={() => handleDragLeave(day.date)}
                onDrop={(e) => handleDrop(e, day.date)}
                className={`flex flex-col min-w-[210px] lg:min-w-0 rounded-2xl border p-3 transition-all snap-start flex-1 ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xs'
                }`}
              >
                {/* Column Header */}
                <div className="pb-2.5 border-b border-neutral-100 dark:border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {dayName}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {formattedDate}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onQuickAdd(day.date)}
                      title={`Add plan for ${dayName}`}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Planned Duration & Capacity Indicator */}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-50 dark:border-neutral-800/40">
                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 font-mono">
                      {day.plannedMinutes > 0
                        ? formatDurationHoursMinutes(day.plannedMinutes)
                        : formatNumeral('0m')}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${capacityBadgeClass}`}
                    >
                      {capacityLabel}
                    </span>
                  </div>
                </div>

                {/* Day Items List */}
                <div className="flex-1 flex flex-col gap-2 mt-3 min-h-[120px]">
                  {day.items.length === 0 ? (
                    <div
                      onClick={() => onQuickAdd(day.date)}
                      className="flex-1 flex flex-col items-center justify-center p-3 border border-dashed border-neutral-200 dark:border-neutral-800/80 rounded-xl text-center cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition"
                    >
                      <span className="text-[11px] text-neutral-400">
                        {t('noTasksScheduled')}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-medium mt-1 flex items-center gap-0.5">
                        <Plus className="w-3 h-3" />
                        {t('quickAdd')}
                      </span>
                    </div>
                  ) : (
                    day.items.map((item) => {
                      const task = tasksMap.get(item.taskId);
                      const roadmap = task ? roadmapsMap.get(task.roadmapId) : undefined;
                      return (
                        <WeeklyBoardCard
                          key={item.id}
                          item={item}
                          task={task}
                          roadmap={roadmap}
                          onToggleComplete={onToggleComplete}
                          onEdit={onEdit}
                          onDuplicate={onDuplicate}
                          onMove={onMove}
                          onDelete={onDelete}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
