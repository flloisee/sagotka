import type { NextFunction, Request, Response } from 'express';
import { getSessionUserId } from './repo.js';

export const SESSION_COOKIE = 'sagotka_session';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const userId = getSessionUserId(token);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.userId = userId;
  next();
}
