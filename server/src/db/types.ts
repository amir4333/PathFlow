/**
 * Database Entity Types & Repository Interfaces
 */

export interface BackendUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'teacher';
  createdAt: Date;
  updatedAt: Date;
}

export interface BackendGoal {
  id: string;
  studentId: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendRoadmap {
  id: string;
  studentId: string;
  goalId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendTask {
  id: string;
  studentId: string;
  roadmapId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface BackendSession {
  id: string;
  studentId: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface BackendWeeklyPlan {
  id: string;
  studentId: string;
  weekIdentifier: string;
  title: string;
  targetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackendWeeklyPlanItem {
  id: string;
  studentId: string;
  weeklyPlanId: string;
  taskId: string;
  targetDate?: string | null;
  plannedMinutes: number;
  isCompleted: boolean;
}

export interface BackendSyncMutation {
  id: string;
  studentId: string;
  deviceId: string;
  clientMutationId: string;
  sequence: number;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string | null;
  timestamp: string;
  createdAt: Date;
}

export interface BackendTombstone {
  id: string;
  studentId: string;
  entityType: string;
  entityId: string;
  deletedAt: string;
  sequence: number;
  createdAt: Date;
}

export interface BackendTeacherAccessGrant {
  id: string;
  studentId: string;
  teacherId?: string | null;
  label: string;
  token: string;
  role: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  isActive: boolean;
}

export interface DatabaseStore {
  // Users
  createUser(user: Omit<BackendUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<BackendUser>;
  getUserByEmail(email: string): Promise<BackendUser | null>;
  getUserById(id: string): Promise<BackendUser | null>;

  // Sync Mutations & Idempotency
  findMutationByClientKey(studentId: string, deviceId: string, clientMutationId: string): Promise<BackendSyncMutation | null>;
  recordMutation(mutation: Omit<BackendSyncMutation, 'id' | 'sequence' | 'createdAt'>): Promise<BackendSyncMutation>;
  getMutationsAfter(studentId: string, timestampOrSequence: string | number, limit?: number): Promise<BackendSyncMutation[]>;
  getMaxSequence(studentId: string): Promise<number>;

  // Tombstones
  recordTombstone(tombstone: Omit<BackendTombstone, 'id' | 'sequence' | 'createdAt'>): Promise<BackendTombstone>;
  getTombstonesAfter(studentId: string, timestampOrSequence: string | number): Promise<BackendTombstone[]>;

  // Entity persistence for student data
  upsertGoal(goal: BackendGoal): Promise<BackendGoal>;
  deleteGoal(studentId: string, id: string): Promise<void>;
  getGoals(studentId: string): Promise<BackendGoal[]>;

  upsertRoadmap(roadmap: BackendRoadmap): Promise<BackendRoadmap>;
  deleteRoadmap(studentId: string, id: string): Promise<void>;
  getRoadmaps(studentId: string): Promise<BackendRoadmap[]>;

  upsertTask(task: BackendTask): Promise<BackendTask>;
  deleteTask(studentId: string, id: string): Promise<void>;
  getTasks(studentId: string): Promise<BackendTask[]>;

  upsertSession(session: BackendSession): Promise<BackendSession>;
  deleteSession(studentId: string, id: string): Promise<void>;
  getSessions(studentId: string): Promise<BackendSession[]>;

  upsertWeeklyPlan(plan: BackendWeeklyPlan): Promise<BackendWeeklyPlan>;
  deleteWeeklyPlan(studentId: string, id: string): Promise<void>;
  getWeeklyPlans(studentId: string): Promise<BackendWeeklyPlan[]>;

  upsertWeeklyPlanItem(item: BackendWeeklyPlanItem): Promise<BackendWeeklyPlanItem>;
  deleteWeeklyPlanItem(studentId: string, id: string): Promise<void>;
  getWeeklyPlanItems(studentId: string): Promise<BackendWeeklyPlanItem[]>;

  // Teacher Access Grants
  createTeacherGrant(grant: Omit<BackendTeacherAccessGrant, 'id'>): Promise<BackendTeacherAccessGrant>;
  getTeacherGrantById(id: string): Promise<BackendTeacherAccessGrant | null>;
  getTeacherGrantByToken(token: string): Promise<BackendTeacherAccessGrant | null>;
  getTeacherGrantsForStudent(studentId: string): Promise<BackendTeacherAccessGrant[]>;
  revokeTeacherGrant(id: string): Promise<BackendTeacherAccessGrant>;
}
