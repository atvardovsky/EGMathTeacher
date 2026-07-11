import type { Request } from 'express';

export type UserRole = 'admin' | 'student';

export interface UserRecord {
  id: string;
  name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

export interface PublicUser {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession extends PublicUser {
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthSession;
}
