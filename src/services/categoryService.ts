import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

/**
 * Category interface using REMOTE column names (PostgreSQL)
 * 
 * Field mapping (Local -> Remote):
 * - title -> name
 * - created_at -> created_timestamp
 * - updated_at -> modified_at
 */
export interface Category {
  id: string;
  user_id: string;
  name: string;  // Remote column name (local: title)
  created_timestamp: number;  // Remote column name (local: created_at)
  modified_at: number;  // Remote column name (local: updated_at)
  is_deleted: boolean;
}

export interface CreateCategoryInput {
  id?: string;
  name: string;  // Using remote column name
  created_timestamp?: number;
  modified_at?: number;
}

export interface UpdateCategoryInput {
  name?: string;  // Using remote column name
  modified_at?: number;
}

export const categoryService = {
  /**
   * Get all categories for a user (excluding deleted)
   */
  async getAll(userId: string): Promise<Category[]> {
    const result = await query(
      `SELECT * FROM categories 
       WHERE user_id = $1 AND is_deleted = FALSE 
       ORDER BY created_timestamp DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Get a category by ID
   */
  async getById(id: string, userId: string): Promise<Category | null> {
    const result = await query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new category
   */
  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const id = input.id || uuidv4();
    const now = Date.now();
    const createdTimestamp = input.created_timestamp || now;
    const modifiedAt = input.modified_at || now;

    const result = await query(
      `INSERT INTO categories (id, user_id, name, created_timestamp, modified_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING *`,
      [id, userId, input.name, createdTimestamp, modifiedAt]
    );
    return result.rows[0];
  },

  /**
   * Update a category
   */
  async update(id: string, userId: string, input: UpdateCategoryInput): Promise<Category | null> {
    const now = Date.now();
    const modifiedAt = input.modified_at || now;

    const result = await query(
      `UPDATE categories 
       SET name = COALESCE($1, name), modified_at = $2
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [input.name, modifiedAt, id, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Soft delete a category
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const now = Date.now();
    const result = await query(
      `UPDATE categories 
       SET is_deleted = TRUE, modified_at = $1
       WHERE id = $2 AND user_id = $3`,
      [now, id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Get categories changed since a timestamp (for sync)
   */
  async getChangesSince(userId: string, since: number | null): Promise<{
    created: Category[];
    updated: Category[];
    deleted: string[];
  }> {
    if (since === null) {
      // First sync - return all non-deleted categories as created
      const result = await query(
        `SELECT * FROM categories 
         WHERE user_id = $1 AND is_deleted = FALSE
         ORDER BY created_timestamp`,
        [userId]
      );
      return {
        created: result.rows,
        updated: [],
        deleted: [],
      };
    }

    // Get all changes since timestamp
    const result = await query(
      `SELECT * FROM categories 
       WHERE user_id = $1 AND modified_at > $2
       ORDER BY modified_at`,
      [userId, since]
    );

    const created: Category[] = [];
    const updated: Category[] = [];
    const deleted: string[] = [];

    for (const row of result.rows) {
      if (row.is_deleted) {
        deleted.push(row.id);
      } else if (row.created_timestamp > since) {
        created.push(row);
      } else {
        updated.push(row);
      }
    }

    return { created, updated, deleted };
  },
};
