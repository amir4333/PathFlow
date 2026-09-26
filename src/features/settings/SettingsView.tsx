import React, { useState } from 'react';
import { useUserPreferences } from '../../app/preferences';
import { useSync } from '../../sync/context/SyncContext';
import { TeacherPermission, ALL_TEACHER_PERMISSIONS } from '../../sync/types';
import {
  Languages,
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  Database,
  HardDrive,
  Cloud,
  Server,
  RefreshCw,
  LogIn,
  LogOut,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Key,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    preferences,
    setLanguage,
    setCalendar,
    formatDate,
    formatTime,
    formatDurationMinutes,
    t,
  } = useUserPreferences();

  const {
    session,
    isAuthenticated,
    signOut,
    openAuthModal,
    serverUrl,
    setServerUrl,
    connectionState,
    syncStatus,
    syncNow,
    isSyncing,
    pendingCount,
    failedCount,
    openOutboxModal,
    teacherGrants,
    createTeacherGrant,
    revokeTeacherGrant,
    isLoadingGrants,
  } = useSync();

  // Local state for server URL editing
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [isUrlSaved, setIsUrlSaved] = useState(false);

  // Local state for creating teacher grant
  const [isCreatingGrant, setIsCreatingGrant] = useState(false);
  const [grantLabel, setGrantLabel] = useState('');
  const [grantTtl, setGrantTtl] = useState('30');
  const [selectedPermissions, setSelectedPermissions] = useState<TeacherPermission[]>([
    ...ALL_TEACHER_PERMISSIONS,
  ]);
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const sampleIsoDate = '2026-09-23T14:30:00.000Z';
  const now = new Date();

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setServerUrl(urlInput);
    setIsUrlSaved(true);
    setTimeout(() => setIsUrlSaved(false), 2000);
  };

  const togglePermission = (perm: TeacherPermission) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    if (!grantLabel.trim()) {
      setGrantError('Grant label or mentor name is required.');
      return;
    }
    if (selectedPermissions.length === 0) {
      setGrantError('At least one read-only permission must be selected.');
      return;
    }

    setIsSubmittingGrant(true);
    try {
      const ttlDays = parseInt(grantTtl, 10);
      await createTeacherGrant(
        grantLabel.trim(),
        selectedPermissions,
        isNaN(ttlDays) ? 30 : ttlDays
      );
      setGrantLabel('');
      setIsCreatingGrant(false);
    } catch (err: any) {
      setGrantError(err.message || 'Failed to create grant');
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  const handleCopyToken = (token: string, grantId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(grantId);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  return (
    <div id="settings-view" className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <span>{t('settingsTitle')}</span>
        </h1>
        <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
          {t('settingsDesc')}
        </p>
      </div>

      {/* 1. ACCOUNT & SYNCHRONIZATION SECTION */}
      <section
        id="account-and-sync-section"
        aria-labelledby="account-sync-heading"
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
          <Cloud className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          <h2 id="account-sync-heading" className="text-base font-bold">
            {t('accountAndSync')}
          </h2>
        </div>
        <p className="text-xs text-neutral-500 max-w-2xl leading-relaxed">
          {t('accountAndSyncDesc')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Account Status Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  Account Status
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isAuthenticated
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {isAuthenticated ? 'Authenticated' : 'Offline / Local'}
                </span>
              </div>

              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {session?.user.email}
                  </div>
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <span className="capitalize">{session?.user.role} role</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">ID: {session?.user.id.slice(0, 8)}...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('workingLocally')}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Data is safely preserved in IndexedDB. Sign in to synchronize your goals and sessions across other devices.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
              {isAuthenticated ? (
                <button
                  id="btn-settings-signout"
                  type="button"
                  onClick={signOut}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-100 transition cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('signOutAction')}</span>
                </button>
              ) : (
                <button
                  id="btn-settings-signin"
                  type="button"
                  onClick={openAuthModal}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t('signInAction')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Remote Sync & Outbox Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  Sync & Outbox
                </span>
                <span className="text-xs font-mono font-medium text-neutral-500 capitalize">
                  {connectionState.replace('_', ' ')}
                </span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                    {t('pendingChangesLabel')}
                  </span>
                  <span className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                    {pendingCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                    {t('lastSyncLabel')}
                  </span>
                  <span className="text-xs font-bold font-mono text-neutral-900 dark:text-neutral-100 truncate block mt-0.5">
                    {syncStatus.lastSyncedAt
                      ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                      : t('neverSynced')}
                  </span>
                </div>
              </div>

              {failedCount > 0 && (
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {failedCount} mutation(s) pending retry. Local data is fully safe.
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={openOutboxModal}
                className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>{t('outboxQueueLabel')}</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                id="btn-settings-sync-now"
                type="button"
                onClick={syncNow}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? t('syncingAction') : t('syncNowAction')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Server Endpoint URL Configuration Form */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-neutral-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              {t('serverEndpoint')}
            </span>
          </div>

          <form onSubmit={handleSaveUrl} className="flex flex-col sm:flex-row gap-2">
            <input
              id="settings-input-server-url"
              type="url"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:3001"
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
            />
            <div className="flex items-center gap-2">
              <button
                id="settings-btn-save-server-url"
                type="submit"
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer flex items-center gap-1.5"
              >
                {isUrlSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isUrlSaved ? 'Saved' : 'Save URL'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('http://localhost:3001');
                  setServerUrl('http://localhost:3001');
                }}
                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </form>
        </div>

        {/* Teacher Access Grants Section */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t('teacherAccessTitle')}</span>
              </div>
              <p className="text-xs text-neutral-500 max-w-xl leading-relaxed">
                {t('teacherAccessDesc')}
              </p>
            </div>

            {isAuthenticated && !isCreatingGrant && (
              <button
                id="btn-settings-open-create-grant"
                type="button"
                onClick={() => setIsCreatingGrant(true)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{t('issueGrantButton')}</span>
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-500 text-center">
              Sign in with your student account to issue and manage teacher access grants.
            </div>
          ) : (
            <>
              {/* Inline Create Grant Form */}
              {isCreatingGrant && (
                <form
                  onSubmit={handleCreateGrant}
                  className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-3"
                >
                  <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                    Issue Scoped Read-Only Token
                  </div>

                  {grantError && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{grantError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Mentor or Teacher Label
                      </label>
                      <input
                        id="grant-input-label"
                        type="text"
                        required
                        value={grantLabel}
                        onChange={(e) => setGrantLabel(e.target.value)}
                        placeholder="e.g., Prof. Davis (Research Advisor)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Validity Period (Days)
                      </label>
                      <input
                        id="grant-input-ttl"
                        type="number"
                        min="1"
                        max="365"
                        value={grantTtl}
                        onChange={(e) => setGrantTtl(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Granular Read Permissions
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {ALL_TEACHER_PERMISSIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[11px] text-neutral-800 dark:text-neutral-200 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm)}
                            onChange={() => togglePermission(perm)}
                            className="rounded text-neutral-900 focus:ring-neutral-900"
                          />
                          <span className="font-mono">{perm.replace('read:', '')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      id="grant-btn-submit"
                      type="submit"
                      disabled={isSubmittingGrant}
                      className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingGrant ? 'Generating...' : 'Generate Read-Only Grant'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingGrant(false)}
                      className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Grants List */}
              <div className="space-y-2">
                {isLoadingGrants ? (
                  <div className="text-xs text-neutral-400 py-4 text-center">
                    Loading teacher access grants...
                  </div>
                ) : teacherGrants.length === 0 ? (
                  <div className="text-xs text-neutral-400 py-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                    No teacher access grants issued yet.
                  </div>
                ) : (
                  teacherGrants.map((grant) => (
                    <div
                      key={grant.id}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">
                            {grant.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              grant.isActive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {grant.isActive ? 'Active' : 'Revoked'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                          <span>Scopes:</span>
                          {grant.permissions.map((p) => (
                            <span
                              key={p}
                              className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono"
                            >
                              {p.replace('read:', '')}
                            </span>
                          ))}
                        </div>

                        <div className="text-[10px] text-neutral-400 font-mono">
                          Expires: {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : 'Never'}
                          {grant.revokedAt && (
                            <span className="ml-2 text-rose-500">
                              (Revoked on {new Date(grant.revokedAt).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {grant.isActive && (
                          <button
                            type="button"
                            onClick={() => handleCopyToken(grant.token, grant.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                            title="Copy teacher access bearer token"
                          >
                            {copiedTokenId === grant.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-neutral-400" />
                                <span>Copy Token</span>
                              </>
                            )}
                          </button>
                        )}

                        {grant.isActive && (
                          <button
                            type="button"
                            onClick={() => revokeTeacherGrant(grant.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-[11px] font-medium cursor-pointer transition"
                          >
                            {t('revokeGrantButton')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. LANGUAGE & CALENDAR PREFERENCES SECTION (INDEPENDENT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Preference Card */}
        <section
          aria-labelledby="language-preference-heading"
          className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="language-preference-heading"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {t('languageLabel')}
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {t('languageDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              id="pref-lang-en"
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.language === 'en'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('english')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.language === 'en' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Latin numerals (1, 2, 3)
                </div>
              </div>
              {preferences.language === 'en' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>

            <button
              id="pref-lang-fa"
              type="button"
              onClick={() => setLanguage('fa')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.language === 'fa'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('persianLanguage')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.language === 'fa' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  اعداد فارسی (۱، ۲، ۳)
                </div>
              </div>
              {preferences.language === 'fa' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </section>

        {/* Calendar Preference Card */}
        <section
          aria-labelledby="calendar-preference-heading"
          className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="calendar-preference-heading"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {t('calendarLabel')}
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {t('calendarDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              id="pref-cal-gregorian"
              type="button"
              onClick={() => setCalendar('gregorian')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.calendar === 'gregorian'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('gregorianCalendar')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.calendar === 'gregorian' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Standard solar
                </div>
              </div>
              {preferences.calendar === 'gregorian' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>

            <button
              id="pref-cal-persian"
              type="button"
              onClick={() => setCalendar('persian')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition text-left ${
                preferences.calendar === 'persian'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-2xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="font-semibold">{t('persianCalendar')}</div>
                <div className={`text-[10px] mt-0.5 ${preferences.calendar === 'persian' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  Jalali solar
                </div>
              </div>
              {preferences.calendar === 'persian' && (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Live Format Preview Area */}
      <section
        aria-labelledby="preview-heading"
        className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-4"
      >
        <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h2 id="preview-heading" className="text-xs font-bold uppercase tracking-wider">
            {t('previewTitle')}
          </h2>
        </div>
        <p className="text-xs text-neutral-500">
          {t('previewDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Active Settings Pill */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              Active Config
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 capitalize">
              {preferences.language === 'en' ? 'English' : 'فارسی'} • {preferences.calendar}
            </div>
          </div>

          {/* Current Date Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('currentDate')}
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDate(now)}
            </div>
          </div>

          {/* Sample Timestamp Date Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('sampleSessionDate')}
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDate(sampleIsoDate)}
            </div>
          </div>

          {/* Sample Duration & Time Preview */}
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('sampleDuration')} & Time
            </span>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
              {formatDurationMinutes(90)} • {formatTime(sampleIsoDate)}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Offline Local-First Transparency Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
          <Database className="w-4 h-4 text-neutral-500" />
          <span>Architecture & Persistence Guarantee</span>
        </div>
        <p className="leading-relaxed">
          {t('architectureNotice')}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('offlineNotice')}</span>
        </div>
      </div>
    </div>
  );
};
