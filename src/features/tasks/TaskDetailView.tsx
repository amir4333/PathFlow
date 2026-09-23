import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { useActiveSession } from '../sessions/ActiveSessionContext';
import { Task, Roadmap, Goal, TaskStatus, TaskPriority, canTransitionTaskStatus } from '../../domain';
import { TaskFormModal } from './TaskFormModal';
import { getPriorityBadge, getStatusConfig } from './TaskCard';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Target,
  Edit2,
  Trash2,
  ChevronDown,
  Layers,
  Play,
  Square,
} from 'lucide-react';

interface TaskDetailViewProps {
  taskId: string;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ taskId }) => {
  const { navigate } = useRouter();
  const application = useApplication();
  const { activeSession, formattedTime, startSession } = useActiveSession();

  const [task, setTask] = useState<Task | null>(null);
  const [parentRoadmap, setParentRoadmap] = useState<Roadmap | null>(null);
  const [parentGoal, setParentGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Time / sessions derived info
  const [taskSessions, setTaskSessions] = useState<{ count: number; totalMinutes: number }>({
    count: 0,
    totalMinutes: 0,
  });

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Status dropdown
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const loadTaskData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setActionError(null);

      const fetchedTask = await application.tasks.getTask(taskId);
      setTask(fetchedTask);

      // Fetch parent roadmap
      try {
        const roadmap = await application.roadmaps.getRoadmap(fetchedTask.roadmapId);
        setParentRoadmap(roadmap);

        // Fetch parent goal
        try {
          const goal = await application.goals.getGoal(roadmap.goalId);
          setParentGoal(goal);
        } catch (goalErr) {
          console.warn(`Parent Goal ${roadmap.goalId} not found`, goalErr);
        }
      } catch (roadmapErr) {
        console.warn(`Parent Roadmap ${fetchedTask.roadmapId} not found`, roadmapErr);
      }

      // Fetch derived session time if available
      try {
        const sessions = await application.sessions.getSessionsForTask(taskId);
        const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
        setTaskSessions({ count: sessions.length, totalMinutes });
      } catch (sessionErr) {
        console.warn(`Could not fetch sessions for task ${taskId}`, sessionErr);
      }
    } catch (err: unknown) {
      console.error('Failed to load task details', err);
      setError(err instanceof Error ? err.message : 'Task not found or failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [application, taskId]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  const handleUpdateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    estimatedMinutes?: number;
  }) => {
    if (!task) return;
    try {
      setActionError(null);
      await application.tasks.updateTask(task.id, data);
      await loadTaskData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update task.');
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      setActionError(null);
      await application.tasks.transitionTaskStatus(task.id, newStatus);
      await loadTaskData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to change task status.');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      await application.tasks.deleteTask(task.id);
      // Navigate back to roadmap
      if (parentRoadmap) {
        navigate('roadmaps', { id: parentRoadmap.id });
      } else {
        navigate('roadmaps');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete task.');
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-neutral-500">
        Loading task details...
      </div>
    );
  }

  if (error || !task) {
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
            {error || 'Task Not Found'}
          </h2>
          <p className="text-xs text-neutral-500">
            The requested task could not be found in local IndexedDB persistence.
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

  const priorityBadge = getPriorityBadge(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  const allStatuses: TaskStatus[] = ['todo', 'in_progress', 'completed', 'blocked', 'cancelled'];
  const allowableTransitions = allStatuses.filter((s) => s !== task.status && canTransitionTaskStatus(task.status, s));

  return (
    <div id="task-detail-view" className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {parentGoal && (
            <>
              <button
                onClick={() => navigate('goals', { id: parentGoal.id })}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
              >
                <Target className="w-3.5 h-3.5 text-neutral-400" />
                <span>{parentGoal.title}</span>
              </button>
              <span className="text-neutral-400">/</span>
            </>
          )}

          {parentRoadmap ? (
            <button
              id="btn-back-to-parent-roadmap"
              onClick={() => navigate('roadmaps', { id: parentRoadmap.id })}
              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{parentRoadmap.title}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('roadmaps')}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Roadmaps</span>
            </button>
          )}

          <span className="text-neutral-400">/</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Task Details</span>
        </div>

        <div className="flex items-center gap-2">
          {activeSession?.taskId === task?.id ? (
            <button
              id="btn-task-active-session"
              onClick={() => navigate('sessions')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-pointer transition shadow-2xs"
              title="Session currently in progress for this task. Click to open Sessions."
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono">{formattedTime}</span>
              <span>Running</span>
            </button>
          ) : (
            task && task.status !== 'completed' && task.status !== 'cancelled' && (
              <button
                id="btn-start-task-session"
                onClick={async () => {
                  try {
                    await startSession(task.id);
                    navigate('sessions');
                  } catch (err: unknown) {
                    setActionError(err instanceof Error ? err.message : 'Failed to start session');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 cursor-pointer transition shadow-2xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Session</span>
              </button>
            )
          )}

          <button
            id="btn-edit-task-detail"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 cursor-pointer transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            id="btn-delete-task-detail"
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div
          id="task-detail-action-error"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Constraint or Transition Error:</span>
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* Main Task Header Card */}
      <div className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Control */}
              <div className="relative">
                <button
                  id="btn-detail-status-dropdown"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${statusConfig.classes}`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{statusConfig.label}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {isStatusDropdownOpen && (
                  <div
                    id="detail-status-menu"
                    className="absolute left-0 mt-1 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-20 text-xs"
                  >
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold text-neutral-400">
                      Transition to:
                    </div>
                    {allowableTransitions.length === 0 ? (
                      <div className="px-3 py-1.5 text-neutral-400 italic text-[11px]">
                        No valid transitions
                      </div>
                    ) : (
                      allowableTransitions.map((statusOption) => {
                        const optConfig = getStatusConfig(statusOption);
                        const OptIcon = optConfig.icon;
                        return (
                          <button
                            key={statusOption}
                            id={`opt-detail-status-${statusOption}`}
                            onClick={() => {
                              setIsStatusDropdownOpen(false);
                              handleStatusChange(statusOption);
                            }}
                            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                          >
                            <OptIcon className="w-3.5 h-3.5" />
                            <span>{optConfig.label}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Priority Badge */}
              <span
                id="task-detail-priority"
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityBadge.classes}`}
              >
                {priorityBadge.label} Priority
              </span>

              <span className="text-xs font-mono text-neutral-400">ID: {task.id}</span>
            </div>

            <h1 id="task-detail-title" className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {task.title}
            </h1>

            {task.description ? (
              <p id="task-detail-description" className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 italic">No description provided for this work unit.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-xs text-neutral-500 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
            </div>
            {task.completedAt && (
              <div className="flex items-center gap-1.5 pt-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-medium">
                  Completed: {new Date(task.completedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Task Metrics & Derived Time Information */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Estimated Time
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {task.estimatedMinutes}m
              </span>
              <span className="text-xs text-neutral-400">planned</span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Actual Time Invested
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {taskSessions.totalMinutes}m
              </span>
              <span className="text-xs text-neutral-400">logged</span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Execution Sessions
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {taskSessions.count}
              </span>
              <span className="text-xs text-neutral-400">sessions</span>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
              Variance
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-xl font-bold ${
                  taskSessions.totalMinutes > task.estimatedMinutes && task.estimatedMinutes > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}
              >
                {taskSessions.totalMinutes - task.estimatedMinutes}m
              </span>
              <span className="text-xs text-neutral-400">variance</span>
            </div>
          </div>
        </div>

        {/* Strategic Lineage Card */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Strategic Lineage
          </span>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {parentGoal && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300">
                <Target className="w-3.5 h-3.5 text-neutral-400" />
                <span>Goal: {parentGoal.title}</span>
              </span>
            )}

            {parentRoadmap && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>Roadmap: {parentRoadmap.title}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <TaskFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={task}
        roadmapTitle={parentRoadmap?.title}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateTask}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          id="delete-task-detail-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            id="delete-task-detail-modal"
            className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Delete Task
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-neutral-700 dark:text-neutral-300">"{task.title}"</span>?
                </p>
                <p className="text-[11px] text-neutral-400 mt-2">
                  This operation strictly respects historical integrity. Tasks with attached sessions or weekly plans cannot be deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                id="btn-cancel-detail-delete"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-detail-delete"
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
