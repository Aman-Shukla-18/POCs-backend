import { Router, Request, Response } from 'express';
import { categoryService } from '../services/categoryService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Transform category from REMOTE to API response format
 * Maps: name -> title, created_timestamp -> created_at, modified_at -> updated_at
 */
const transformToResponse = (category: any) => ({
  id: category.id,
  title: category.name,  // Remote 'name' -> Response 'title'
  created_at: category.created_timestamp,
  updated_at: category.modified_at,
});

/**
 * GET /api/categories
 * Get all categories for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await categoryService.getAll(req.userId!);
    res.json(categories.map(transformToResponse));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get categories';
    console.error('[Categories] Get all error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/categories/:id
 * Get a specific category
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const category = await categoryService.getById(req.params.id as string, req.userId!);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    res.json(transformToResponse(category));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get category';
    console.error('[Categories] Get by ID error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/categories
 * Create a new category
 * Accepts 'title' from client, maps to 'name' in database
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;  // Client sends 'title'
    
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    
    // Map 'title' -> 'name' for database
    const category = await categoryService.create(req.userId!, { name: title });
    
    console.log(`[Categories] Created: ${category.id}`);
    res.status(201).json(transformToResponse(category));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create category';
    console.error('[Categories] Create error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/categories/:id
 * Update a category
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;  // Client sends 'title'
    
    // Map 'title' -> 'name' for database
    const category = await categoryService.update(req.params.id as string, req.userId!, { name: title });
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    console.log(`[Categories] Updated: ${category.id}`);
    res.json(transformToResponse(category));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update category';
    console.error('[Categories] Update error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/categories/:id
 * Soft delete a category
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await categoryService.delete(req.params.id as string, req.userId!);
    
    if (!deleted) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    console.log(`[Categories] Deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete category';
    console.error('[Categories] Delete error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
