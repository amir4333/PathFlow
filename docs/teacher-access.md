# PathFlow Teacher Access & Remote Observation Architecture

## 1. Principles of Teacher Access

PathFlow is fundamentally a personal learning, project execution, and deep focus tool for students. The Teacher Access subsystem provides **read-only transparency** for mentors, advisors, and instructors without invading the student's personal autonomy or introducing toxic grading metrics.

### Key Tenets:
1. **Student In Control**: The student explicitly creates, configures, and revokes access grants.
2. **Strictly Read-Only**: Teachers have zero ability to mutate, insert, modify, or delete Goals, Roadmaps, Tasks, Sessions, or Weekly Plans.
3. **Multi-Layer Enforcement**:
   - UI: Teacher View has no edit buttons or active session timers.
   - Adapter: `TeacherRemoteAdapter` throws runtime exceptions on mutation attempts.
   - HTTP Server: All mutation HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`) on teacher endpoints are unconditionally rejected with `403 Forbidden`.
   - Database: Queries are scoped and verified against active student grants.

---

## 2. Grant Model

```typescript
export interface TeacherAccessGrant {
  readonly id: string;               // Grant unique ID
  readonly studentId: string;        // Owning student ID
  readonly label: string;            // e.g. "Prof. Alan Turing (Advisor)"
  readonly token: string;            // Secure bearer access token
  readonly role: 'read_only';        // Immutable role
  readonly permissions: string[];    // Granular permissions
  readonly createdAt: string;
  readonly expiresAt?: string;       // Optional TTL
  readonly revokedAt?: string;       // Timestamp when revoked
  readonly isActive: boolean;
}
```

### Granular Permissions:
- `read:goals`: Inspect student goals
- `read:roadmaps`: Inspect roadmaps and milestones
- `read:tasks`: Inspect actionable tasks and progress
- `read:sessions`: Inspect historical work execution logs
- `read:weekly_plans`: Inspect tactical capacity allocations
- `read:reports`: Inspect generated official progress reports

---

## 3. Teacher Remote API Endpoints

All teacher endpoints require a valid grant token via the `Authorization: Bearer <TOKEN>` header or `X-Teacher-Token: <TOKEN>`:

- `GET /api/teacher/students/:studentId/goals`
- `GET /api/teacher/students/:studentId/roadmaps`
- `GET /api/teacher/students/:studentId/tasks`
- `GET /api/teacher/students/:studentId/sessions`
- `GET /api/teacher/students/:studentId/weekly-plans`
- `GET /api/teacher/students/:studentId/progress`
- `GET /api/teacher/students/:studentId/reports`

### Mutation Rejection:
Any non-GET request targeting `/api/teacher/students/:studentId/*` returns:
```json
HTTP/1.1 403 Forbidden
{
  "error": "Teacher access is strictly read-only. Mutation operations are prohibited."
}
```
