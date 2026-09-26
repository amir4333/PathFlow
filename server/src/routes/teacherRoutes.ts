/**
 * Teacher Routes
 *
 * Implements:
 * 1. Student-side grant creation, listing, and revocation.
 * 2. Teacher-side read-only inspection of student goals, roadmaps, tasks, sessions, plans, progress, and reports.
 * 3. Strict rejection of mutation operations on student records.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeacherService, TeacherAccessError } from '../services/teacherService';
import { AuthService } from '../auth/authService';

interface CreateGrantBody {
  label: string;
  permissions?: string[];
  ttlDays?: number;
}

export function registerTeacherRoutes(
  app: FastifyInstance,
  teacherService: TeacherService,
  authService: AuthService
) {
  function authenticateStudent(request: FastifyRequest, reply: FastifyReply): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      reply.status(401).send({ error: 'Invalid or expired token' });
      return null;
    }

    if (decoded.role !== 'student') {
      reply.status(403).send({ error: 'Only students can manage teacher access grants' });
      return null;
    }

    return decoded.userId;
  }

  function extractTeacherToken(request: FastifyRequest): string | null {
    // Check X-Teacher-Token header or Authorization Bearer token
    const customHeader = request.headers['x-teacher-token'];
    if (typeof customHeader === 'string' && customHeader.trim().length > 0) {
      return customHeader.trim();
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }

  // --- Student Grant Management ---

  // Create Grant
  app.post(
    '/api/teacher/grants',
    async (request: FastifyRequest<{ Body: CreateGrantBody }>, reply: FastifyReply) => {
      const studentId = authenticateStudent(request, reply);
      if (!studentId) return;

      const { label, permissions, ttlDays } = request.body || {};
      if (!label || label.trim().length === 0) {
        return reply.status(400).send({ error: 'Grant label is required' });
      }

      const grant = await teacherService.createGrant(studentId, {
        label,
        permissions,
        ttlDays,
      });

      return reply.status(201).send(grant);
    }
  );

  // List Grants
  app.get('/api/teacher/grants', async (request: FastifyRequest, reply: FastifyReply) => {
    const studentId = authenticateStudent(request, reply);
    if (!studentId) return;

    const grants = await teacherService.listGrants(studentId);
    return reply.send(grants);
  });

  // Revoke Grant
  app.delete(
    '/api/teacher/grants/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const studentId = authenticateStudent(request, reply);
      if (!studentId) return;

      try {
        const revoked = await teacherService.revokeGrant(studentId, request.params.id);
        return reply.send(revoked);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: err?.message ?? 'Failed to revoke grant' });
      }
    }
  );

  // --- Teacher Read-Only Inspection ---

  // Get Student Goals
  app.get(
    '/api/teacher/students/:studentId/goals',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const goals = await teacherService.getStudentGoals(token, request.params.studentId);
        return reply.send(goals);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Roadmaps
  app.get(
    '/api/teacher/students/:studentId/roadmaps',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const roadmaps = await teacherService.getStudentRoadmaps(token, request.params.studentId);
        return reply.send(roadmaps);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Tasks
  app.get(
    '/api/teacher/students/:studentId/tasks',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const tasks = await teacherService.getStudentTasks(token, request.params.studentId);
        return reply.send(tasks);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Sessions
  app.get(
    '/api/teacher/students/:studentId/sessions',
    async (
      request: FastifyRequest<{
        Params: { studentId: string };
        Querystring: { startDate?: string; endDate?: string };
      }>,
      reply: FastifyReply
    ) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const sessions = await teacherService.getStudentSessions(
          token,
          request.params.studentId,
          request.query.startDate,
          request.query.endDate
        );
        return reply.send(sessions);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Weekly Plans
  app.get(
    '/api/teacher/students/:studentId/weekly-plans',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const weeklyPlans = await teacherService.getStudentWeeklyPlans(token, request.params.studentId);
        return reply.send(weeklyPlans);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Progress
  app.get(
    '/api/teacher/students/:studentId/progress',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const progress = await teacherService.getStudentProgress(token, request.params.studentId);
        return reply.send(progress);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get Student Reports
  app.get(
    '/api/teacher/students/:studentId/reports',
    async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const token = extractTeacherToken(request);
      if (!token) return reply.status(401).send({ error: 'Missing teacher access token' });

      try {
        const reports = await teacherService.getStudentReports(token, request.params.studentId);
        return reply.send(reports);
      } catch (err: any) {
        if (err instanceof TeacherAccessError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // --- Strict Teacher Mutation Rejection Handlers ---
  const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
  for (const method of mutationMethods) {
    app.route({
      method,
      url: '/api/teacher/students/:studentId/*',
      handler: async (_request, reply) => {
        return reply.status(403).send({
          error: 'Teacher access is strictly read-only. Mutation operations are prohibited.',
        });
      },
    });
  }
}
