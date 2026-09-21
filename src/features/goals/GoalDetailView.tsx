import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Goal, GoalStatus, Roadmap } from '../../domain';
import { GoalDetailedProgress } from '../../domain/services/progressReview';
import {
  Target,
  ArrowLeft,
  Plus,
  Edit3,
  Archive,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { GoalFormModal } from './GoalFormModal';
import { RoadmapFormModal } from '../roadmaps/RoadmapFormModal';

interface GoalDetailViewProps {
  goalId: string;
}

export const GoalDetailView: React.FC<GoalDetailViewProps> = ({ goalId }) => {
  const { navigate } = useRouter();
  const application = useApplication();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [progress, setProgress] = useState<GoalDetailedProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Goal Edit Modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Roadmap Modal
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [roadmapModalMode, setRoadmapModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null);

  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setActionError(null);

      const [fetchedGoal, fetchedRoadmaps] = await Promise.all([
        application.goals.getGoal(goalId),
        application.roadmaps.listRoadmapsForGoal(goalId),
      ]);

      setGoal(fetchedGoal);
      setRoadmaps(fetchedRoadmaps);

      try {
        const goalProg = await application.progress.getGoalProgress(goalId);
        setProgress(goalProg);
      } catch (err) {
        console.error('Failed to compute goal progress', err);
      }
    } catch (err: unknown) {
      console.error('Failed to load goal details', err);
      setError(err instanceof Error ? err.message : 'Goal not found or unable to load.');
    } finally {
      setIsLoading(false);
    }
  }, [application, goalId]);

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  const handleUpdateGoal = async (data: { title: string; description: string; status?: GoalStatus }) => {
    if (!goal) return;
    await application.goals.updateGoal(goal.id, {
      title: data.title,
      description: data.description,
      status: data.status,
    });
    await loadGoalData();
  };

  const handleArchiveGoal = async () => {
    if (!goal) return;
    try {
      setActionError(null);
      await application.goals.archiveGoal(goal.id);
      await loadGoalData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive goal.');
    }
  };

  const handleCreateRoadmap = async (data: { title: string; description: string }) => {
    if (!goal) return;
    await application.roadmaps.createRoadmap({
      goalId: goal.id,
      title: data.title,
      description: data.description,
    });
    await loadGoalData();
  };

  const handleEditRoadmap = async (data: { title: string; description: string }) => {
    if (!selectedRoadmap) return;
    await application.roadmaps.updateRoadmap(selectedRoadmap.id, {
      title: data.title,
      description: data.description,
    });
    await loadGoalData();
  };

  const handleDeleteRoadmap = async (e: React.MouseEvent, roadmap: Roadmap) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete roadmap "${roadmap.title}"?`)) {
      return;
    }

    try {
      setActionError(null);
      await application.roadmaps.deleteRoadmap(roadmap.id);
      await loadGoalData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete roadmap.');
    }
  };

  const openCreateRoadmapModal = () => {
    setSelectedRoadmap(null);
    setRoadmapModalMode('create');
    setIsRoadmapModalOpen(true);
  };

  const openEditRoadmapModal = (e: React.MouseEvent, r: Roadmap) => {
    e.stopPropagation();
    setSelectedRoadmap(r);
    setRoadmapModalMode('edit');
    setIsRoadmapModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-neutral-500">
        Loading goal details...
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => navigate('goals')}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Goals</span>
        </button>

        <div className="p-8 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {error || 'Goal Not Found'}
          </h2>
          <p className="text-xs text-neutral-500">
            The requested strategic goal could not be found in local IndexedDB persistence.
          </p>
          <button
            onClick={() => navigate('goals')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 cursor-pointer"
          >
            Return to Goals List
          </button>
        </div>
      </div>
    );
  }

  const taskPct = progress ? progress.taskCompletionPercentage : 0;
  const timePct = progress ? progress.timeCompletionPercentage : 0;

  return (
    <div id="goal-detail-view" className="max-w-5xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-to-goals"
          onClick={() => navigate('goals')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Strategic Goals</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            id="btn-edit-goal"
            onClick={() => setIsGoalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Goal</span>
          </button>

          {goal.status !== 'archived' && (
            <button
              id="btn-archive-goal"
              onClick={handleArchiveGoal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive Goal</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          id="goal-detail-action-error"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Goal Summary Card */}
      <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                <Target className="w-3 h-3 text-emerald-500" />
                Goal
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  goal.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                    : goal.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                    : goal.status === 'archived'
                    ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                }`}
              >
                {goal.status === 'not_started' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                {goal.status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                {goal.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                {goal.status === 'archived' && <Archive className="w-3 h-3 text-neutral-400" />}
                <span className="capitalize">{goal.status.replace('_', ' ')}</span>
              </span>

              <span className="text-xs font-mono text-neutral-400">ID: {goal.id}</span>
            </div>

            <h1 id="goal-detail-title" className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {goal.title}
            </h1>

            {goal.description ? (
              <p id="goal-detail-description" className="text-sm text-neutral-600 dark:text-neutral-300 max-w-3xl leading-relaxed whitespace-pre-wrap">
                {goal.description}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">No description provided.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-neutral-500 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6 min-w-[190px]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Created: {new Date(goal.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Updated: {new Date(goal.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {roadmaps.length} Roadmap{roadmaps.length === 1 ? '' : 's'} Attached
              </span>
            </div>
          </div>
        </div>

        {/* Derived Progress Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Roadmaps
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.completedRoadmaps ?? 0}
              </span>
              <span className="text-xs text-neutral-400">/ {roadmaps.length} completed</span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Tasks Velocity
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {taskPct}%
              </span>
              <span className="text-xs text-neutral-400">
                ({progress?.completedTasks ?? 0}/{progress?.activeTasks ?? 0})
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Actual Time Invested
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.totalActualMinutes ?? 0}m
              </span>
              <span className="text-xs text-neutral-400">
                ({progress?.sessionCount ?? 0} sessions)
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Estimated Time
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.totalEstimatedMinutes ?? 0}m
              </span>
              <span className="text-xs text-neutral-400">planned</span>
            </div>
          </div>
        </div>

        {/* Progress bar visualizer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Overall Milestone Completion</span>
            <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{taskPct}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(taskPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Roadmaps Management Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Milestone Roadmaps</span>
            </h2>
            <p className="text-xs text-neutral-500">
              Strategic pathways and milestones decomposing this goal.
            </p>
          </div>

          <button
            id="btn-add-roadmap"
            onClick={openCreateRoadmapModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Roadmap</span>
          </button>
        </div>

        {roadmaps.length === 0 ? (
          <div
            id="roadmaps-empty-state"
            className="p-10 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl space-y-3"
          >
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                No roadmaps attached to this goal
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Break this strategic goal down into sequential or parallel milestone pathways to start mapping actionable tasks.
              </p>
            </div>
            <button
              id="btn-create-first-roadmap"
              onClick={openCreateRoadmapModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Roadmap</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roadmaps.map((roadmap) => {
              const rProg = progress?.roadmaps.find((rp) => rp.roadmapId === roadmap.id);
              const rTaskPct = rProg ? rProg.taskCompletionPercentage : 0;

              return (
                <div
                  key={roadmap.id}
                  id={`roadmap-item-${roadmap.id}`}
                  onClick={() => navigate('roadmaps', { id: roadmap.id })}
                  className="group p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl shadow-2xs transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                        {roadmap.id.slice(0, 8)}...
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          id={`btn-edit-roadmap-${roadmap.id}`}
                          onClick={(e) => openEditRoadmapModal(e, roadmap)}
                          aria-label="Edit Roadmap"
                          title="Edit Roadmap"
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-roadmap-${roadmap.id}`}
                          onClick={(e) => handleDeleteRoadmap(e, roadmap)}
                          aria-label="Delete Roadmap"
                          title="Delete Roadmap"
                          className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {roadmap.title}
                    </h3>

                    {roadmap.description && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                        {roadmap.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500">
                        {rProg ? `${rProg.completedTasks}/${rProg.totalTasks} Tasks` : '0 Tasks'}
                      </span>
                      <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {rTaskPct}%
                      </span>
                    </div>

                    <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(rTaskPct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-500">
                      <span>{rProg ? `${rProg.totalActualMinutes}m logged` : '0m logged'}</span>
                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Edit Modal */}
      <GoalFormModal
        isOpen={isGoalModalOpen}
        mode="edit"
        initialData={goal}
        onClose={() => setIsGoalModalOpen(false)}
        onSubmit={handleUpdateGoal}
      />

      {/* Roadmap Form Modal */}
      <RoadmapFormModal
        isOpen={isRoadmapModalOpen}
        mode={roadmapModalMode}
        goalTitle={goal.title}
        initialData={selectedRoadmap}
        onClose={() => setIsRoadmapModalOpen(false)}
        onSubmit={roadmapModalMode === 'create' ? handleCreateRoadmap : handleEditRoadmap}
      />
    </div>
  );
};
