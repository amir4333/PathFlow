/**
 * PathFlow Local Database (Dexie.js IndexedDB Abstraction)
 *
 * Implements the single source of truth for offline-first local persistence.
 * Completely encapsulated behind Repository interfaces.
 */

import Dexie, { Table, DexieOptions } from 'dexie';
import { Goal, Roadmap, Task, Session, ActiveSession, WeeklyPlanItem } from '../../domain';
import {
  DATABASE_NAME,
  SCHEMA_V1_STORES,
  SCHEMA_V2_STORES,
  WeeklyPlanRecord,
} from './schema';

export class PathFlowDB extends Dexie {
  goals!: Table<Goal, string>;
  roadmaps!: Table<Roadmap, string>;
  tasks!: Table<Task, string>;
  sessions!: Table<Session, string>;
  weeklyPlans!: Table<WeeklyPlanRecord, string>;
  weeklyPlanItems!: Table<WeeklyPlanItem, string>;
  activeSession!: Table<ActiveSession, string>;

  constructor(dbName: string = DATABASE_NAME, options?: DexieOptions) {
    super(dbName, options);

    this.version(1).stores(SCHEMA_V1_STORES);
    this.version(2).stores(SCHEMA_V2_STORES);
  }
}

let defaultDatabaseInstance: PathFlowDB | null = null;

/**
 * Returns the default singleton instance of PathFlowDB.
 */
export function getDatabase(dbName: string = DATABASE_NAME, options?: DexieOptions): PathFlowDB {
  if (!defaultDatabaseInstance || defaultDatabaseInstance.name !== dbName) {
    defaultDatabaseInstance = new PathFlowDB(dbName, options);
  }
  return defaultDatabaseInstance;
}

/**
 * Factory for creating fresh database instances (useful for isolated tests).
 */
export function createDatabase(dbName: string = DATABASE_NAME, options?: DexieOptions): PathFlowDB {
  return new PathFlowDB(dbName, options);
}
