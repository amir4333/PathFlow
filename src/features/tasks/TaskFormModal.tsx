import React, { useState, useEffect } from 'react';
import { Task, TaskPriority } from '../../domain';
import { useUserPreferences, getTranslation, translatePriority } from '../../app/preferences';
import { X, AlertCircle } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    estimatedMinutes?: number;
  }) => Promise<void>;
  initialData?: Task | null;
  mode: 'create' | 'edit';
  roadmapTitle?: string;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  roadmapTitle,
}) => {
  const { preferences } = useUserPreferences();
  const lang = preferences.language;
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && mode === 'edit') {
        setTitle(initialData.title);
        setDescription(initialData.description || '');
        setPriority(initialData.priority);
        setEstimatedMinutes(initialData.estimatedMinutes ?? 0);
      } else {
        setTitle('');
        setDescription('');
        setPriority('medium');
        setEstimatedMinutes(0);
      }
      setError(null);
    }
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('taskTitleRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        estimatedMinutes: Math.max(0, Number(estimatedMinutes) || 0),
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorSavingTask');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="task-form-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="task-form-modal"
        className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {mode === 'create' ? t('createTaskButton') : t('editTaskTitle')}
            </h2>
            {roadmapTitle && (
              <p className="text-xs text-neutral-500">
                {t('milestonePrefix')}: <span className="font-medium text-neutral-700 dark:text-neutral-300">{roadmapTitle}</span>
              </p>
            )}
          </div>
          <button
            id="btn-close-task-modal"
            onClick={onClose}
            aria-label={t('closeAction')}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              id="task-form-error"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="task-title-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('taskTitleLabel')} <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('taskTitlePlaceholder')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="task-desc-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('descriptionLabel')} <span className="text-neutral-400 font-normal">{t('optionalSuffix')}</span>
            </label>
            <textarea
              id="task-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('taskDescriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-priority-select" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('priorityLabel')}
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="low">{translatePriority('low', lang)}</option>
                <option value="medium">{t('mediumDefaultPriority')}</option>
                <option value="high">{translatePriority('high', lang)}</option>
                <option value="urgent">{translatePriority('urgent', lang)}</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-estimate-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('estimatedMinutesLabel')} <span className="text-neutral-400 font-normal">{t('optionalSuffix')}</span>
              </label>
              <input
                id="task-estimate-input"
                type="number"
                min="0"
                step="5"
                value={estimatedMinutes === 0 ? '' : estimatedMinutes}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  setEstimatedMinutes(isNaN(val) ? 0 : Math.max(0, val));
                }}
                placeholder={t('taskEstimatePlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              id="btn-cancel-task-form"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              id="btn-submit-task-form"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? t('saving') : mode === 'create' ? t('createTaskButton') : t('saveChangesAction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
