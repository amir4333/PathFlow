/**
 * Auth Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseStore } from '../db/types';
import { AuthService } from '../auth/authService';

interface RegisterBody {
  email: string;
  password: string;
  role?: 'student' | 'teacher';
}

interface LoginBody {
  email: string;
  password: string;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  store: DatabaseStore,
  authService: AuthService
) {
  // Register
  app.post(
    '/api/auth/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { email, password, role = 'student' } = request.body || {};

      if (!email || !email.includes('@')) {
        return reply.status(400).send({ error: 'Valid email is required' });
      }
      if (!password || password.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }
      if (role !== 'student' && role !== 'teacher') {
        return reply.status(400).send({ error: 'Role must be student or teacher' });
      }

      const existing = await store.getUserByEmail(email);
      if (existing) {
        return reply.status(409).send({ error: 'User with this email already exists' });
      }

      const passwordHash = await authService.hashPassword(password);
      const user = await store.createUser({
        email: email.toLowerCase(),
        passwordHash,
        role,
      });

      const token = authService.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      });
    }
  );

  // Login
  app.post(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const { email, password } = request.body || {};

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      const user = await store.getUserByEmail(email);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const valid = await authService.verifyPassword(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const token = authService.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      });
    }
  );

  // Me
  app.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const user = await store.getUserById(decoded.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}
