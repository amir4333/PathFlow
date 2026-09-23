/**
 * Move Plan Item Modal
 *
 * Clean, accessible dialog for moving a WeeklyPlanItem between days
 * or between a specific day and flexible weekly commitment.
 * Enforces ISO week boundaries and catches domain validation constraints.
 */

import React, { useState } from 'react';
import { WeeklyPlanItem } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  getDaysInWeek,
  getDayNameTranslationKey,
  WeekDayOption,
} from './weeklyPlanHelpers';
import { X, ArrowRightLeft, Calendar, Sparkles, AlertCircle, Check } from 'lucide-react';

interface MovePlanItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WeeklyPlanItem | null;
  taskTitle: string;
  weekIdentifier: string;
  onMove: (itemId: string, newTargetDate?: string) => Promise<void>;
}

export const MovePlanItemModal: React.FC<MovePlanItemModalProps> = ({
  isOpen,
  onClose,
  item,
  taskTitle,
  weekIdentifier,
  onMove,
}) => {
  const { formatDate, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) =>
    getTranslation(key, preferences.language);

  const [selectedDestination, setSelectedDestination] = useState<string | 'flexible'>('flexible');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const weekDays: WeekDayOption[] = React.useMemo(() => {
    return getDaysInWeek(weekIdentifier);
  }, [weekIdentifier]);

  // Sync initial selection when item opens
  React.useEffect(() => {
    if (!isOpen || !item) return;
    setErrorMessage(null);
    setIsSubmitting(false);
    setSelectedDestination(item.targetDate ? item.targetDate : 'flexible');
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleConfirmMove = async (destination: string | 'flexible') => {
    setErrorMessage(null);
    const newTargetDate = destination === 'flexible' ? undefined : destination;

    // If already on this day, just close
    const currentTarget = item.targetDate || undefined;
    if (newTargetDate === currentTarget) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      await onMove(item.id, newTargetDate);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to move weekly plan item', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to move plan item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-plan-item-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-900 dark:text-neutral-100 transition-all my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="move-plan-item-title"
                className="text-base font-bold text-neutral-900 dark:text-neutral-100"
              >
                {t('moveTo')}
              </h2>
              <p className="text-xs text-neutral-500 truncate max-w-[240px]">
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500 mb-3">
            {t('selectDestinationDay')}:
          </p>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {/* Flexible Option */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirmMove('flexible')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition cursor-pointer text-start ${
                !item.targetDate
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold">{t('flexibleWeekly')}</div>
                  <div className="text-[11px] text-neutral-400">
                    {t('flexibleCommitmentsDesc')}
                  </div>
                </div>
              </div>
              {!item.targetDate && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-semibold">
                  Current
                </span>
              )}
            </button>

            {/* 7 Days of the week */}
            {weekDays.map((day) => {
              const dayKey = getDayNameTranslationKey(day.dayOfWeek);
              const dayName = t(dayKey);
              const formattedDate = formatDate(day.dateIso, {
                month: 'short',
                day: 'numeric',
              });
              const isCurrentDay = item.targetDate === day.dateIso;

              return (
                <button
                  key={day.dateIso}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleConfirmMove(day.dateIso)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition cursor-pointer text-start ${
                    isCurrentDay
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <span className="font-semibold">{dayName}</span>
                      <span className="text-neutral-400 ml-2 font-mono">
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                  {isCurrentDay && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold">
                      Current
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer transition disabled:opacity-50"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
