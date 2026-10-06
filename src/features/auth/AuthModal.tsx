/**
 * Authentication Modal
 *
 * Provides student/teacher Sign In and Sign Up flows with:
 * - Safe password handling (never logged or exposed)
 * - Server URL configuration
 * - Graceful network/offline messaging
 * - Zero loss of local data
 */

import React, { useState, useEffect } from 'react';
import { useSync } from '../../sync/context/SyncContext';
import { getDefaultServerUrl, isValidServerUrl } from '../../sync/config/serverConfig';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  X,
  LogIn,
  UserPlus,
  Shield,
  Server,
  AlertCircle,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signIn,
    signUp,
    isAuthenticating,
    authError,
    clearAuthError,
    serverUrl,
  } = useSync();
  const { preferences } = useUserPreferences();
  const t = (key: any) => getTranslation(key, preferences.language);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [customServerUrl, setCustomServerUrl] = useState(() =>
    isValidServerUrl(serverUrl) ? serverUrl : getDefaultServerUrl()
  );
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isValidServerUrl(serverUrl)) {
      setCustomServerUrl(serverUrl);
    }
  }, [serverUrl]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !email.includes('@')) {
      setLocalError(t('errInvalidEmail'));
      return;
    }
    if (!password || password.length < 6) {
      setLocalError(t('errPasswordShort'));
      return;
    }

    if (showServerConfig && customServerUrl.trim()) {
      if (!isValidServerUrl(customServerUrl)) {
        setLocalError(t('errServerUrlInvalid'));
        return;
      }
    }

    try {
      if (mode === 'signin') {
        await signIn(email, password, customServerUrl);
      } else {
        await signUp(email, password, role, customServerUrl);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      // Error handled by SyncContext / authError
    }
  };

  const errorMessage = localError || authError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-sm font-bold text-neutral-900 dark:text-neutral-100"
              >
                {mode === 'signin' ? t('signInToApp') : t('createAccount')}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {t('authModalSub')}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            aria-label={t('closeModal')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setLocalError(null);
              clearAuthError();
            }}
            className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'signin'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t('signIn')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setLocalError(null);
              clearAuthError();
            }}
            className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'signup'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('signUpTab')}</span>
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="leading-relaxed">
              <span className="font-semibold block">{t('authNotice')}</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              {t('emailAddress')}
            </label>
            <input
              id="auth-input-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              {t('passwordLabel')}
            </label>
            <input
              id="auth-input-password"
              type="password"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white font-mono"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                {t('accountRoleLabel')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium text-left rtl:text-right cursor-pointer transition ${
                    role === 'student'
                      ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="font-semibold">{t('roleStudent')}</div>
                  <div className="text-[10px] opacity-80">{t('roleStudentDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium text-left rtl:text-right cursor-pointer transition ${
                    role === 'teacher'
                      ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="font-semibold">{t('roleTeacher')}</div>
                  <div className="text-[10px] opacity-80">{t('roleTeacherDesc')}</div>
                </button>
              </div>
            </div>
          )}

          {/* Advanced Server Configuration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Server className="w-3 h-3" />
              <span>{showServerConfig ? t('hideServerConfig') : t('serverConnectionUrl')}</span>
            </button>

            {showServerConfig && (
              <div className="mt-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                  {t('backendEndpoint')}
                </label>
                <input
                  type="url"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="http://localhost:3001"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-[11px]"
                />
              </div>
            )}
          </div>

          {/* Persistence Guarantee Note */}
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-2 text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed">
            <HardDrive className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{t('localFirstGuaranteeTitle')}</strong> {t('localFirstGuaranteeDesc')}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              id="auth-btn-submit"
              type="submit"
              disabled={isAuthenticating}
              className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>{t('connecting')}</span>
                </>
              ) : (
                <>
                  {mode === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{mode === 'signin' ? t('signInAndSync') : t('createAndSync')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={closeAuthModal}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
