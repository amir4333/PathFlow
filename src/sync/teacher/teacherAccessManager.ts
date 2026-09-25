/**
 * Teacher Access Manager
 *
 * Implements the student-side access control subsystem allowing students to
 * issue, inspect, and revoke read-only access grants for teachers/mentors.
 */

import { generateEntityId, createTimestamp, EntityId } from '../../domain';
import { TeacherAccessGrant, TeacherPermission, ALL_TEACHER_PERMISSIONS } from '../types';

export interface CreateGrantOptions {
  readonly studentId: EntityId;
  readonly label: string;
  readonly permissions?: readonly TeacherPermission[];
  readonly ttlDays?: number;
}

export class TeacherAccessManager {
  private grants: Map<string, TeacherAccessGrant> = new Map();

  /**
   * Generates a new secure, scoped read-only grant for a teacher or advisor.
   */
  createGrant(options: CreateGrantOptions): TeacherAccessGrant {
    const now = createTimestamp();
    let expiresAt: string | undefined = undefined;

    if (options.ttlDays && options.ttlDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + options.ttlDays);
      expiresAt = expDate.toISOString();
    }

    // Generate high-entropy token: pt_ + uuid + uuid (without dashes)
    const token = `pt_${generateEntityId().replace(/-/g, '')}${generateEntityId().replace(/-/g, '')}`;

    const grant: TeacherAccessGrant = {
      id: generateEntityId(),
      studentId: options.studentId,
      label: options.label.trim(),
      token,
      role: 'read_only',
      permissions: options.permissions && options.permissions.length > 0
        ? [...options.permissions]
        : [...ALL_TEACHER_PERMISSIONS],
      createdAt: now,
      expiresAt,
      isActive: true,
    };

    this.grants.set(grant.id, grant);
    return grant;
  }

  /**
   * Revokes an existing grant immediately.
   */
  revokeGrant(grantId: EntityId): TeacherAccessGrant {
    const existing = this.grants.get(grantId);
    if (!existing) {
      throw new Error(`Teacher grant not found: ${grantId}`);
    }

    const updated: TeacherAccessGrant = {
      ...existing,
      isActive: false,
      revokedAt: createTimestamp(),
    };

    this.grants.set(grantId, updated);
    return updated;
  }

  /**
   * Validates a bearer token presented by a teacher client.
   */
  validateToken(token: string): {
    readonly isValid: boolean;
    readonly grant?: TeacherAccessGrant;
    readonly error?: string;
  } {
    if (!token || token.trim().length === 0) {
      return { isValid: false, error: 'Token is missing' };
    }

    for (const grant of this.grants.values()) {
      if (grant.token === token) {
        if (!grant.isActive) {
          return { isValid: false, error: 'Access grant has been revoked by student' };
        }

        if (grant.expiresAt) {
          const nowMs = Date.now();
          const expMs = Date.parse(grant.expiresAt);
          if (!isNaN(expMs) && nowMs > expMs) {
            return { isValid: false, error: 'Access grant has expired' };
          }
        }

        return { isValid: true, grant };
      }
    }

    return { isValid: false, error: 'Invalid or unknown grant token' };
  }

  /**
   * Lists all grants issued by the student.
   */
  listGrants(studentId?: EntityId): TeacherAccessGrant[] {
    const all = Array.from(this.grants.values());
    if (studentId) {
      return all.filter((g) => g.studentId === studentId);
    }
    return all;
  }

  /**
   * Loads pre-existing grants (e.g. from local persistence).
   */
  hydrate(grants: readonly TeacherAccessGrant[]): void {
    this.grants.clear();
    for (const g of grants) {
      this.grants.set(g.id, g);
    }
  }
}
