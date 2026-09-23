import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ActiveSession, Session, Task, EntityId, calculateActiveSessionElapsedSeconds } from '../../domain';
import { useApplication } from '../../app/providers/ApplicationProvider';

export function formatElapsedSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export interface ActiveSessionContextValue {
  activeSession: ActiveSession | null;
  activeTask: Task | null;
  elapsedSeconds: number;
  formattedTime: string;
  isLoading: boolean;
  error: string | null;
  startSession: (taskId: EntityId) => Promise<ActiveSession>;
  completeSession: () => Promise<Session>;
  discardSession: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | undefined>(undefined);

export const ActiveSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const application = useApplication();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeSessionRef = useRef<ActiveSession | null>(null);
  activeSessionRef.current = activeSession;

  // Sync and derive elapsed seconds from session timestamp
  const updateElapsed = useCallback(() => {
    if (activeSessionRef.current) {
      const seconds = calculateActiveSessionElapsedSeconds(
        activeSessionRef.current,
        new Date().toISOString()
      );
      setElapsedSeconds(seconds);
    } else {
      setElapsedSeconds(0);
    }
  }, []);

  // Fetch active session and task on mount or refresh
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const session = await application.sessions.getActiveSession();
      if (session) {
        setActiveSession(session);
        activeSessionRef.current = session;
        // Derive initial elapsed seconds
        setElapsedSeconds(
          calculateActiveSessionElapsedSeconds(session, new Date().toISOString())
        );

        // Fetch task details
        try {
          const task = await application.tasks.getTask(session.taskId);
          setActiveTask(task);
        } catch {
          // If task not found, retain session state with fallback title
          setActiveTask(null);
        }
      } else {
        setActiveSession(null);
        activeSessionRef.current = null;
        setActiveTask(null);
        setElapsedSeconds(0);
      }
    } catch (err: unknown) {
      console.error('Failed to load active session', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve active session.');
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time timer interval (ticks once per second when session is active)
  useEffect(() => {
    if (!activeSession) return;

    // Run immediately once
    updateElapsed();

    const intervalId = setInterval(() => {
      updateElapsed();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSession, updateElapsed]);

  const startSession = async (taskId: EntityId): Promise<ActiveSession> => {
    if (!taskId || taskId.trim().length === 0) {
      const err = new Error('A valid Task must be selected to start a session.');
      setError(err.message);
      throw err;
    }

    try {
      setError(null);
      const newActive = await application.sessions.startSession(taskId);
      setActiveSession(newActive);
      activeSessionRef.current = newActive;
      setElapsedSeconds(0);

      // Load task
      try {
        const task = await application.tasks.getTask(taskId);
        setActiveTask(task);
      } catch {
        setActiveTask(null);
      }

      return newActive;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start active session.';
      setError(msg);
      throw err;
    }
  };

  const completeSession = async (): Promise<Session> => {
    try {
      setError(null);
      const completed = await application.sessions.completeSession();
      setActiveSession(null);
      activeSessionRef.current = null;
      setActiveTask(null);
      setElapsedSeconds(0);
      return completed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete active session.';
      setError(msg);
      throw err;
    }
  };

  const discardSession = async (): Promise<void> => {
    try {
      setError(null);
      await application.sessions.discardActiveSession();
      setActiveSession(null);
      activeSessionRef.current = null;
      setActiveTask(null);
      setElapsedSeconds(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to discard active session.';
      setError(msg);
      throw err;
    }
  };

  const clearError = () => setError(null);

  const formattedTime = formatElapsedSeconds(elapsedSeconds);

  return (
    <ActiveSessionContext.Provider
      value={{
        activeSession,
        activeTask,
        elapsedSeconds,
        formattedTime,
        isLoading,
        error,
        startSession,
        completeSession,
        discardSession,
        refresh,
        clearError,
      }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
};

export const useActiveSession = (): ActiveSessionContextValue => {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error('useActiveSession must be used within an ActiveSessionProvider');
  }
  return context;
};
