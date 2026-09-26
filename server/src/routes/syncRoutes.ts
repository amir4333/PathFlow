/**
 * Sync Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SyncService, ServerSyncPushRequest, ServerSyncPullRequest } from '../services/syncService';
import { AuthService } from '../auth/authService';

export function registerSyncRoutes(
  app: FastifyInstance,
  syncService: SyncService,
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
      reply.status(403).send({ error: 'Only student accounts can synchronize personal workspace data' });
      return null;
    }

    return decoded.userId;
  }

  // Push
  app.post(
    '/api/sync/push',
    async (request: FastifyRequest<{ Body: ServerSyncPushRequest }>, reply: FastifyReply) => {
      const studentId = authenticateStudent(request, reply);
      if (!studentId) return;

      const body = request.body;
      if (!body || !body.deviceId || !Array.isArray(body.mutations)) {
        return reply.status(400).send({
          error: 'Invalid push request. Must contain deviceId and mutations array.',
        });
      }

      const response = await syncService.processPush(studentId, body);
      return reply.send(response);
    }
  );

  // Pull
  app.post(
    '/api/sync/pull',
    async (request: FastifyRequest<{ Body: ServerSyncPullRequest }>, reply: FastifyReply) => {
      const studentId = authenticateStudent(request, reply);
      if (!studentId) return;

      const body = request.body || { cursor: null };
      const response = await syncService.processPull(studentId, body);
      return reply.send(response);
    }
  );

  // Status
  app.get('/api/sync/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const studentId = authenticateStudent(request, reply);
    if (!studentId) return;

    return reply.send({
      state: 'idle',
      isOnline: true,
      studentId,
      serverTime: new Date().toISOString(),
    });
  });
}
