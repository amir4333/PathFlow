import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictResolver, SyncTombstone } from '../../src/sync';
import { createTask, createSession, createGoal, generateEntityId } from '../../src/domain';

test('ConflictResolver: Tombstone precedence and resurrection', () => {
  const resolver = new ConflictResolver();

  const goal = createGoal({
    title: 'Distributed Systems',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T11:00:00.000Z',
  });

  const olderTombstone: SyncTombstone = {
    entityType: 'goal',
    entityId: goal.id,
    deletedAt: '2026-09-20T10:30:00.000Z',
  };

  // Local was updated after tombstone -> resurrects (keep_local)
  const result1 = resolver.resolveTombstoneConflict(goal, olderTombstone);
  assert.equal(result1, 'keep_local');

  const newerTombstone: SyncTombstone = {
    entityType: 'goal',
    entityId: goal.id,
    deletedAt: '2026-09-20T12:00:00.000Z',
  };

  // Tombstone is newer than local edit -> tombstone wins
  const result2 = resolver.resolveTombstoneConflict(goal, newerTombstone);
  assert.equal(result2, 'tombstone_wins');
});

test('ConflictResolver: Session execution records preserve historical accuracy', () => {
  const resolver = new ConflictResolver();
  const taskId = generateEntityId();

  const localSession = createSession({
    taskId,
    startedAt: '2026-09-21T09:00:00.000Z',
    endedAt: '2026-09-21T09:45:00.000Z',
    durationMinutes: 45,
  });

  // Exact identical session arrives -> keep local
  const duplicateRemote = { ...localSession };
  const res1 = resolver.resolveEntityConflict('session', localSession, duplicateRemote);
  assert.equal(res1.action, 'keep_local');

  // Remote session ended later (longer duration recorded on mobile) -> apply remote
  const extendedRemote = {
    ...localSession,
    endedAt: '2026-09-21T10:00:00.000Z',
    durationMinutes: 60,
  };
  const res2 = resolver.resolveEntityConflict('session', localSession, extendedRemote);
  assert.equal(res2.action, 'apply_remote');
  if (res2.action === 'apply_remote') {
    assert.equal(res2.entity.durationMinutes, 60);
  }
});

test('ConflictResolver: Task status transitions take precedence over intermediate edits', () => {
  const resolver = new ConflictResolver();
  const roadmapId = generateEntityId();

  const localTask = createTask({
    roadmapId,
    title: 'Build Compiler Frontend',
    status: 'completed',
    completedAt: '2026-09-22T15:00:00.000Z',
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T15:00:00.000Z',
  });

  // Remote has a description edit created before local completion
  const remoteTask = createTask({
    id: localTask.id,
    roadmapId,
    title: 'Build Compiler Frontend with AST Nodes',
    description: 'Detailed description',
    status: 'in_progress',
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T12:00:00.000Z',
  });

  const res = resolver.resolveEntityConflict('task', localTask, remoteTask);
  // Should keep local or merge keeping completed status
  if (res.action === 'keep_local') {
    assert.equal(res.entity.status, 'completed');
  } else if (res.action === 'merge') {
    assert.equal(res.entity.status, 'completed');
  } else {
    assert.fail('Expected keep_local or merge');
  }
});
