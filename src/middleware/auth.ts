import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Simple auth middleware
 * Expects: Authorization: Bearer <userId>
 * For POC purposes, we just verify the userId exists in the database
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }
    
    const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!userId) {
      res.status(401).json({ error: 'Invalid authorization token' });
      return;
    }
    
    // Verify user exists
    const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    req.userId = userId;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};
