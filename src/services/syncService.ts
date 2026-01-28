import { query, getClient } from '../config/database';
import { categoryService, Category } from './categoryService';
import { todoService, Todo } from './todoService';

/**
 * Sync Service
 * 
 * This service handles the translation between LOCAL field names (used by client)
 * and REMOTE field names (used by PostgreSQL).
 * 
 * Field Mapping:
 * | Local (Client)    | Remote (PostgreSQL)   |
 * |-------------------|-----------------------|
 * | title             | name                  |
 * | description       | details               |
 * | is_completed      | done                  |
 * | created_at        | created_timestamp     |
 * | updated_at        | modified_at           |
 */

export interface SyncChanges {
  categories: {
    created: any[];
    updated: any[];
    deleted: string[];
  };
  todos: {
    created: any[];
    updated: any[];
    deleted: string[];
  };
}

export interface PullResponse {
  changes: SyncChanges;
  timestamp: number;
}

export interface PushRequest {
  changes: SyncChanges;
  lastPulledAt: number | null;
}

interface ConflictResolution {
  recordId: string;
  collection: string;
  winner: 'local' | 'remote';
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  reason: string;
}

export const syncService = {
  /**
   * Pull changes since lastPulledAt
   * Transforms REMOTE column names to LOCAL column names for the client
   */
  async pullChanges(userId: string, lastPulledAt: number | null): Promise<PullResponse> {
    const timestamp = Date.now();
    
    const [categoryChanges, todoChanges] = await Promise.all([
      categoryService.getChangesSince(userId, lastPulledAt),
      todoService.getChangesSince(userId, lastPulledAt),
    ]);
    
    /**
     * Transform category from REMOTE to LOCAL field names
     * Remote: name, created_timestamp, modified_at
     * Local: title, created_at, updated_at
     */
    const transformCategoryToLocal = (cat: Category) => ({
      id: cat.id,
      title: cat.name,  // Remote 'name' -> Local 'title'
      created_at: cat.created_timestamp,  // Remote 'created_timestamp' -> Local 'created_at'
      updated_at: cat.modified_at,  // Remote 'modified_at' -> Local 'updated_at'
    });
    
    /**
     * Transform todo from REMOTE to LOCAL field names
     * Remote: name, details, done, created_timestamp, modified_at
     * Local: title, description, is_completed, created_at, updated_at
     */
    const transformTodoToLocal = (todo: Todo) => ({
      id: todo.id,
      title: todo.name,  // Remote 'name' -> Local 'title'
      description: todo.details,  // Remote 'details' -> Local 'description'
      is_completed: todo.done,  // Remote 'done' -> Local 'is_completed'
      category_id: todo.category_id,
      created_at: todo.created_timestamp,  // Remote 'created_timestamp' -> Local 'created_at'
      updated_at: todo.modified_at,  // Remote 'modified_at' -> Local 'updated_at'
    });
    
    return {
      changes: {
        categories: {
          created: categoryChanges.created.map(transformCategoryToLocal),
          updated: categoryChanges.updated.map(transformCategoryToLocal),
          deleted: categoryChanges.deleted,
        },
        todos: {
          created: todoChanges.created.map(transformTodoToLocal),
          updated: todoChanges.updated.map(transformTodoToLocal),
          deleted: todoChanges.deleted,
        },
      },
      timestamp,
    };
  },

  /**
   * Push changes with LWW conflict resolution
   * Transforms LOCAL column names from client to REMOTE column names for PostgreSQL
   */
  async pushChanges(userId: string, request: PushRequest): Promise<{
    ok: boolean;
    conflicts: ConflictResolution[];
  }> {
    const client = await getClient();
    const conflicts: ConflictResolution[] = [];
    
    try {
      await client.query('BEGIN');
      
      // Process categories (with field mapping)
      await this.processCategoryChanges(
        client,
        userId,
        request.changes.categories,
        conflicts
      );
      
      // Process todos (with field mapping)
      await this.processTodoChanges(
        client,
        userId,
        request.changes.todos,
        conflicts
      );
      
      await client.query('COMMIT');
      
      console.log(`[Sync] Push completed. Conflicts: ${conflicts.length}`);
      if (conflicts.length > 0) {
        console.log('[Sync] Conflict resolutions:', JSON.stringify(conflicts, null, 2));
      }
      
      return { ok: true, conflicts };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Sync] Push failed:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Process category changes with LWW
   * Maps LOCAL field names to REMOTE column names:
   * - title -> name
   * - created_at -> created_timestamp
   * - updated_at -> modified_at
   */
  async processCategoryChanges(
    client: any,
    userId: string,
    changes: SyncChanges['categories'],
    conflicts: ConflictResolution[]
  ): Promise<void> {
    // Process created categories
    for (const record of changes.created) {
      const existing = await client.query(
        'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
        [record.id, userId]
      );
      
      if (existing.rows.length > 0) {
        // Record exists - check LWW
        const serverRecord = existing.rows[0];
        const resolution = this.resolveLWW(
          'categories',
          record.id,
          record.updated_at,  // Client sends 'updated_at'
          serverRecord.modified_at  // Server uses 'modified_at'
        );
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          // Client wins - update server record
          // Map: title -> name, created_at -> created_timestamp, updated_at -> modified_at
          await client.query(
            `UPDATE categories SET name = $1, created_timestamp = $2, modified_at = $3, is_deleted = FALSE
             WHERE id = $4 AND user_id = $5`,
            [record.title, record.created_at, record.updated_at, record.id, userId]
          );
        }
      } else {
        // New record - insert with field mapping
        await client.query(
          `INSERT INTO categories (id, user_id, name, created_timestamp, modified_at, is_deleted)
           VALUES ($1, $2, $3, $4, $5, FALSE)`,
          [record.id, userId, record.title, record.created_at, record.updated_at]
        );
      }
    }
    
    // Process updated categories
    for (const record of changes.updated) {
      const existing = await client.query(
        'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
        [record.id, userId]
      );
      
      if (existing.rows.length > 0) {
        const serverRecord = existing.rows[0];
        const resolution = this.resolveLWW(
          'categories',
          record.id,
          record.updated_at,
          serverRecord.modified_at
        );
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          await client.query(
            `UPDATE categories SET name = $1, modified_at = $2
             WHERE id = $3 AND user_id = $4`,
            [record.title, record.updated_at, record.id, userId]
          );
        }
      }
    }
    
    // Process deleted categories
    for (const id of changes.deleted) {
      const existing = await client.query(
        'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (existing.rows.length > 0) {
        const serverRecord = existing.rows[0];
        const now = Date.now();
        
        const resolution = this.resolveLWW('categories', id, now, serverRecord.modified_at);
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          await client.query(
            `UPDATE categories SET is_deleted = TRUE, modified_at = $1
             WHERE id = $2 AND user_id = $3`,
            [now, id, userId]
          );
        }
      }
    }
  },

  /**
   * Process todo changes with LWW
   * Maps LOCAL field names to REMOTE column names:
   * - title -> name
   * - description -> details
   * - is_completed -> done
   * - created_at -> created_timestamp
   * - updated_at -> modified_at
   */
  async processTodoChanges(
    client: any,
    userId: string,
    changes: SyncChanges['todos'],
    conflicts: ConflictResolution[]
  ): Promise<void> {
    // Process created todos
    for (const record of changes.created) {
      const existing = await client.query(
        'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
        [record.id, userId]
      );
      
      if (existing.rows.length > 0) {
        const serverRecord = existing.rows[0];
        const resolution = this.resolveLWW(
          'todos',
          record.id,
          record.updated_at,
          serverRecord.modified_at
        );
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          // Map: title->name, description->details, is_completed->done
          await client.query(
            `UPDATE todos SET name = $1, details = $2, done = $3, 
             category_id = $4, created_timestamp = $5, modified_at = $6, is_deleted = FALSE
             WHERE id = $7 AND user_id = $8`,
            [
              record.title,
              record.description,
              record.is_completed,
              record.category_id,
              record.created_at,
              record.updated_at,
              record.id,
              userId,
            ]
          );
        }
      } else {
        // Insert with field mapping
        await client.query(
          `INSERT INTO todos (id, user_id, name, details, done, category_id, created_timestamp, modified_at, is_deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)`,
          [
            record.id,
            userId,
            record.title,  // Local 'title' -> Remote 'name'
            record.description || null,  // Local 'description' -> Remote 'details'
            record.is_completed || false,  // Local 'is_completed' -> Remote 'done'
            record.category_id || null,
            record.created_at,  // Local 'created_at' -> Remote 'created_timestamp'
            record.updated_at,  // Local 'updated_at' -> Remote 'modified_at'
          ]
        );
      }
    }
    
    // Process updated todos
    for (const record of changes.updated) {
      const existing = await client.query(
        'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
        [record.id, userId]
      );
      
      if (existing.rows.length > 0) {
        const serverRecord = existing.rows[0];
        const resolution = this.resolveLWW(
          'todos',
          record.id,
          record.updated_at,
          serverRecord.modified_at
        );
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          await client.query(
            `UPDATE todos SET name = $1, details = $2, done = $3,
             category_id = $4, modified_at = $5
             WHERE id = $6 AND user_id = $7`,
            [
              record.title,
              record.description,
              record.is_completed,
              record.category_id,
              record.updated_at,
              record.id,
              userId,
            ]
          );
        }
      }
    }
    
    // Process deleted todos
    for (const id of changes.deleted) {
      const existing = await client.query(
        'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (existing.rows.length > 0) {
        const serverRecord = existing.rows[0];
        const now = Date.now();
        
        const resolution = this.resolveLWW('todos', id, now, serverRecord.modified_at);
        conflicts.push(resolution);
        
        if (resolution.winner === 'local') {
          await client.query(
            `UPDATE todos SET is_deleted = TRUE, modified_at = $1
             WHERE id = $2 AND user_id = $3`,
            [now, id, userId]
          );
        }
      }
    }
  },

  /**
   * Last-Write-Wins conflict resolution
   * Compares timestamps and returns which version should win
   */
  resolveLWW(
    collection: string,
    recordId: string,
    localUpdatedAt: number,
    remoteUpdatedAt: number
  ): ConflictResolution {
    // Local wins if its timestamp is strictly greater
    // Server wins on tie (server authority)
    const winner = localUpdatedAt > remoteUpdatedAt ? 'local' : 'remote';
    
    return {
      recordId,
      collection,
      winner,
      localUpdatedAt,
      remoteUpdatedAt,
      reason: winner === 'local'
        ? `Local timestamp (${localUpdatedAt}) > remote (${remoteUpdatedAt})`
        : localUpdatedAt === remoteUpdatedAt
          ? `Timestamps equal (${localUpdatedAt}). Server wins by authority.`
          : `Remote timestamp (${remoteUpdatedAt}) > local (${localUpdatedAt})`,
    };
  },
};
