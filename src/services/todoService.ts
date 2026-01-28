import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

/**
 * Todo interface using REMOTE column names (PostgreSQL)
 * 
 * Field mapping (Local -> Remote):
 * - title -> name
 * - description -> details
 * - is_completed -> done
 * - created_at -> created_timestamp
 * - updated_at -> modified_at
 */
export interface Todo {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;  // Remote column name (local: title)
  details: string | null;  // Remote column name (local: description)
  done: boolean;  // Remote column name (local: is_completed)
  created_timestamp: number;  // Remote column name (local: created_at)
  modified_at: number;  // Remote column name (local: updated_at)
  is_deleted: boolean;
}

export interface CreateTodoInput {
  id?: string;
  category_id?: string | null;
  name: string;  // Remote column name
  details?: string | null;  // Remote column name
  done?: boolean;  // Remote column name
  created_timestamp?: number;
  modified_at?: number;
}

export interface UpdateTodoInput {
  category_id?: string | null;
  name?: string;  // Remote column name
  details?: string | null;  // Remote column name
  done?: boolean;  // Remote column name
  modified_at?: number;
}

export const todoService = {
  /**
   * Get all todos for a user (excluding deleted)
   */
  async getAll(userId: string): Promise<Todo[]> {
    const result = await query(
      `SELECT * FROM todos 
       WHERE user_id = $1 AND is_deleted = FALSE 
       ORDER BY created_timestamp DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Get a todo by ID
   */
  async getById(id: string, userId: string): Promise<Todo | null> {
    const result = await query(
      'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get todos by category
   */
  async getByCategory(categoryId: string, userId: string): Promise<Todo[]> {
    const result = await query(
      `SELECT * FROM todos 
       WHERE category_id = $1 AND user_id = $2 AND is_deleted = FALSE
       ORDER BY created_timestamp DESC`,
      [categoryId, userId]
    );
    return result.rows;
  },

  /**
   * Create a new todo
   */
  async create(userId: string, input: CreateTodoInput): Promise<Todo> {
    const id = input.id || uuidv4();
    const now = Date.now();
    const createdTimestamp = input.created_timestamp || now;
    const modifiedAt = input.modified_at || now;

    const result = await query(
      `INSERT INTO todos (id, user_id, category_id, name, details, done, created_timestamp, modified_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       RETURNING *`,
      [
        id,
        userId,
        input.category_id || null,
        input.name,
        input.details || null,
        input.done || false,
        createdTimestamp,
        modifiedAt,
      ]
    );
    return result.rows[0];
  },

  /**
   * Update a todo
   */
  async update(id: string, userId: string, input: UpdateTodoInput): Promise<Todo | null> {
    const now = Date.now();
    const modifiedAt = input.modified_at || now;

    // Build dynamic update query
    const updates: string[] = ['modified_at = $1'];
    const values: any[] = [modifiedAt];
    let paramIndex = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.details !== undefined) {
      updates.push(`details = $${paramIndex++}`);
      values.push(input.details);
    }
    if (input.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(input.category_id);
    }
    if (input.done !== undefined) {
      updates.push(`done = $${paramIndex++}`);
      values.push(input.done);
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE todos 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Soft delete a todo
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const now = Date.now();
    const result = await query(
      `UPDATE todos 
       SET is_deleted = TRUE, modified_at = $1
       WHERE id = $2 AND user_id = $3`,
      [now, id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Get todos changed since a timestamp (for sync)
   */
  async getChangesSince(userId: string, since: number | null): Promise<{
    created: Todo[];
    updated: Todo[];
    deleted: string[];
  }> {
    if (since === null) {
      // First sync - return all non-deleted todos as created
      const result = await query(
        `SELECT * FROM todos 
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
      `SELECT * FROM todos 
       WHERE user_id = $1 AND modified_at > $2
       ORDER BY modified_at`,
      [userId, since]
    );

    const created: Todo[] = [];
    const updated: Todo[] = [];
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
