/**
 * Teacher Access Remote Client
 *
 * Implements:
 * 1. Student-side grant management (create, list, revoke).
 * 2. Teacher-side read-only observation via student-authorized grant tokens.
 *
 * Strictly enforces that teacher queries are read-only.
 */

import { TeacherAccessGrant, TeacherPermission } from '../types';

export interface CreateGrantRequest {
  readonly label: string;
  readonly permissions?: readonly TeacherPermission[];
  readonly ttlDays?: number;
}

export class TeacherHttpClient {
  private readonly baseUrl: string;

  constructor(serverUrl: string) {
    this.baseUrl = serverUrl.replace(/\/+$/, '');
  }

  // --- Student Grant Management ---

  async listGrants(studentAuthToken: string): Promise<TeacherAccessGrant[]> {
    const response = await fetch(`${this.baseUrl}/api/teacher/grants`, {
      headers: {
        Authorization: `Bearer ${studentAuthToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to list teacher grants (HTTP ${response.status}): ${err}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.grants ?? []);
  }

  async createGrant(
    studentAuthToken: string,
    request: CreateGrantRequest
  ): Promise<TeacherAccessGrant> {
    const response = await fetch(`${this.baseUrl}/api/teacher/grants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAuthToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let err = `HTTP ${response.status}`;
      try {
        const json = await response.json();
        if (json.error) err = json.error;
      } catch {
        // ignore
      }
      throw new Error(`Failed to create teacher grant: ${err}`);
    }

    const data = await response.json();
    return (data.grant ?? data) as TeacherAccessGrant;
  }

  async revokeGrant(studentAuthToken: string, grantId: string): Promise<TeacherAccessGrant> {
    const response = await fetch(`${this.baseUrl}/api/teacher/grants/${grantId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${studentAuthToken}`,
      },
    });

    if (!response.ok) {
      let err = `HTTP ${response.status}`;
      try {
        const json = await response.json();
        if (json.error) err = json.error;
      } catch {
        // ignore
      }
      throw new Error(`Failed to revoke teacher grant: ${err}`);
    }

    const data = await response.json();
    return (data.grant ?? data) as TeacherAccessGrant;
  }

  // --- Teacher-Side Read-Only Queries ---

  async getStudentGoals(studentId: string, grantToken: string): Promise<any[]> {
    const data = await this.queryReadOnly(studentId, 'goals', grantToken);
    return Array.isArray(data) ? data : (data.goals ?? []);
  }

  async getStudentRoadmaps(studentId: string, grantToken: string): Promise<any[]> {
    const data = await this.queryReadOnly(studentId, 'roadmaps', grantToken);
    return Array.isArray(data) ? data : (data.roadmaps ?? []);
  }

  async getStudentTasks(studentId: string, grantToken: string): Promise<any[]> {
    const data = await this.queryReadOnly(studentId, 'tasks', grantToken);
    return Array.isArray(data) ? data : (data.tasks ?? []);
  }

  async getStudentSessions(studentId: string, grantToken: string, startDate?: string, endDate?: string): Promise<any[]> {
    let resource = 'sessions';
    const q: string[] = [];
    if (startDate) q.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) q.push(`endDate=${encodeURIComponent(endDate)}`);
    if (q.length > 0) resource += `?${q.join('&')}`;
    const data = await this.queryReadOnly(studentId, resource, grantToken);
    return Array.isArray(data) ? data : (data.sessions ?? []);
  }

  async getStudentWeeklyPlans(studentId: string, grantToken: string): Promise<any[]> {
    const data = await this.queryReadOnly(studentId, 'weekly-plans', grantToken);
    return Array.isArray(data) ? data : (data.weeklyPlans ?? []);
  }

  async getStudentProgress(studentId: string, grantToken: string): Promise<any> {
    const data = await this.queryReadOnly(studentId, 'progress', grantToken);
    return data.progress ?? data;
  }

  async getStudentReports(studentId: string, grantToken: string): Promise<any> {
    const data = await this.queryReadOnly(studentId, 'reports', grantToken);
    return data.reports ?? data;
  }

  private async queryReadOnly(
    studentId: string,
    resource: string,
    grantToken: string
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/teacher/students/${studentId}/${resource}`,
      {
        headers: {
          'X-Teacher-Token': grantToken,
          Authorization: `Bearer ${grantToken}`,
        },
      }
    );

    if (!response.ok) {
      let err = `HTTP ${response.status}`;
      try {
        const json = await response.json();
        if (json.error) err = json.error;
      } catch {
        // ignore
      }
      throw new Error(`Teacher read failed for ${resource}: ${err}`);
    }

    return response.json();
  }
}
