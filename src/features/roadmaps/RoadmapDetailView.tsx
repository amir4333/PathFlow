import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Goal, Roadmap, Task, TaskPriority, TaskStatus } from '../../domain';
import { RoadmapDetailedProgress } from '../../domain/services/progressReview';
import {
  MapPin,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Target,
  Edit3,
  Layers,
} from 'lucide-react';
import { RoadmapFormModal } from './RoadmapFormModal';
import { TaskList } from '../tasks/TaskList';

interface RoadmapDetailViewProps {
  roadmapId: string;
}

export const RoadmapDetailView: React.FC<RoadmapDetailViewProps> = ({ roadmapId }) => {
  const { navigate } = useRouter();
  const application = useApplication();

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [parentGoal, setParentGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<RoadmapDetailedProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit Roadmap Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadRoadmapData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setActionError(null);

      const fetchedRoadmap = await application.roadmaps.getRoadmap(roadmapId);
      setRoadmap(fetchedRoadmap);

      // Fetch parent goal
      try {
        const goal = await application.goals.getGoal(fetchedRoadmap.goalId);
        setParentGoal(goal);
      } catch (err) {
        console.warn(`Parent goal ${fetchedRoadmap.goalId} not found`, err);
      }

      // Fetch tasks for roadmap
      try {
        const fetchedTasks = await application.tasks.listTasksForRoadmap(roadmapId);
        setTasks(fetchedTasks);
      } catch (err) {
        console.error('Failed to load tasks for roadmap', err);
      }

      // Fetch derived progress using real tasks
      try {
        const rProg = await application.progress.getRoadmapProgress(roadmapId);
        setProgress(rProg);
      } catch (err) {
        console.error('Failed to compute roadmap progress', err);
      }
    } catch (err: unknown) {
      console.error('Failed to load roadmap details', err);
      setError(err instanceof Error ? err.message : 'Roadmap not found or failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [application, roadmapId]);

  useEffect(() => {
    loadRoadmapData();
  }, [loadRoadmapData]);

  const handleUpdateRoadmap = async (data: { title: string; description: string }) => {
    if (!roadmap) return;
    await application.roadmaps.updateRoadmap(roadmap.id, {
      title: data.title,
      description: data.description,
    });
    await loadRoadmapData();
  };

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    estimatedMinutes?: number;
  }) => {
    try {
      setActionError(null);
      await application.tasks.createTask({
        roadmapId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        estimatedMinutes: data.estimatedMinutes,
      });
      await loadRoadmapData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create task.');
      throw err;
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    data: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      estimatedMinutes?: number;
    }
  ) => {
    try {
      setActionError(null);
      await application.tasks.updateTask(taskId, data);
      await loadRoadmapData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update task.');
      throw err;
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      setActionError(null);
      await application.tasks.transitionTaskStatus(task.id, newStatus);
      await loadRoadmapData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to change task status.');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      setActionError(null);
      await application.tasks.deleteTask(task.id);
      await loadRoadmapData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete task.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-neutral-500">
        Loading roadmap details...
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => navigate('roadmaps')}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Roadmaps</span>
        </button>

        <div className="p-8 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {error || 'Roadmap Not Found'}
          </h2>
          <p className="text-xs text-neutral-500">
            The requested roadmap milestone could not be found in local IndexedDB persistence.
          </p>
          <button
            onClick={() => navigate('roadmaps')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 cursor-pointer"
          >
            Return to Roadmaps
          </button>
        </div>
      </div>
    );
  }

  const taskPct = progress ? progress.taskCompletionPercentage : 0;
  const timePct = progress ? progress.timeCompletionPercentage : 0;

  return (
    <div id="roadmap-detail-view" className="max-w-5xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-from-roadmap"
          onClick={() => {
            if (parentGoal) {
              navigate('goals', { id: parentGoal.id });
            } else {
              navigate('roadmaps');
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{parentGoal ? `Back to Goal: ${parentGoal.title}` : 'Back to Roadmaps'}</span>
        </button>

        <button
          id="btn-edit-roadmap-top"
          onClick={() => setIsEditModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Roadmap</span>
        </button>
      </div>

      {actionError && (
        <div
          id="roadmap-detail-action-error"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Roadmap Header Card */}
      <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <MapPin className="w-3 h-3 text-emerald-500" />
                Roadmap Milestone
              </span>

              {parentGoal && (
                <button
                  onClick={() => navigate('goals', { id: parentGoal.id })}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
                >
                  <Target className="w-3 h-3 text-neutral-400" />
                  <span>Goal: {parentGoal.title}</span>
                </button>
              )}

              <span className="text-xs font-mono text-neutral-400">ID: {roadmap.id}</span>
            </div>

            <h1 id="roadmap-detail-title" className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {roadmap.title}
            </h1>

            {roadmap.description ? (
              <p id="roadmap-detail-description" className="text-sm text-neutral-600 dark:text-neutral-300 max-w-3xl leading-relaxed whitespace-pre-wrap">
                {roadmap.description}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">No description provided for this milestone pathway.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-neutral-500 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6 min-w-[190px]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Created: {new Date(roadmap.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Updated: {new Date(roadmap.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {progress?.totalTasks ?? 0} Tasks Assigned
              </span>
            </div>
          </div>
        </div>

        {/* Derived Roadmap Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Task Velocity
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {taskPct}%
              </span>
              <span className="text-xs text-neutral-400">
                ({progress?.completedTasks ?? 0}/{progress?.totalTasks ?? 0})
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Active / In Progress
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.inProgressTasks ?? 0}
              </span>
              <span className="text-xs text-neutral-400">tasks active</span>
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
              Estimated Work
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {progress?.totalEstimatedMinutes ?? 0}m
              </span>
              <span className="text-xs text-neutral-400">total estimate</span>
            </div>
          </div>
        </div>

        {/* Progress bar visualizer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Milestone Completion Progress</span>
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

      {/* Task Section */}
      <TaskList
        roadmapId={roadmap.id}
        roadmapTitle={roadmap.title}
        tasks={tasks}
        onRefresh={loadRoadmapData}
        onSelectTask={(task) => navigate('tasks', { id: task.id })}
        onStatusChange={handleStatusChange}
        onUpdateTask={handleUpdateTask}
        onCreateTask={handleCreateTask}
        onDeleteTask={handleDeleteTask}
        errorMessage={actionError}
      />

      {/* Edit Roadmap Modal */}
      <RoadmapFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        goalTitle={parentGoal?.title}
        initialData={roadmap}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateRoadmap}
      />
    </div>
  );
};
