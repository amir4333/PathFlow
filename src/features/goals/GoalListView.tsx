import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Goal, GoalStatus, Roadmap } from '../../domain';
import { GoalDetailedProgress } from '../../domain/services/progressReview';
import {
  Target,
  Plus,
  ArrowRight,
  Archive,
  Edit3,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  Layers,
} from 'lucide-react';
import { GoalFormModal } from './GoalFormModal';

export const GoalListView: React.FC = () => {
  const { navigate } = useRouter();
  const application = useApplication();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, GoalDetailedProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | GoalStatus>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setActionError(null);
      const [fetchedGoals, fetchedRoadmaps] = await Promise.all([
        application.goals.listGoals(),
        application.roadmaps.listRoadmaps(),
      ]);

      setGoals(fetchedGoals);
      setRoadmaps(fetchedRoadmaps);

      // Load derived progress for all goals
      const progressEntries: Record<string, GoalDetailedProgress> = {};
      await Promise.all(
        fetchedGoals.map(async (g) => {
          try {
            const p = await application.progress.getGoalProgress(g.id);
            progressEntries[g.id] = p;
          } catch (err) {
            console.error(`Failed to load progress for goal ${g.id}`, err);
          }
        })
      );
      setProgressMap(progressEntries);
    } catch (err) {
      console.error('Failed to load goals data', err);
      setActionError('Could not load goals from local database.');
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateGoal = async (data: { title: string; description: string }) => {
    await application.goals.createGoal(data);
    await loadData();
  };

  const handleEditGoal = async (data: { title: string; description: string; status?: GoalStatus }) => {
    if (!selectedGoal) return;
    await application.goals.updateGoal(selectedGoal.id, {
      title: data.title,
      description: data.description,
      status: data.status,
    });
    await loadData();
  };

  const handleArchiveGoal = async (e: React.MouseEvent, goal: Goal) => {
    e.stopPropagation();
    try {
      setActionError(null);
      await application.goals.archiveGoal(goal.id);
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive goal.');
    }
  };

  const openCreateModal = () => {
    setSelectedGoal(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, goal: Goal) => {
    e.stopPropagation();
    setSelectedGoal(goal);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const filteredGoals = goals.filter((g) => {
    if (statusFilter === 'all') return true;
    return g.status === statusFilter;
  });

  const getStatusBadge = (status: GoalStatus) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Completed
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
            <Archive className="w-3 h-3 text-neutral-400" />
            Archived
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Not Started
          </span>
        );
    }
  };

  return (
    <div id="goals-management-view" className="max-w-6xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Strategic Goals
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            High-level multi-year and annual outcomes guiding roadmap execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-create-goal-top"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div
          id="goals-action-error"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-neutral-400 ml-1" />
          <span className="text-xs font-medium text-neutral-500">Status:</span>
          <div className="flex items-center gap-1">
            {(['all', 'not_started', 'in_progress', 'completed', 'archived'] as const).map((st) => (
              <button
                key={st}
                id={`filter-goal-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'not_started'
                  ? 'Not Started'
                  : st === 'in_progress'
                  ? 'In Progress'
                  : st === 'completed'
                  ? 'Completed'
                  : 'Archived'}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono">
          Showing {filteredGoals.length} of {goals.length} Goals
        </div>
      </div>

      {/* Goals List / Empty State */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-neutral-500">
          Loading goals from local database...
        </div>
      ) : filteredGoals.length === 0 ? (
        <div
          id="goals-empty-state"
          className="p-12 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {goals.length === 0 ? 'No strategic goals yet' : 'No goals match the selected filter'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {goals.length === 0
                ? 'Goals define high-level strategic aspirations that decompose into milestone roadmaps and tasks.'
                : 'Try adjusting the status filter to see other goals.'}
            </p>
          </div>
          {goals.length === 0 && (
            <button
              id="btn-create-first-goal"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Goal</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGoals.map((goal) => {
            const goalRoadmaps = roadmaps.filter((r) => r.goalId === goal.id);
            const progress = progressMap[goal.id];
            const taskPct = progress ? progress.taskCompletionPercentage : 0;
            const timePct = progress ? progress.timeCompletionPercentage : 0;

            return (
              <div
                key={goal.id}
                id={`goal-card-${goal.id}`}
                onClick={() => navigate('goals', { id: goal.id })}
                className="group relative p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl shadow-xs transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(goal.status)}
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        <span>{goalRoadmaps.length} Roadmap{goalRoadmaps.length === 1 ? '' : 's'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        id={`btn-edit-goal-${goal.id}`}
                        onClick={(e) => openEditModal(e, goal)}
                        aria-label="Edit Goal"
                        title="Edit Goal"
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {goal.status !== 'archived' && (
                        <button
                          id={`btn-archive-goal-${goal.id}`}
                          onClick={(e) => handleArchiveGoal(e, goal)}
                          aria-label="Archive Goal"
                          title="Archive Goal"
                          className="p-1 rounded text-neutral-400 hover:text-amber-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {goal.title}
                  </h2>

                  {goal.description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 line-clamp-2">
                      {goal.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                  {/* Derived Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-500 font-medium">Task Velocity</span>
                      <span className="font-mono text-neutral-700 dark:text-neutral-300 font-semibold">
                        {taskPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(taskPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>
                        {progress ? `${progress.totalActualMinutes}m logged` : '0m logged'}
                      </span>
                    </span>

                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
                      <span>View Roadmaps</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      <GoalFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={selectedGoal}
        onClose={() => setIsModalOpen(false)}
        onSubmit={modalMode === 'create' ? handleCreateGoal : handleEditGoal}
      />
    </div>
  );
};
