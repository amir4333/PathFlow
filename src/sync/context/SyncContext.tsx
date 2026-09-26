/**
 * Sync & Account Context and Provider
 *
 * Provides application-wide state for:
 * - Authentication (Sign Up, Sign In, Sign Out)
 * - Server Connection Configuration
 * - Outbox Mutation Inspection
 * - Sync Engine Status & Manual Sync
 * - Teacher Access Grants Management
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  SyncStatus,
  SyncConnectionState,
  SyncOutboxItem,
  TeacherAccessGrant,
  TeacherPermission,
} from '../types';
import { SyncEngine } from '../engine/syncEngine';
import { HttpRemoteSyncClient } from '../engine/httpRemoteSyncClient';
import { createDurableSyncOutbox, SyncOutboxRepository } from '../outbox/syncOutbox';
import { createSyncRecordingRepositories } from '../outbox/syncRecordingRepositories';
import {
  AuthSession,
  AuthUser,
  loadStoredSession,
  saveStoredSession,
  clearStoredSession,
  loginUser,
  registerUser,
  verifyUserSession,
} from '../auth/authSession';
import {
  getStoredServerUrl,
  saveStoredServerUrl,
  getOrCreateDeviceId,
} from '../config/serverConfig';
import { TeacherHttpClient } from '../teacher/teacherClient';
import { PathFlowRepositories, createLocalRepositories } from '../../data/repositories/local';
import { ApplicationServices, createApplicationServices } from '../../application';

export interface SyncContextValue {
  // Account
  readonly session: AuthSession | null;
  readonly isAuthenticated: boolean;
  readonly isAuthenticating: boolean;
  readonly authError: string | null;
  signIn: (email: string, password: string, customServerUrl?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    role?: 'student' | 'teacher',
    customServerUrl?: string
  ) => Promise<void>;
  signOut: () => void;
  clearAuthError: () => void;

  // Server & Connection
  readonly serverUrl: string;
  readonly deviceId: string;
  setServerUrl: (url: string) => void;
  readonly connectionState: SyncConnectionState;
  readonly syncStatus: SyncStatus;
  readonly isSyncing: boolean;
  syncNow: () => Promise<void>;

  // Outbox
  readonly outboxItems: SyncOutboxItem[];
  readonly pendingCount: number;
  readonly failedCount: number;
  refreshOutbox: () => Promise<void>;

  // Modals
  readonly isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  readonly isOutboxModalOpen: boolean;
  openOutboxModal: () => void;
  closeOutboxModal: () => void;

  // Teacher Grants
  readonly teacherGrants: TeacherAccessGrant[];
  readonly isLoadingGrants: boolean;
  createTeacherGrant: (
    label: string,
    permissions?: readonly TeacherPermission[],
    ttlDays?: number
  ) => Promise<TeacherAccessGrant>;
  revokeTeacherGrant: (grantId: string) => Promise<void>;
  refreshTeacherGrants: () => Promise<void>;

  // Services
  readonly services: ApplicationServices;
  readonly repositories: PathFlowRepositories;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export const SyncProvider: React.FC<{
  children: React.ReactNode;
  initialServerUrl?: string;
  customOutbox?: SyncOutboxRepository;
}> = ({ children, initialServerUrl, customOutbox }) => {
  const [serverUrlState, setServerUrlState] = useState<string>(() =>
    initialServerUrl ?? getStoredServerUrl()
  );
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOutboxModalOpen, setIsOutboxModalOpen] = useState(false);

  const [outboxItems, setOutboxItems] = useState<SyncOutboxItem[]>([]);
  const [teacherGrants, setTeacherGrants] = useState<TeacherAccessGrant[]>([]);
  const [isLoadingGrants, setIsLoadingGrants] = useState(false);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const outbox = useMemo(() => customOutbox ?? createDurableSyncOutbox(), [customOutbox]);
  const rawRepositories = useMemo(() => createLocalRepositories(), []);

  // Sync Engine & Remote Client
  const remoteClient = useMemo(() => {
    return new HttpRemoteSyncClient({
      baseUrl: serverUrlState,
      getAuthToken: () => session?.token ?? null,
      timeoutMs: 12000,
    });
  }, [serverUrlState, session?.token]);

  const syncEngine = useMemo(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return new SyncEngine({
      deviceId,
      repositories: rawRepositories,
      outbox,
      remoteClient,
      isOnline,
    });
  }, [deviceId, rawRepositories, outbox, remoteClient]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
    connectionState: !session ? 'auth_required' : 'connected',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
  });

  const refreshOutbox = useCallback(async () => {
    const items = await outbox.getAll();
    setOutboxItems(items);
  }, [outbox]);

  // Recording Repositories Wrapper (captures local writes into outbox)
  const recordingRepositories = useMemo(() => {
    return createSyncRecordingRepositories({
      repositories: rawRepositories,
      outbox,
      getDeviceId: () => deviceId,
      onMutationRecorded: () => {
        refreshOutbox();
        if (session && syncEngine) {
          syncEngine.syncOnce().then(refreshOutbox).catch(() => {});
        }
      },
    });
  }, [rawRepositories, outbox, deviceId, session, syncEngine, refreshOutbox]);

  const services = useMemo(() => {
    return createApplicationServices(recordingRepositories);
  }, [recordingRepositories]);

  // Sync Engine Subscription & Lifecycle
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      // If user is not authenticated, reflect auth_required in connectionState
      const adjustedConnectionState = !session ? 'auth_required' : newStatus.connectionState;
      setSyncStatus({
        ...newStatus,
        connectionState: adjustedConnectionState,
      });
      refreshOutbox();
    });

    if (session) {
      syncEngine.startAutoSync({ intervalMs: 60000 });
      // Trigger initial synchronization on authenticated boot
      syncEngine.syncOnce().then(refreshOutbox).catch(() => {});
    }

    return () => {
      unsubscribe();
      syncEngine.stopAutoSync();
    };
  }, [syncEngine, session, refreshOutbox]);

  // Verify stored session on boot
  useEffect(() => {
    if (!session) return;
    let isCancelled = false;

    verifyUserSession(session.serverUrl || serverUrlState, session.token)
      .then((user) => {
        if (!isCancelled && user) {
          setSession((prev) => (prev ? { ...prev, user } : prev));
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        if (err.statusCode === 401) {
          // Token expired or invalid
          clearStoredSession();
          setSession(null);
          setAuthError('Your session has expired. Please sign in again.');
        }
        // Note: Network errors do NOT clear local session, preserving offline UX!
      });

    return () => {
      isCancelled = true;
    };
  }, [session?.token, serverUrlState]);

  // Load teacher grants if authenticated
  const refreshTeacherGrants = useCallback(async () => {
    if (!session?.token) {
      setTeacherGrants([]);
      return;
    }
    setIsLoadingGrants(true);
    try {
      const client = new TeacherHttpClient(serverUrlState);
      const grants = await client.listGrants(session.token);
      setTeacherGrants(grants);
    } catch (err) {
      // offline or error
    } finally {
      setIsLoadingGrants(false);
    }
  }, [session?.token, serverUrlState]);

  useEffect(() => {
    if (session?.token) {
      refreshTeacherGrants();
    } else {
      setTeacherGrants([]);
    }
  }, [session?.token, refreshTeacherGrants]);

  // Server URL update
  const setServerUrl = useCallback((url: string) => {
    const clean = url.trim().replace(/\/+$/, '');
    saveStoredServerUrl(clean);
    setServerUrlState(clean);
  }, []);

  // Auth actions
  const signIn = useCallback(
    async (email: string, password: string, customServerUrl?: string) => {
      setIsAuthenticating(true);
      setAuthError(null);
      const targetUrl = customServerUrl || serverUrlState;

      try {
        const newSession = await loginUser(targetUrl, email, password);
        setSession(newSession);
        if (customServerUrl) {
          setServerUrl(customServerUrl);
        }
        setIsAuthModalOpen(false);
      } catch (err: any) {
        setAuthError(err.message || 'Login failed');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [serverUrlState, setServerUrl]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      role: 'student' | 'teacher' = 'student',
      customServerUrl?: string
    ) => {
      setIsAuthenticating(true);
      setAuthError(null);
      const targetUrl = customServerUrl || serverUrlState;

      try {
        const newSession = await registerUser(targetUrl, email, password, role);
        setSession(newSession);
        if (customServerUrl) {
          setServerUrl(customServerUrl);
        }
        setIsAuthModalOpen(false);
      } catch (err: any) {
        setAuthError(err.message || 'Registration failed');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [serverUrlState, setServerUrl]
  );

  const signOut = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setTeacherGrants([]);
    syncEngine.resetCursor();
    syncEngine.stopAutoSync();
  }, [syncEngine]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const syncNow = useCallback(async () => {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    await syncEngine.syncOnce();
    await refreshOutbox();
  }, [session, syncEngine, refreshOutbox]);

  const createTeacherGrant = useCallback(
    async (
      label: string,
      permissions?: readonly TeacherPermission[],
      ttlDays?: number
    ): Promise<TeacherAccessGrant> => {
      if (!session?.token) {
        throw new Error('Authentication required to create teacher grant');
      }
      const client = new TeacherHttpClient(serverUrlState);
      const grant = await client.createGrant(session.token, { label, permissions, ttlDays });
      await refreshTeacherGrants();
      return grant;
    },
    [session?.token, serverUrlState, refreshTeacherGrants]
  );

  const revokeTeacherGrant = useCallback(
    async (grantId: string): Promise<void> => {
      if (!session?.token) {
        throw new Error('Authentication required to revoke teacher grant');
      }
      const client = new TeacherHttpClient(serverUrlState);
      await client.revokeGrant(session.token, grantId);
      await refreshTeacherGrants();
    },
    [session?.token, serverUrlState, refreshTeacherGrants]
  );

  const pendingCount = useMemo(() => {
    return outboxItems.filter((i) => i.status === 'pending' || i.status === 'in_flight').length;
  }, [outboxItems]);

  const failedCount = useMemo(() => {
    return outboxItems.filter((i) => i.status === 'failed').length;
  }, [outboxItems]);

  const value = useMemo<SyncContextValue>(() => {
    return {
      session,
      isAuthenticated: !!session,
      isAuthenticating,
      authError,
      signIn,
      signUp,
      signOut,
      clearAuthError,
      serverUrl: serverUrlState,
      deviceId,
      setServerUrl,
      connectionState: syncStatus.connectionState ?? (!session ? 'auth_required' : 'connected'),
      syncStatus,
      isSyncing: syncStatus.state === 'syncing',
      syncNow,
      outboxItems,
      pendingCount,
      failedCount,
      refreshOutbox,
      isAuthModalOpen,
      openAuthModal: () => setIsAuthModalOpen(true),
      closeAuthModal: () => setIsAuthModalOpen(false),
      isOutboxModalOpen,
      openOutboxModal: () => setIsOutboxModalOpen(true),
      closeOutboxModal: () => setIsOutboxModalOpen(false),
      teacherGrants,
      isLoadingGrants,
      createTeacherGrant,
      revokeTeacherGrant,
      refreshTeacherGrants,
      services,
      repositories: recordingRepositories,
    };
  }, [
    session,
    isAuthenticating,
    authError,
    signIn,
    signUp,
    signOut,
    clearAuthError,
    serverUrlState,
    deviceId,
    setServerUrl,
    syncStatus,
    syncNow,
    outboxItems,
    pendingCount,
    failedCount,
    refreshOutbox,
    isAuthModalOpen,
    isOutboxModalOpen,
    teacherGrants,
    isLoadingGrants,
    createTeacherGrant,
    revokeTeacherGrant,
    refreshTeacherGrants,
    services,
    recordingRepositories,
  ]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
