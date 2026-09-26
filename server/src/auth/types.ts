export interface AuthTokenPayload {
  readonly userId: string;
  readonly email: string;
  readonly role: 'student' | 'teacher';
  readonly exp: number;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: 'student' | 'teacher';
}
