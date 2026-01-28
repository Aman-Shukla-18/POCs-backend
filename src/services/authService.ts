import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

/**
 * User interface using REMOTE column names (PostgreSQL)
 * created_timestamp and modified_at instead of created_at/updated_at
 */
export interface User {
  id: string;
  email: string;
  password: string;
  created_timestamp: number;
  modified_at: number;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authService = {
  /**
   * Register a new user
   * Note: Password is stored as plain text for POC purposes only
   */
  async register(input: RegisterInput): Promise<User> {
    const { email, password } = input;
    
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    const result = await query(
      `INSERT INTO users (id, email, password, created_timestamp, modified_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, email, password, now, now]
    );
    
    return result.rows[0];
  },
  
  /**
   * Login user
   * Note: Plain text password comparison for POC purposes only
   */
  async login(input: LoginInput): Promise<User> {
    const { email, password } = input;
    
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }
    
    return result.rows[0];
  },
  
  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};
