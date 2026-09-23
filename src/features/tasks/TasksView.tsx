import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { TaskListView } from './TaskListView';
import { TaskDetailView } from './TaskDetailView';

export const TasksView: React.FC = () => {
  const { params } = useRouter();

  if (params.id) {
    return <TaskDetailView taskId={params.id} />;
  }

  return <TaskListView />;
};
