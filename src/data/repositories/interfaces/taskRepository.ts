import { EntityId, Task, TaskStatus } from '../../../domain';

export interface TaskRepository {
  create(task: Task): Promise<Task>;
  getById(id: EntityId): Promise<Task | null>;
  getAll(): Promise<Task[]>;
  getByRoadmapId(roadmapId: EntityId): Promise<Task[]>;
  getByStatus(status: TaskStatus): Promise<Task[]>;
  update(task: Task): Promise<Task>;
  delete(id: EntityId): Promise<void>;
}
