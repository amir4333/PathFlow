import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { RoadmapListView } from './RoadmapListView';
import { RoadmapDetailView } from './RoadmapDetailView';

export const RoadmapsView: React.FC = () => {
  const { params } = useRouter();

  if (params.id) {
    return <RoadmapDetailView roadmapId={params.id} />;
  }

  return <RoadmapListView />;
};
