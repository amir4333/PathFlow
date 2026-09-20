import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const WeeklyPlansView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="weekly-plans"
      title="Weekly Planning & Allocation"
      description="Tactical capacity allocation, weekly commitment bounds, and cadence reviews."
      plannedPhase="Phase 3 (Planning & Allocation)"
      workflowStep="Review"
      responsibilities={[
        'Allocate committed weekly hours across active roadmaps.',
        'Review prior week session metrics against planned estimates.',
        'Adjust velocity expectations based on empirical session logs.',
        'Prevent burnout via capacity limits and commitment caps.',
      ]}
    />
  );
};
