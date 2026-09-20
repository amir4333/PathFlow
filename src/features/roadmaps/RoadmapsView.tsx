import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const RoadmapsView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="roadmaps"
      title="Roadmaps & Milestones"
      description="Strategic path decomposition linking high-level goals down to actionable milestone sequences."
      plannedPhase="Phase 2 (Data Modeling & Domain Logic)"
      workflowStep="Roadmap"
      responsibilities={[
        'Structure sequential and parallel milestone pathways.',
        'Calculate milestone target dates and critical path sequences.',
        'Map prerequisite relationships between distinct milestones.',
        'Bridge long-term goal definitions with daily task queues.',
      ]}
    />
  );
};
