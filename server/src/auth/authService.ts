/**
 * Authentication Service
 *
 * Implements password hashing and cryptographically verifiable JWT/HMAC tokens.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AuthTokenPayload, AuthUser } from './types';

export class AuthService {
  constructor(private readonly secret: string) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates an HMAC-SHA256 signed bearer token.
   */
  generateToken(user: AuthUser, expiresInHours = 72): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
    const payloadData: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp,
    };
    const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Verifies the token signature and expiration.
   */
  verifyToken(token: string): AuthTokenPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    try {
      const decoded: AuthTokenPayload = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf-8')
      );

      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        return null; // Expired
      }

      return decoded;
    } catch {
      return null;
    }
  }
}
