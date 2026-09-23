import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, canTransitionTaskStatus } from '../../domain';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  XCircle,
  MoreVertical,
  ChevronDown,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export interface TaskCardProps {
  task: Task;
  onStatusChange: (task: Task, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSelect: (task: Task) => void;
}

export const getPriorityBadge = (priority: TaskPriority) => {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Urgent',
        classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
      };
    case 'high':
      return {
        label: 'High',
        classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      };
    case 'medium':
      return {
        label: 'Medium',
        classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      };
    case 'low':
    default:
      return {
        label: 'Low',
        classes: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
      };
  }
};

export const getStatusConfig = (status: TaskStatus) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        icon: CheckCircle2,
        classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        icon: Clock,
        classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
    case 'blocked':
      return {
        label: 'Blocked',
        icon: AlertTriangle,
        classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: XCircle,
        classes: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
      };
    case 'todo':
    default:
      return {
        label: 'To Do',
        icon: Circle,
        classes: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
      };
  }
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onSelect,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const priorityBadge = getPriorityBadge(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  const allStatuses: TaskStatus[] = ['todo', 'in_progress', 'completed', 'blocked', 'cancelled'];
  const allowableTransitions = allStatuses.filter((s) => s !== task.status && canTransitionTaskStatus(task.status, s));

  // Quick toggle completion if valid
  const handleQuickToggleCompletion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'completed') {
      if (canTransitionTaskStatus(task.status, 'todo')) {
        onStatusChange(task, 'todo');
      }
    } else {
      if (canTransitionTaskStatus(task.status, 'completed')) {
        onStatusChange(task, 'completed');
      }
    }
  };

  return (
    <div
      id={`task-item-${task.id}`}
      onClick={() => onSelect(task)}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-700 transition cursor-pointer"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Quick Checkbox / Status Circle */}
        <button
          id={`btn-toggle-task-${task.id}`}
          onClick={handleQuickToggleCompletion}
          title={task.status === 'completed' ? 'Reopen task (To Do)' : 'Mark as Completed'}
          className={`shrink-0 mt-0.5 p-1 rounded-md transition cursor-pointer ${
            task.status === 'completed'
              ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
              : 'text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400'
          }`}
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 fill-emerald-100 dark:fill-emerald-950/80" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        {/* Task Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              id={`task-title-${task.id}`}
              className={`text-sm font-semibold tracking-tight transition ${
                task.status === 'completed'
                  ? 'line-through text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {task.title}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 max-w-xl">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2.5 text-xs text-neutral-400 pt-0.5 flex-wrap">
            {/* Priority Badge */}
            <span
              id={`task-priority-${task.id}`}
              className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-semibold border ${priorityBadge.classes}`}
            >
              {priorityBadge.label}
            </span>

            {/* Estimated time */}
            {task.estimatedMinutes > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                <Clock className="w-3 h-3" />
                <span>{task.estimatedMinutes}m est.</span>
              </span>
            )}

            {/* Completed date if available */}
            {task.completedAt && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                Done {new Date(task.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div
        className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status transition dropdown */}
        <div className="relative">
          <button
            id={`btn-status-dropdown-${task.id}`}
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${statusConfig.classes}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusConfig.label}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isStatusDropdownOpen && (
            <div
              id={`status-menu-${task.id}`}
              className="absolute right-0 mt-1 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-20 text-xs"
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
                      id={`opt-status-${statusOption}-${task.id}`}
                      onClick={() => {
                        setIsStatusDropdownOpen(false);
                        onStatusChange(task, statusOption);
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

        {/* Quick Edit */}
        <button
          id={`btn-edit-task-${task.id}`}
          onClick={() => onEdit(task)}
          title="Edit Task"
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        {/* Quick Delete */}
        <button
          id={`btn-delete-task-${task.id}`}
          onClick={() => onDelete(task)}
          title="Delete Task"
          className="p-1.5 rounded-md text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* View Details Link */}
        <button
          id={`btn-view-task-${task.id}`}
          onClick={() => onSelect(task)}
          title="View Task Details"
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
