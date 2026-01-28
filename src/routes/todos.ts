import { Router, Request, Response } from 'express';
import { todoService } from '../services/todoService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Transform todo from REMOTE to API response format
 * Maps: name -> title, details -> description, done -> is_completed,
 *       created_timestamp -> created_at, modified_at -> updated_at
 */
const transformToResponse = (todo: any) => ({
  id: todo.id,
  title: todo.name,  // Remote 'name' -> Response 'title'
  description: todo.details,  // Remote 'details' -> Response 'description'
  is_completed: todo.done,  // Remote 'done' -> Response 'is_completed'
  category_id: todo.category_id,
  created_at: todo.created_timestamp,
  updated_at: todo.modified_at,
});

/**
 * GET /api/todos
 * Get all todos for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const todos = await todoService.getAll(req.userId!);
    res.json(todos.map(transformToResponse));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get todos';
    console.error('[Todos] Get all error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/todos/:id
 * Get a specific todo
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const todo = await todoService.getById(req.params.id as string, req.userId!);
    
    if (!todo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    
    res.json(transformToResponse(todo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get todo';
    console.error('[Todos] Get by ID error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/todos
 * Create a new todo
 * Accepts client field names (title, description, is_completed)
 * Maps to remote column names (name, details, done)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, category_id, is_completed } = req.body;
    
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    
    // Map client fields to remote column names
    const todo = await todoService.create(req.userId!, {
      name: title,  // Client 'title' -> Remote 'name'
      details: description,  // Client 'description' -> Remote 'details'
      done: is_completed,  // Client 'is_completed' -> Remote 'done'
      category_id,
    });
    
    console.log(`[Todos] Created: ${todo.id}`);
    res.status(201).json(transformToResponse(todo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create todo';
    console.error('[Todos] Create error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/todos/:id
 * Update a todo
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, category_id, is_completed } = req.body;
    
    // Map client fields to remote column names
    const todo = await todoService.update(req.params.id as string, req.userId!, {
      name: title,  // Client 'title' -> Remote 'name'
      details: description,  // Client 'description' -> Remote 'details'
      done: is_completed,  // Client 'is_completed' -> Remote 'done'
      category_id,
    });
    
    if (!todo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    
    console.log(`[Todos] Updated: ${todo.id}`);
    res.json(transformToResponse(todo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update todo';
    console.error('[Todos] Update error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/todos/:id
 * Soft delete a todo
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await todoService.delete(req.params.id as string, req.userId!);
    
    if (!deleted) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    
    console.log(`[Todos] Deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete todo';
    console.error('[Todos] Delete error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
