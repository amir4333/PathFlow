import { EntityId, Roadmap } from '../../../domain';

export interface RoadmapRepository {
  create(roadmap: Roadmap): Promise<Roadmap>;
  getById(id: EntityId): Promise<Roadmap | null>;
  getAll(): Promise<Roadmap[]>;
  getByGoalId(goalId: EntityId): Promise<Roadmap[]>;
  update(roadmap: Roadmap): Promise<Roadmap>;
  delete(id: EntityId): Promise<void>;
}
