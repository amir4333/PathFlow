import React, { useState } from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../../features/dashboard/DashboardView';
import { GoalsView } from '../../features/goals/GoalsView';
import { RoadmapsView } from '../../features/roadmaps/RoadmapsView';
import { TasksView } from '../../features/tasks/TasksView';
import { SessionsView } from '../../features/sessions/SessionsView';
import { WeeklyPlansView } from '../../features/weekly-plans/WeeklyPlansView';
import { ProgressView } from '../../features/progress/ProgressView';
import { TeacherView } from '../../features/teacher/TeacherView';
import { ReportsView } from '../../features/reports/ReportsView';
import { SettingsView } from '../../features/settings/SettingsView';

export const AppShell: React.FC = () => {
  const { currentRoute } = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderActiveView = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardView />;
      case 'goals':
        return <GoalsView />;
      case 'roadmaps':
        return <RoadmapsView />;
      case 'tasks':
        return <TasksView />;
      case 'sessions':
        return <SessionsView />;
      case 'weekly-plans':
        return <WeeklyPlansView />;
      case 'progress':
        return <ProgressView />;
      case 'teacher-view':
      case 'teacher':
        return <TeacherView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div id="pathflow-app-root" className="min-h-screen flex bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased print:block print:bg-white print:text-neutral-900">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main id="main-content-area" className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};
