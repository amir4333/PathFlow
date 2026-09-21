import React, { createContext, useContext, useMemo } from 'react';
import { createApplicationServices, ApplicationServices } from '../../application';
import { createLocalRepositories } from '../../data/repositories/local';

const ApplicationContext = createContext<ApplicationServices | undefined>(undefined);

export const ApplicationProvider: React.FC<{
  services?: ApplicationServices;
  children: React.ReactNode;
}> = ({ services, children }) => {
  const applicationServices = useMemo(() => {
    if (services) return services;
    const repos = createLocalRepositories();
    return createApplicationServices({
      goals: repos.goals,
      roadmaps: repos.roadmaps,
      tasks: repos.tasks,
      sessions: repos.sessions,
      weeklyPlans: repos.weeklyPlans,
      weeklyPlanItems: repos.weeklyPlanItems,
    });
  }, [services]);

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
