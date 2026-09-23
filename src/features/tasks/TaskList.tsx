import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '../../domain';
import { TaskCard } from './TaskCard';
import { TaskFormModal } from './TaskFormModal';
import { Plus, CheckSquare, Filter, AlertCircle } from 'lucide-react';

interface TaskListProps {
  roadmapId: string;
  roadmapTitle?: string;
  tasks: Task[];
  onRefresh: () => Promise<void>;
  onSelectTask: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: TaskStatus) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    data: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      estimatedMinutes?: number;
    }
  ) => Promise<void>;
  onCreateTask: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    estimatedMinutes?: number;
  }) => Promise<void>;
  onDeleteTask: (task: Task) => Promise<void>;
  errorMessage?: string | null;
}

export const TaskList: React.FC<TaskListProps> = ({
  roadmapId,
  roadmapTitle,
  tasks,
  onRefresh,
  onSelectTask,
  onStatusChange,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  errorMessage,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Delete Confirmation State
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleOpenCreate = () => {
    setSelectedTask(null);
    setModalMode('create');
    setIsModalOpen(true);
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
    if (modalMode === 'create') {
      await onCreateTask(data);
    } else if (selectedTask) {
      await onUpdateTask(selectedTask.id, data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteTask(taskToDelete);
      setTaskToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="roadmap-tasks-section" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Milestone Action Units & Tasks</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {tasks.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-500">
            Discrete actionable work units mapped directly to this roadmap milestone.
          </p>
        </div>

        <button
          id="btn-create-task-roadmap"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Action/Constraint Error notification if any */}
      {errorMessage && (
        <div
          id="task-list-error-banner"
          className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Action Constraint:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Filter Toolbar (Visible when tasks exist) */}
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
                id={`filter-status-${s}`}
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

          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-medium">Priority:</span>
            <select
              id="filter-priority-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Task List Items or Empty State */}
      {tasks.length === 0 ? (
        <div
          id="task-list-empty-state"
          className="p-8 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl space-y-3"
        >
          <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              No tasks created yet
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Decompose this milestone roadmap into concrete, focused action units to begin tracking execution.
            </p>
          </div>
          <div className="pt-2">
            <button
              id="btn-create-first-task"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Task</span>
            </button>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-6 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-500">
          No tasks match the active status/priority filter.
        </div>
      ) : (
        <div id="tasks-container" className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={onSelectTask}
              onStatusChange={onStatusChange}
              onEdit={handleOpenEdit}
              onDelete={(t) => setTaskToDelete(t)}
            />
          ))}
        </div>
      )}

      {/* Task Form Modal (Create / Edit) */}
      <TaskFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={selectedTask}
        roadmapTitle={roadmapTitle}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div
          id="delete-task-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div
            id="delete-task-modal"
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
                id="btn-cancel-delete-task"
                onClick={() => setTaskToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-task"
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
