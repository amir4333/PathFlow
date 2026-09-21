import React, { useState, useEffect } from 'react';
import { Goal, GoalStatus } from '../../domain';
import { X, AlertCircle } from 'lucide-react';

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; status?: GoalStatus }) => Promise<void>;
  initialData?: Goal | null;
  mode: 'create' | 'edit';
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<GoalStatus>('not_started');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && mode === 'edit') {
        setTitle(initialData.title);
        setDescription(initialData.description || '');
        setStatus(initialData.status);
      } else {
        setTitle('');
        setDescription('');
        setStatus('not_started');
      }
      setError(null);
    }
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Goal title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        status: mode === 'edit' ? status : undefined,
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while saving the goal.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="goal-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="goal-modal-container"
        className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 id="goal-modal-title" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {mode === 'create' ? 'Create New Goal' : 'Edit Goal'}
          </h2>
          <button
            id="btn-close-goal-modal"
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              id="goal-form-error"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="goal-input-title"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5"
            >
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="goal-input-title"
              type="text"
              required
              autoFocus
              placeholder="e.g. Master Distributed Systems Architecture"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="goal-input-description"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5"
            >
              Description <span className="text-neutral-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              id="goal-input-description"
              rows={3}
              placeholder="Provide strategic context, motivations, or criteria for success..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            />
          </div>

          {mode === 'edit' && (
            <div>
              <label
                htmlFor="goal-input-status"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5"
              >
                Status
              </label>
              <select
                id="goal-input-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              id="btn-cancel-goal-modal"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="btn-submit-goal-modal"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <span>{mode === 'create' ? 'Create Goal' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
