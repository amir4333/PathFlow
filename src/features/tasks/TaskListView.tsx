import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Task, Roadmap, TaskPriority, TaskStatus } from '../../domain';
import { TaskCard } from './TaskCard';
import { TaskFormModal } from './TaskFormModal';
import {
  CheckSquare,
  Filter,
  Plus,
  AlertCircle,
  Clock,
  Layers,
  MapPin,
} from 'lucide-react';

export const TaskListView: React.FC = () => {
  const { navigate } = useRouter();
  const application = useApplication();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [roadmapFilter, setRoadmapFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Delete State
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setActionError(null);
      const [fetchedTasks, fetchedRoadmaps] = await Promise.all([
        application.tasks.listTasks(),
        application.roadmaps.listRoadmaps(),
      ]);
      setTasks(fetchedTasks);
      setRoadmaps(fetchedRoadmaps);
    } catch (err: unknown) {
      console.error('Failed to load tasks', err);
      setActionError(err instanceof Error ? err.message : 'Failed to load tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      setActionError(null);
      await application.tasks.transitionTaskStatus(task.id, newStatus);
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to transition status.');
    }
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    estimatedMinutes?: number;
  }) => {
    if (modalMode === 'edit' && selectedTask) {
      try {
        setActionError(null);
        await application.tasks.updateTask(selectedTask.id, data);
        await loadData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Failed to update task.');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      await application.tasks.deleteTask(taskToDelete.id);
      setTaskToDelete(null);
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  const roadmapMap = new Map(roadmaps.map((r) => [r.id, r]));

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (roadmapFilter !== 'all' && t.roadmapId !== roadmapFilter) return false;
    return true;
  });

  const activeCount = tasks.filter((t) => t.status !== 'cancelled' && t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return (
    <div id="tasks-index-view" className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Tasks & Work Units
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {tasks.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Actionable work units mapped directly to strategic roadmap milestones.
          </p>
        </div>

        {roadmaps.length > 0 && (
          <button
            id="btn-create-task-from-roadmap-nav"
            onClick={() => {
              // Navigate to the first roadmap or user's choice
              navigate('roadmaps', { id: roadmaps[0].id });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer self-start sm:self-auto"
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>Manage via Roadmaps</span>
          </button>
        )}
      </div>

      {actionError && (
        <div
          id="tasks-index-action-error"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Constraint or Transition Error:</span>
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* High-level metrics summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
            Active Backlog
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{activeCount}</span>
            <span className="text-xs text-neutral-400">units</span>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
            Completed Tasks
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</span>
            <span className="text-xs text-neutral-400">/ {tasks.length}</span>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
            Estimated Work
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{totalEstimated}m</span>
            <span className="text-xs text-neutral-400">total</span>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
            Attached Roadmaps
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{roadmaps.length}</span>
            <span className="text-xs text-neutral-400">milestones</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-500 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </span>
            {(['all', 'todo', 'in_progress', 'completed', 'blocked', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer capitalize font-medium ${
                  statusFilter === s
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 font-medium">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {roadmaps.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 font-medium">Roadmap:</span>
                <select
                  value={roadmapFilter}
                  onChange={(e) => setRoadmapFilter(e.target.value)}
                  className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 max-w-[160px] truncate"
                >
                  <option value="all">All Roadmaps</option>
                  {roadmaps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task List Content */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-neutral-500">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl space-y-3">
          <CheckSquare className="w-8 h-8 text-neutral-400 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            No tasks created yet
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Tasks belong directly to Milestone Roadmaps. Open a Roadmap to create its first actionable work unit.
          </p>
          <button
            onClick={() => navigate('roadmaps')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition"
          >
            Go to Roadmaps
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-6 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-500">
          No tasks match the active filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const parentR = roadmapMap.get(task.roadmapId);
            return (
              <div key={task.id} className="space-y-1">
                {parentR && (
                  <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-400">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    <span>Roadmap:</span>
                    <button
                      onClick={() => navigate('roadmaps', { id: parentR.id })}
                      className="hover:underline text-neutral-600 dark:text-neutral-300 font-medium cursor-pointer"
                    >
                      {parentR.title}
                    </button>
                  </div>
                )}
                <TaskCard
                  task={task}
                  onSelect={(t) => navigate('tasks', { id: t.id })}
                  onStatusChange={handleStatusChange}
                  onEdit={handleOpenEdit}
                  onDelete={(t) => setTaskToDelete(t)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={selectedTask}
        roadmapTitle={selectedTask ? roadmapMap.get(selectedTask.roadmapId)?.title : undefined}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div
          id="delete-task-index-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            id="delete-task-index-modal"
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
                  Are you sure you want to delete <span className="font-semibold text-neutral-700 dark:text-neutral-300">"{taskToDelete.title}"</span>?
                </p>
                <p className="text-[11px] text-neutral-400 mt-2">
                  This operation strictly respects historical integrity. Tasks with attached sessions or weekly plans cannot be deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
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
