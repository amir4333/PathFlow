import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const TasksView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="tasks"
      title="Tasks & Work Units"
      description="Atomic, actionable work items tied directly to specific roadmap milestones."
      plannedPhase="Phase 2 (Data Modeling & Domain Logic)"
      workflowStep="Task"
      responsibilities={[
        'Define granular work units with estimated duration and urgency.',
        'Strictly tie tasks to roadmap milestones (preventing aimless task lists).',
        'State lifecycle transitions (Pending, Active, In-Session, Completed).',
        'Offline optimistic mutation support with conflict-free identity.',
      ]}
    />
  );
};
