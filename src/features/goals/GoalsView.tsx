import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { GoalListView } from './GoalListView';
import { GoalDetailView } from './GoalDetailView';

export const GoalsView: React.FC = () => {
  const { params } = useRouter();

  if (params.id) {
    return <GoalDetailView goalId={params.id} />;
  }

  return <GoalListView />;
};
