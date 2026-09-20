import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const GoalsView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="goals"
      title="Goals Management"
      description="Long-term multi-year and annual aspirational outcomes and target state definitions."
      plannedPhase="Phase 2 (Data Modeling & Domain Logic)"
      workflowStep="Goal"
      responsibilities={[
        'Define long-term vision, target completion horizons, and qualitative intent.',
        'Decompose aspirational objectives into measurable outcomes.',
        'Establish goal priority weighting and active vs. archived states.',
        'Maintain local-first offline storage representation without premature cloud sync.',
      ]}
    />
  );
};
