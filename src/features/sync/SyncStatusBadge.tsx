/**
 * Header Sync Status Indicator & Quick Popover
 *
 * Shows real-time connection state, pending mutations, and manual sync action.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSync } from '../../sync/context/SyncContext';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  LogIn,
  CheckCircle2,
  HardDrive,
  Clock,
  ExternalLink,
} from 'lucide-react';

function sanitizeErrorMessage(error?: string): string | null {
  if (!error) return null;
  const lower = error.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('networkerror')
  ) {
    return 'Unable to reach sync server. Check network connection.';
  }
  if (
    lower.includes('unauthorized') ||
    lower.includes('auth') ||
    lower.includes('token') ||
    lower.includes('401')
  ) {
    return 'Authentication required. Please sign in to sync.';
  }
  if (
    lower.includes('500') ||
    lower.includes('internal') ||
    lower.includes('database') ||
    lower.includes('postgres')
  ) {
    return 'Sync service temporarily unavailable. Local data is safely saved.';
  }
  // Sanitize any potential URLs, keys, or internal stack strings
  const sanitized = error
    .replace(/https?:\/\/[^\s]+/g, '[server]')
    .replace(/password=[^\s&]+/g, 'password=***')
    .replace(/secret=[^\s&]+/g, 'secret=***');
  return sanitized.length > 120 ? `${sanitized.slice(0, 120)}...` : sanitized;
}

export const SyncStatusBadge: React.FC = () => {
  const {
    connectionState,
    syncStatus,
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    isAuthenticated,
    openAuthModal,
    openOutboxModal,
    session,
  } = useSync();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getStatusLabel = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'offline':
        return 'Offline';
      case 'server_unavailable':
        return 'Server unavailable';
      case 'auth_required':
        return 'Authentication required';
      case 'connecting':
        return 'Syncing...';
      case 'error':
      default:
        return 'Sync error';
    }
  };

  // Color & Icon mapping based on SyncConnectionState
  const renderBadgeContent = () => {
    switch (connectionState) {
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">Syncing...</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-sky-200 dark:bg-sky-900 rounded-full text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </div>
        );

      case 'offline':
        return (
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <CloudOff className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Offline</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-full text-[10px] font-mono font-semibold">
                {pendingCount}
              </span>
            )}
          </div>
        );

      case 'auth_required':
        return (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <LogIn className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Authentication required</span>
          </div>
        );

      case 'server_unavailable':
        return (
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Server unavailable</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 rounded-full text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Sync error</span>
            {failedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 rounded-full text-[10px] font-mono">
                {failedCount}
              </span>
            )}
          </div>
        );

      case 'connected':
      default:
        return (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Connected</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-full text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </div>
        );
    }
  };

  const getContainerClass = () => {
    switch (connectionState) {
      case 'connecting':
        return 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800';
      case 'offline':
        return 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700';
      case 'auth_required':
        return 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800';
      case 'server_unavailable':
      case 'error':
        return 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800';
      case 'connected':
      default:
        return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id="btn-header-sync-status"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition shadow-2xs ${getContainerClass()}`}
        title="Synchronization status. Click for details."
      >
        {renderBadgeContent()}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl p-4 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-neutral-500" />
              <span>Sync Status</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getContainerClass()}`}
            >
              {getStatusLabel()}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2 text-neutral-600 dark:text-neutral-400">
            <div className="flex justify-between items-center text-[11px]">
              <span>Account:</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[150px]">
                {isAuthenticated ? session?.user.email : 'Local only (Offline)'}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span>Pending mutations:</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                {pendingCount}
              </span>
            </div>

            {failedCount > 0 && (
              <div className="flex justify-between items-center text-[11px] text-rose-600 dark:text-rose-400">
                <span>Failed mutations:</span>
                <span className="font-mono font-semibold">{failedCount}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-[11px]">
              <span>Last sync:</span>
              <span className="font-mono text-neutral-500">
                {syncStatus.lastSyncedAt
                  ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>

            {sanitizeErrorMessage(syncStatus.lastError) && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300 leading-tight">
                {sanitizeErrorMessage(syncStatus.lastError)}
              </div>
            )}
          </div>

          {/* Local-first Reassurance */}
          <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-[10px] text-neutral-500 flex items-start gap-1.5">
            <HardDrive className="w-3 h-3 shrink-0 mt-0.5 text-neutral-400" />
            <span>Local data is saved to IndexedDB first. Sync acts as replica.</span>
          </div>

          {/* Actions */}
          <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openOutboxModal();
              }}
              className="text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Outbox</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  syncNow();
                }}
                disabled={isSyncing}
                className="px-3 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openAuthModal();
                }}
                className="px-3 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3 h-3" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
