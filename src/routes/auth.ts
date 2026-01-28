import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    const user = await authService.register({ email, password });
    
    console.log(`[Auth] User registered: ${user.email}`);
    
    res.status(201).json({
      id: user.id,
      email: user.email,
      created_at: user.created_timestamp,  // Map remote to standard response
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    console.error('[Auth] Register error:', message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/auth/login
 * Login and get user ID (used as token)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    const user = await authService.login({ email, password });
    
    console.log(`[Auth] User logged in: ${user.email}`);
    
    // Return user ID as the "token" for simplicity
    res.json({
      token: user.id,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    console.error('[Auth] Login error:', message);
    res.status(401).json({ error: message });
  }
});

export default router;
