import React from 'react';
import { PlaceholderView } from '../../components/ui/PlaceholderView';

export const TeacherView: React.FC = () => {
  return (
    <PlaceholderView
      routeId="teacher"
      title="Teacher & Mentor Review View"
      description="Controlled, privacy-preserving progress sharing and structured mentor review portal."
      plannedPhase="Phase 4 (Collaboration & Sync Protocol)"
      workflowStep="Review"
      responsibilities={[
        'Export verified progress summaries and milestone completion proofs.',
        'Read-only shared snapshot generation with configurable visibility scopes.',
        'Structured teacher feedback ingestion and review notes.',
        'Strict isolation from personal deep-work raw session logs.',
      ]}
    />
  );
};
