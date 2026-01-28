import { Router, Request, Response } from 'express';
import { syncService } from '../services/syncService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/sync/pull
 * Pull changes from server since lastPulledAt
 * 
 * Request body:
 * {
 *   lastPulledAt: number | null,
 *   schemaVersion: number
 * }
 * 
 * Response:
 * {
 *   changes: {
 *     categories: { created: [], updated: [], deleted: [] },
 *     todos: { created: [], updated: [], deleted: [] }
 *   },
 *   timestamp: number
 * }
 */
router.post('/pull', async (req: Request, res: Response) => {
  try {
    const { lastPulledAt, schemaVersion } = req.body;
    
    console.log(`[Sync] Pull request from user ${req.userId}`);
    console.log(`[Sync] lastPulledAt: ${lastPulledAt}, schemaVersion: ${schemaVersion}`);
    
    const response = await syncService.pullChanges(req.userId!, lastPulledAt);
    
    const totalChanges = 
      response.changes.categories.created.length +
      response.changes.categories.updated.length +
      response.changes.categories.deleted.length +
      response.changes.todos.created.length +
      response.changes.todos.updated.length +
      response.changes.todos.deleted.length;
    
    console.log(`[Sync] Pull response: ${totalChanges} changes, timestamp: ${response.timestamp}`);
    
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pull failed';
    console.error('[Sync] Pull error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/sync/push
 * Push local changes to server
 * 
 * Request body:
 * {
 *   changes: {
 *     categories: { created: [], updated: [], deleted: [] },
 *     todos: { created: [], updated: [], deleted: [] }
 *   },
 *   lastPulledAt: number
 * }
 * 
 * Response:
 * {
 *   ok: boolean,
 *   conflicts?: []
 * }
 */
router.post('/push', async (req: Request, res: Response) => {
  try {
    const { changes, lastPulledAt } = req.body;
    
    if (!changes) {
      res.status(400).json({ error: 'Changes object is required' });
      return;
    }
    
    console.log(`[Sync] Push request from user ${req.userId}`);
    console.log(`[Sync] lastPulledAt: ${lastPulledAt}`);
    
    // Log incoming changes summary
    const summary = {
      categories: {
        created: changes.categories?.created?.length || 0,
        updated: changes.categories?.updated?.length || 0,
        deleted: changes.categories?.deleted?.length || 0,
      },
      todos: {
        created: changes.todos?.created?.length || 0,
        updated: changes.todos?.updated?.length || 0,
        deleted: changes.todos?.deleted?.length || 0,
      },
    };
    console.log(`[Sync] Push changes:`, JSON.stringify(summary));
    
    // Ensure changes has proper structure
    const normalizedChanges = {
      categories: {
        created: changes.categories?.created || [],
        updated: changes.categories?.updated || [],
        deleted: changes.categories?.deleted || [],
      },
      todos: {
        created: changes.todos?.created || [],
        updated: changes.todos?.updated || [],
        deleted: changes.todos?.deleted || [],
      },
    };
    
    const result = await syncService.pushChanges(req.userId!, {
      changes: normalizedChanges,
      lastPulledAt,
    });
    
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push failed';
    console.error('[Sync] Push error:', message);
    res.status(500).json({ error: message, ok: false });
  }
});

export default router;
