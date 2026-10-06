/**
 * Outbox & Offline Queue Modal
 *
 * Exposes the durable local mutation queue transparently:
 * - Shows pending, in-flight, failed, and synced changes
 * - Displays retry counts and failure details
 * - Strictly read-only: does not permit editing raw internal mutation payloads
 * - Reassures the user that local IndexedDB data remains preserved
 */

import React from 'react';
import { useSync } from '../../sync/context/SyncContext';
import { useUserPreferences, getTranslation, translateStatus } from '../../app/preferences';
import {
  X,
  RefreshCw,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle2,
  Database,
} from 'lucide-react';

export const OutboxModal: React.FC = () => {
  const {
    isOutboxModalOpen,
    closeOutboxModal,
    outboxItems,
    syncNow,
    isSyncing,
    refreshOutbox,
    connectionState,
    syncStatus,
  } = useSync();
  const { preferences, formatNumeral, formatTime } = useUserPreferences();
  const t = (key: any) => getTranslation(key, preferences.language);

  if (!isOutboxModalOpen) return null;

  const pending = outboxItems.filter((i) => i.status === 'pending');
  const inFlight = outboxItems.filter((i) => i.status === 'in_flight');
  const failed = outboxItems.filter((i) => i.status === 'failed');
  const synced = outboxItems.filter((i) => i.status === 'synced');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outbox-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="outbox-modal-title"
                className="text-sm font-bold text-neutral-900 dark:text-neutral-100"
              >
                {t('durableOutboxQueue')}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {t('outboxOfflineTrackingSub')}
              </p>
            </div>
          </div>
          <button
            onClick={closeOutboxModal}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            aria-label={t('closeOutboxModal')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-800 text-center">
          <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider block">
              {t('syncPending')}
            </span>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {formatNumeral(pending.length)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider block">
              {t('inFlight')}
            </span>
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400 font-mono">
              {formatNumeral(inFlight.length)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider block">
              {t('failedLabel')}
            </span>
            <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
              {formatNumeral(failed.length)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider block">
              {t('syncSynced')}
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatNumeral(synced.length)}
            </span>
          </div>
        </div>

        {/* Reassurance Banner */}
        <div className="mx-6 my-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-300">
          <HardDrive className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div className="leading-relaxed">
            <span className="font-semibold block">{t('localDataSafeIndexedDb')}</span>
            <span>
              {t('localDataSafeIndexedDbDesc')}
            </span>
          </div>
        </div>

        {/* Mutation Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
          {outboxItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {t('outboxEmpty')}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {t('outboxEmptyDesc')}
              </div>
            </div>
          ) : (
            outboxItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between text-xs gap-3 shadow-2xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {item.mutation.entityType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.mutation.operation === 'create'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : item.mutation.operation === 'update'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {item.mutation.operation.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400 truncate">
                      ID: {item.mutation.entityId.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatTime(item.createdAt)}
                    </span>
                    {item.retryCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {t('retriesLabel')} {formatNumeral(item.retryCount)}
                      </span>
                    )}
                  </div>

                  {item.lastError && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="truncate">{item.lastError}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'synced'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : item.status === 'in_flight'
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                        : item.status === 'failed'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {translateStatus(item.status, preferences.language)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
          <div className="text-[11px] text-neutral-500 font-mono">
            {t('connectionLabel')} <span className="font-semibold capitalize">{connectionState}</span>
            {syncStatus.lastSyncedAt && (
              <span className="ml-2">
                • {t('lastSyncColon')} {formatTime(syncStatus.lastSyncedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refreshOutbox();
                syncNow();
              }}
              disabled={isSyncing}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? t('syncSyncing') : t('syncNow')}</span>
            </button>
            <button
              onClick={closeOutboxModal}
              className="px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
