import React, { createContext, useContext, useMemo } from 'react';
import { createApplicationServices, ApplicationServices } from '../../application';
import { createLocalRepositories } from '../../data/repositories/local';
import { useSync } from '../../sync/context/SyncContext';

const ApplicationContext = createContext<ApplicationServices | undefined>(undefined);

export const ApplicationProvider: React.FC<{
  services?: ApplicationServices;
  children: React.ReactNode;
}> = ({ services: explicitServices, children }) => {
  let syncServices: ApplicationServices | undefined;
  try {
    const sync = useSync();
    syncServices = sync.services;
  } catch {
    // Isolated tests without SyncProvider
  }

  const applicationServices = useMemo(() => {
    if (explicitServices) return explicitServices;
    if (syncServices) return syncServices;
    const repos = createLocalRepositories();
    return createApplicationServices({
      goals: repos.goals,
      roadmaps: repos.roadmaps,
      tasks: repos.tasks,
      sessions: repos.sessions,
      weeklyPlans: repos.weeklyPlans,
      weeklyPlanItems: repos.weeklyPlanItems,
    });
  }, [explicitServices, syncServices]);

  return (
    <ApplicationContext.Provider value={applicationServices}>
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplication = (): ApplicationServices => {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplication must be used within an ApplicationProvider');
  }
  return context;
};
