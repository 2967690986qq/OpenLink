import { Request, Response, NextFunction } from 'express';
import { configStore } from '../config/store.js';
import logger from './logger.js';

/**
 * Authentication middleware for admin API routes.
 *
 * Uses a simple Bearer token scheme:
 * - If `gateway.authToken` is not set, all admin API requests are allowed (open mode).
 * - If `gateway.authToken` is set, requests must include `Authorization: Bearer <token>`.
 *
 * Webhook routes (/api/webhook/*) are exempt because platform callbacks
 * (DingTalk/Feishu) cannot carry custom auth headers.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authToken = configStore.get('gateway').authToken;

  // No token configured → open access (useful for dev/local setup)
  if (!authToken) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Unauthorized request — missing or invalid Authorization header', {
      method: req.method,
      path: req.path
    });
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide Authorization: Bearer <token> header.'
    });
    return;
  }

  const providedToken = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (providedToken !== authToken) {
    logger.warn('Unauthorized request — invalid token', {
      method: req.method,
      path: req.path
    });
    res.status(403).json({
      success: false,
      error: 'Invalid authentication token.'
    });
    return;
  }

  next();
}
