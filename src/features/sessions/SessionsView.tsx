import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const SessionsView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="sessions"
      title="Work Sessions & Time Tracking"
      description="Deep work execution blocks, real-time timer tracking, and session output records."
      plannedPhase="Phase 3 (Work Sessions & Time Engine)"
      workflowStep="Session"
      responsibilities={[
        'Start, pause, complete, and log focused execution sessions against active tasks.',
        'Record uninterrupted time intervals with high temporal accuracy.',
        'Capture qualitative session reflection notes and blocker records.',
        'Local event logging guaranteeing no data loss during connectivity drops.',
      ]}
    />
  );
};
