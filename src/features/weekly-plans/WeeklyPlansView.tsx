/**
 * Weekly Plans View Component (Phase 10A & 10B)
 *
 * Full-featured, offline-first Weekly Planning workspace:
 * - Deterministic ISO week navigation (Previous / Current / Next)
 * - 7-day Planning Board (Monday through Sunday) with daily load indicators (empty/light/moderate/heavy)
 * - Dedicated Flexible Commitments section
 * - Top-level Weekly Allocation Summary (Planned, Dated, Flexible, Items, Active Days, Completion)
 * - Quick "+ Add" on each day and flexible shelf
 * - Native Drag-and-Drop + accessible "Move to..." action (Move between days and flexible)
 * - "Duplicate" commitment action respecting domain constraints
 * - View mode switcher (Board View vs List View)
 * - Presentation layer honoring Language and Calendar preferences (Gregorian / Persian)
 * - Creation, editing, and deletion with confirmation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Task, Roadmap, WeeklyPlan, WeeklyPlanItem, isValidWeekIdentifier } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  getCurrentWeekIdentifier,
  getPreviousWeekIdentifier,
  getNextWeekIdentifier,
  formatWeekRange,
  formatWeekHeading,
  deriveWeeklyAllocationSummary,
} from './weeklyPlanHelpers';
import { WeeklyPlanItemModal } from './WeeklyPlanItemModal';
import { WeeklyPlanItemRow } from './WeeklyPlanItemRow';
import { WeeklyBoardView } from './WeeklyBoardView';
import { MovePlanItemModal } from './MovePlanItemModal';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Plus,
  AlertCircle,
  CalendarPlus,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';

export const WeeklyPlansView: React.FC = () => {
  const application = useApplication();
  const { params } = useRouter();
  const { formatNumeral, formatDurationHoursMinutes, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  // Selected week state (defaults to URL param if valid ISO week, or current week)
  const currentWeek = useMemo(() => getCurrentWeekIdentifier(), []);
  const initialWeek = useMemo(() => {
    if (params.id && isValidWeekIdentifier(params.id)) {
      return params.id;
    }
    return currentWeek;
  }, [params.id, currentWeek]);

  const [selectedWeek, setSelectedWeek] = useState<string>(initialWeek);
  const isSelectedCurrentWeek = selectedWeek === currentWeek;

  // Data state
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // View mode: 'board' | 'list' (default to 'board')
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Filter tab for list view: 'all' | 'daily' | 'flexible'
  const [itemFilter, setItemFilter] = useState<'all' | 'daily' | 'flexible'>('all');

  // Item modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [editingItem, setEditingItem] = useState<WeeklyPlanItem | null>(null);
  const [defaultTargetDate, setDefaultTargetDate] = useState<string | undefined>(undefined);

  // Move modal state
  const [itemToMove, setItemToMove] = useState<WeeklyPlanItem | null>(null);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<WeeklyPlanItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load data for the selected week
  const loadData = useCallback(
    async (week: string) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setActionError(null);

        const [fetchedPlan, fetchedTasks, fetchedRoadmaps] = await Promise.all([
          application.weeklyPlans.getWeeklyPlanByWeek(week),
          application.tasks.listTasks(),
          application.roadmaps.listRoadmaps(),
        ]);

        setPlan(fetchedPlan);
        setTasks(fetchedTasks);
        setRoadmaps(fetchedRoadmaps);
      } catch (err: unknown) {
        console.error('Failed to load weekly plan data', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load weekly plan data.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [application]
  );

  useEffect(() => {
    loadData(selectedWeek);
  }, [loadData, selectedWeek]);

  // Lookup maps for fast item rendering
  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const roadmapsMap = useMemo(() => {
    const map = new Map<string, Roadmap>();
    roadmaps.forEach((r) => map.set(r.id, r));
    return map;
  }, [roadmaps]);

  // Derived weekly allocation summary
  const allocationSummary = useMemo(() => {
    return deriveWeeklyAllocationSummary(plan, tasks);
  }, [plan, tasks]);

  // Navigation handlers
  const handlePrevWeek = () => {
    try {
      const prev = getPreviousWeekIdentifier(selectedWeek);
      setSelectedWeek(prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextWeek = () => {
    try {
      const next = getNextWeekIdentifier(selectedWeek);
      setSelectedWeek(next);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCurrentWeek = () => {
    setSelectedWeek(currentWeek);
  };

  // Item Action Handlers
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setDefaultTargetDate(undefined);
    setModalMode('create');
    setIsItemModalOpen(true);
    setActionError(null);
  };

  const handleQuickAdd = (targetDate?: string) => {
    setEditingItem(null);
    setDefaultTargetDate(targetDate);
    setModalMode('create');
    setIsItemModalOpen(true);
    setActionError(null);
  };

  const handleOpenEditModal = (item: WeeklyPlanItem) => {
    setEditingItem(item);
    setDefaultTargetDate(item.targetDate);
    setModalMode('edit');
    setIsItemModalOpen(true);
    setActionError(null);
  };

  const handleDuplicateItem = (item: WeeklyPlanItem) => {
    setEditingItem(item);
    setDefaultTargetDate(item.targetDate);
    setModalMode('duplicate');
    setIsItemModalOpen(true);
    setActionError(null);
  };

  const handleMoveItem = (item: WeeklyPlanItem) => {
    setItemToMove(item);
    setActionError(null);
  };

  const handleMoveItemDirect = async (itemId: string, newTargetDate?: string) => {
    if (!plan) return;
    try {
      setActionError(null);
      // Passing empty string clears the target date to undefined, converting it to flexible
      await application.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
        targetDate: newTargetDate ? newTargetDate : '',
      });
      await loadData(selectedWeek);
    } catch (err: unknown) {
      console.error('Failed to move plan item', err);
      const msg = err instanceof Error ? err.message : 'Failed to move plan item.';
      setActionError(msg);
      throw err;
    }
  };

  const handleToggleComplete = async (item: WeeklyPlanItem) => {
    if (!plan) return;
    try {
      setActionError(null);
      await application.weeklyPlans.updateWeeklyPlanItem(plan.id, item.id, {
        isCompleted: !item.isCompleted,
      });
      await loadData(selectedWeek);
    } catch (err: unknown) {
      console.error('Failed to toggle completion', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update item.');
    }
  };

  const handleDeleteItemClick = (item: WeeklyPlanItem) => {
    setItemToDelete(item);
    setActionError(null);
  };

  const handleConfirmDelete = async () => {
    if (!plan || !itemToDelete) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      await application.weeklyPlans.removeWeeklyPlanItem(plan.id, itemToDelete.id);
      setItemToDelete(null);
      await loadData(selectedWeek);
    } catch (err: unknown) {
      console.error('Failed to remove item', err);
      setActionError(err instanceof Error ? err.message : 'Failed to remove plan item.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveModalItem = async (data: {
    taskId: string;
    plannedMinutes: number;
    targetDate?: string;
  }) => {
    setActionError(null);

    if (modalMode === 'create' || modalMode === 'duplicate') {
      if (!plan) {
        // Create plan aggregate if none exists yet for this week
        await application.weeklyPlans.createWeeklyPlan({
          weekIdentifier: selectedWeek,
          items: [data],
        });
      } else {
        await application.weeklyPlans.addWeeklyPlanItem(plan.id, data);
      }
    } else if (modalMode === 'edit' && editingItem && plan) {
      await application.weeklyPlans.updateWeeklyPlanItem(plan.id, editingItem.id, {
        plannedMinutes: data.plannedMinutes,
        targetDate: data.targetDate ? data.targetDate : '',
      });
    }

    await loadData(selectedWeek);
  };

  // Filtered items based on active tab in list view
  const filteredItems = useMemo(() => {
    if (!plan) return [];
    if (itemFilter === 'daily') {
      return plan.items.filter((item) => Boolean(item.targetDate));
    }
    if (itemFilter === 'flexible') {
      return plan.items.filter((item) => !item.targetDate);
    }
    return plan.items;
  }, [plan, itemFilter]);

  // Formatted date representations
  const weekRangeFormatted = useMemo(
    () => formatWeekRange(selectedWeek, preferences),
    [selectedWeek, preferences]
  );
  const weekHeading = useMemo(
    () => formatWeekHeading(selectedWeek, preferences),
    [selectedWeek, preferences]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Week Navigation & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {weekHeading.main}
            </h1>
            <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">
              {weekHeading.raw}
            </span>
            {isSelectedCurrentWeek && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t('currentWeek')}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span>{weekRangeFormatted}</span>
          </p>
        </div>

        {/* Navigation Controls & Add CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Navigation Buttons */}
          <div className="inline-flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 p-0.5">
            <button
              id="btn-prev-week"
              type="button"
              onClick={handlePrevWeek}
              aria-label={t('previousWeek')}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition cursor-pointer"
              title={t('previousWeek')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="btn-current-week"
              type="button"
              onClick={handleCurrentWeek}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                isSelectedCurrentWeek
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700'
              }`}
            >
              {t('thisWeek')}
            </button>
            <button
              id="btn-next-week"
              type="button"
              onClick={handleNextWeek}
              aria-label={t('nextWeek')}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition cursor-pointer"
              title={t('nextWeek')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Primary CTA */}
          <button
            id="btn-add-weekly-item-primary"
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addToThisWeek')}</span>
          </button>
        </div>
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{actionError}</div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Top-Level Weekly Allocation Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Planned Time */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('totalPlannedTime')}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
            {formatDurationHoursMinutes(allocationSummary.totalPlannedMinutes)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 font-mono">
            {formatNumeral(allocationSummary.totalPlannedMinutes)} min planned
          </div>
        </div>

        {/* Dated vs Flexible Allocation */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('weeklyAllocation')}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold font-mono">
            <div>
              <span className="text-neutral-400 text-[10px] font-normal block">{t('datedTime')}</span>
              <span className="text-neutral-900 dark:text-neutral-100">
                {formatDurationHoursMinutes(allocationSummary.datedMinutes)}
              </span>
            </div>
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />
            <div>
              <span className="text-neutral-400 text-[10px] font-normal block">{t('flexibleTime')}</span>
              <span className="text-neutral-900 dark:text-neutral-100">
                {formatDurationHoursMinutes(allocationSummary.flexibleMinutes)}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 font-mono">
            {formatNumeral(allocationSummary.activeDaysCount)} {t('activeDays')}
          </div>
        </div>

        {/* Planned Items */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('plannedItems')}</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CalendarPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
            {formatNumeral(allocationSummary.itemCount)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {allocationSummary.itemCount === 1 ? '1 commitment' : `${formatNumeral(allocationSummary.itemCount)} commitments`}
          </div>
        </div>

        {/* Completed Commitments */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('completedTasks')}</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-mono">
            {formatNumeral(allocationSummary.completedItemCount)}
            <span className="text-neutral-400 text-sm font-normal"> / {formatNumeral(allocationSummary.itemCount)}</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 font-mono">
            {formatNumeral(allocationSummary.taskCompletionPercentage)}% completed
          </div>
        </div>
      </div>

      {/* 3. View Switcher & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* View Mode Toggle: Board vs List */}
        <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl text-xs w-fit">
          <button
            id="btn-view-board"
            type="button"
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              viewMode === 'board'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{t('boardView')}</span>
          </button>
          <button
            id="btn-view-list"
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>{t('listView')}</span>
          </button>
        </div>

        {/* List Filter Pills (visible only when in list mode and items exist) */}
        {viewMode === 'list' && plan && plan.items.length > 0 && (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setItemFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                itemFilter === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              All ({formatNumeral(plan.items.length)})
            </button>
            <button
              type="button"
              onClick={() => setItemFilter('daily')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                itemFilter === 'daily'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Daily ({formatNumeral(plan.items.filter((i) => Boolean(i.targetDate)).length)})
            </button>
            <button
              type="button"
              onClick={() => setItemFilter('flexible')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                itemFilter === 'flexible'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Flexible ({formatNumeral(plan.items.filter((i) => !i.targetDate).length)})
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Content Area */}
      {isLoading ? (
        /* Loading State */
        <div className="py-20 text-center text-neutral-400 space-y-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-8 h-8 mx-auto border-2 border-neutral-300 dark:border-neutral-700 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs font-medium">{t('loadingWeeklyPlan')}</p>
        </div>
      ) : errorMessage ? (
        /* Error State */
        <div className="py-16 text-center max-w-sm mx-auto space-y-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Failed to load plan
          </div>
          <p className="text-xs text-neutral-500">{errorMessage}</p>
          <button
            type="button"
            onClick={() => loadData(selectedWeek)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 cursor-pointer transition"
          >
            Try Again
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* Board View */
        <WeeklyBoardView
          plan={plan}
          tasks={tasks}
          roadmaps={roadmaps}
          onToggleComplete={handleToggleComplete}
          onEdit={handleOpenEditModal}
          onDuplicate={handleDuplicateItem}
          onMove={handleMoveItem}
          onDelete={handleDeleteItemClick}
          onQuickAdd={handleQuickAdd}
          onMoveItemDirect={handleMoveItemDirect}
        />
      ) : (
        /* List View */
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs overflow-hidden p-4 sm:p-5">
          {!plan || plan.items.length === 0 ? (
            /* Empty State */
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-neutral-400 flex items-center justify-center">
                <CalendarPlus className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {t('noPlansForWeek')}
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {t('noPlansForWeekDesc')}
                </p>
              </div>
              <button
                id="btn-add-weekly-item-empty"
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 cursor-pointer transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addToThisWeek')}</span>
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              No items match this filter tab.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const task = tasksMap.get(item.taskId);
                const roadmap = task ? roadmapsMap.get(task.roadmapId) : undefined;
                return (
                  <WeeklyPlanItemRow
                    key={item.id}
                    item={item}
                    task={task}
                    roadmap={roadmap}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDuplicate={handleDuplicateItem}
                    onMove={handleMoveItem}
                    onDelete={handleDeleteItemClick}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Add / Edit / Duplicate Item Modal */}
      <WeeklyPlanItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        mode={modalMode}
        weekIdentifier={selectedWeek}
        roadmaps={roadmaps}
        tasks={tasks}
        initialItem={editingItem}
        defaultTargetDate={defaultTargetDate}
        onSubmit={handleSaveModalItem}
      />

      {/* 6. Move Item Modal */}
      <MovePlanItemModal
        isOpen={Boolean(itemToMove)}
        onClose={() => setItemToMove(null)}
        item={itemToMove}
        taskTitle={itemToMove ? (tasksMap.get(itemToMove.taskId)?.title ?? t('unknownTask')) : ''}
        weekIdentifier={selectedWeek}
        onMove={handleMoveItemDirect}
      />

      {/* 7. Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs"
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-900 dark:text-neutral-100 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {t('deletePlannedItem')}
            </h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              {t('confirmDeleteItem')}
            </p>

            <div className="mt-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {tasksMap.get(itemToDelete.taskId)?.title ?? t('unknownTask')}
              </span>
              <span className="text-neutral-400 ml-2 font-mono">
                ({formatDurationHoursMinutes(itemToDelete.plannedMinutes)})
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer transition disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                id="btn-confirm-delete-weekly-item"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
