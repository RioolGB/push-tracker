import type { NextFunction, Request, Response } from 'express';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}