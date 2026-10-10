import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Goal, GoalStatus, Roadmap } from '../../domain';
import { GoalDetailedProgress } from '../../domain/services/progressReview';
import {
  useUserPreferences,
  getTranslation,
  translateStatus,
  formatShortDate,
} from '../../app/preferences';
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
  const { preferences } = useUserPreferences();
  const lang = preferences.language;
  const t = useCallback(
    (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang),
    [lang]
  );

  const [goal, setGoal] = useState<Goal | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [progress, setProgress] = useState<GoalDetailedProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Goal Edit Modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Goal Delete Confirmation Modal
  const [isDeleteGoalModalOpen, setIsDeleteGoalModalOpen] = useState(false);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);

  // Roadmap Modal
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [roadmapModalMode, setRoadmapModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null);

  // Roadmap Delete Confirmation Modal
  const [roadmapToDelete, setRoadmapToDelete] = useState<Roadmap | null>(null);
  const [isDeletingRoadmap, setIsDeletingRoadmap] = useState(false);

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
      setError(err instanceof Error ? err.message : t('goalNotFoundError'));
    } finally {
      setIsLoading(false);
    }
  }, [application, goalId, t]);

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
      setActionError(err instanceof Error ? err.message : t('failedToArchiveGoal'));
    }
  };

  const handleDeleteGoal = async () => {
    if (!goal || isDeletingGoal) return;
    try {
      setIsDeletingGoal(true);
      setActionError(null);
      await application.goals.deleteGoal(goal.id);
      setIsDeleteGoalModalOpen(false);
      navigate('goals');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('failedToDeleteGoal'));
      setIsDeleteGoalModalOpen(false);
    } finally {
      setIsDeletingGoal(false);
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

  const handleDeleteRoadmap = (e: React.MouseEvent, roadmap: Roadmap) => {
    e.stopPropagation();
    setActionError(null);
    setRoadmapToDelete(roadmap);
  };

  const handleConfirmDeleteRoadmap = async () => {
    if (!roadmapToDelete || isDeletingRoadmap) return;
    try {
      setIsDeletingRoadmap(true);
      setActionError(null);
      await application.roadmaps.deleteRoadmap(roadmapToDelete.id);
      setRoadmapToDelete(null);
      await loadGoalData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('failedToDeleteRoadmap'));
      setRoadmapToDelete(null);
    } finally {
      setIsDeletingRoadmap(false);
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
        {t('loadingGoalDetails')}
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
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('backToGoals')}</span>
        </button>

        <div className="p-8 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {error || t('goalNotFoundTitle')}
          </h2>
          <p className="text-xs text-neutral-500">
            {t('goalNotFoundDesc')}
          </p>
          <button
            onClick={() => navigate('goals')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 cursor-pointer"
          >
            {t('returnToGoalsList')}
          </button>
        </div>
      </div>
    );
  }

  const taskPct = progress ? progress.taskCompletionPercentage : 0;

  return (
    <div id="goal-detail-view" className="max-w-5xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-to-goals"
          onClick={() => navigate('goals')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('backToStrategicGoals')}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            id="btn-edit-goal"
            type="button"
            onClick={() => setIsGoalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{t('editGoalButton')}</span>
          </button>

          {goal.status !== 'archived' && (
            <button
              id="btn-archive-goal"
              type="button"
              onClick={handleArchiveGoal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{t('archiveGoalButton')}</span>
            </button>
          )}

          <button
            id="btn-delete-goal"
            data-testid="btn-delete-goal"
            type="button"
            onClick={() => {
              setActionError(null);
              setIsDeleteGoalModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('deleteGoalButton')}</span>
          </button>
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
                {t('goalBadge')}
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
                <span className="capitalize">{translateStatus(goal.status, lang)}</span>
              </span>

              <span className="text-xs font-mono text-neutral-400">{t('idPrefix')}: {goal.id}</span>
            </div>

            <h1 id="goal-detail-title" className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {goal.title}
            </h1>

            {goal.description ? (
              <p id="goal-detail-description" className="text-sm text-neutral-600 dark:text-neutral-300 max-w-3xl leading-relaxed whitespace-pre-wrap">
                {goal.description}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">{t('noDescriptionProvided')}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-neutral-500 border-t md:border-t-0 md:border-s border-neutral-200 dark:border-neutral-800 pt-4 md:pt-0 md:ps-6 min-w-[190px]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t('createdPrefix')}: {formatShortDate(goal.createdAt, preferences)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t('updatedPrefix')}: {formatShortDate(goal.updatedAt, preferences)}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {roadmaps.length} {roadmaps.length === 1 ? t('roadmapSingular') : t('roadmapsPlural')} {t('attachedSuffix')}
              </span>
            </div>
          </div>
        </div>

        {/* Derived Progress Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              {t('roadmapsPlural')}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.completedRoadmaps ?? 0}
              </span>
              <span className="text-xs text-neutral-400">/ {roadmaps.length} {t('completedSuffix')}</span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              {t('tasksVelocityTitle')}
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
              {t('actualTimeInvestedTitle')}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.totalActualMinutes ?? 0}{t('minutesUnit')}
              </span>
              <span className="text-xs text-neutral-400">
                ({progress?.sessionCount ?? 0} {t('sessionsCountSuffix')})
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              {t('estimatedTimeTitle')}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.totalEstimatedMinutes ?? 0}{t('minutesUnit')}
              </span>
              <span className="text-xs text-neutral-400">{t('plannedSuffix')}</span>
            </div>
          </div>
        </div>

        {/* Progress bar visualizer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{t('overallMilestoneCompletion')}</span>
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
              <span>{t('milestoneRoadmapsLabel')}</span>
            </h2>
            <p className="text-xs text-neutral-500">
              {t('milestoneRoadmapsDesc')}
            </p>
          </div>

          <button
            id="btn-add-roadmap"
            onClick={openCreateRoadmapModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addRoadmapButton')}</span>
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
                {t('noRoadmapsAttachedTitle')}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                {t('noRoadmapsAttachedDesc')}
              </p>
            </div>
            <button
              id="btn-create-first-roadmap"
              onClick={openCreateRoadmapModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createFirstRoadmapButton')}</span>
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
                          aria-label={t('editRoadmapButton')}
                          title={t('editRoadmapButton')}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-roadmap-${roadmap.id}`}
                          onClick={(e) => handleDeleteRoadmap(e, roadmap)}
                          aria-label={t('deleteRoadmapButton')}
                          title={t('deleteRoadmapButton')}
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
                        {rProg
                          ? `${rProg.completedTasks}/${rProg.totalTasks} ${t('tasksPlural')}`
                          : `0 ${t('tasksPlural')}`}
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
                      <span>
                        {rProg
                          ? `${rProg.totalActualMinutes}${t('minutesUnit')} ${t('loggedSuffix')}`
                          : `0${t('minutesUnit')} ${t('loggedSuffix')}`}
                      </span>
                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
                        <span>{t('detailsAction')}</span>
                        <ChevronRight className="w-3 h-3 rtl:rotate-180" />
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

      {/* Delete Goal Confirmation Modal */}
      {isDeleteGoalModalOpen && (
        <div
          id="delete-goal-detail-modal-backdrop"
          data-testid="delete-goal-detail-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            id="delete-goal-detail-modal"
            data-testid="delete-goal-detail-modal"
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deleteGoalTitle')}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('confirmDeleteGoalPrefix')}{' '}
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    "{goal.title}"
                  </span>
                  ?
                </p>
                <p className="text-[11px] text-neutral-400 mt-2">
                  {t('deleteGoalIntegrityNote')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                id="btn-cancel-detail-delete-goal"
                data-testid="btn-cancel-detail-delete-goal"
                type="button"
                onClick={() => setIsDeleteGoalModalOpen(false)}
                disabled={isDeletingGoal}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                id="btn-confirm-detail-delete-goal"
                data-testid="btn-confirm-detail-delete-goal"
                type="button"
                onClick={handleDeleteGoal}
                disabled={isDeletingGoal}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isDeletingGoal ? t('deleting') : t('confirmDeleteAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Roadmap Confirmation Modal */}
      {roadmapToDelete && (
        <div
          id="delete-roadmap-modal-backdrop"
          data-testid="delete-roadmap-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            id="delete-roadmap-modal"
            data-testid="delete-roadmap-modal"
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deleteRoadmapTitle')}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('confirmDeleteRoadmapPrefix')}{' '}
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    "{roadmapToDelete.title}"
                  </span>
                  ?
                </p>
                <p className="text-[11px] text-neutral-400 mt-2">
                  {t('deleteRoadmapIntegrityNote')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                id="btn-cancel-delete-roadmap"
                data-testid="btn-cancel-delete-roadmap"
                type="button"
                onClick={() => setRoadmapToDelete(null)}
                disabled={isDeletingRoadmap}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                id="btn-confirm-delete-roadmap"
                data-testid="btn-confirm-delete-roadmap"
                type="button"
                onClick={handleConfirmDeleteRoadmap}
                disabled={isDeletingRoadmap}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isDeletingRoadmap ? t('deleting') : t('confirmDeleteAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
