const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all categories (transaction and project)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query; // 'transaction' or 'project'

    let transactionCategories = [];
    let projectCategories = [];

    if (!type || type === 'transaction') {
      transactionCategories = await executeQuery(`
        SELECT * FROM transaction_categories 
        WHERE is_active = TRUE
        ORDER BY name ASC
      `);
    }

    if (!type || type === 'project') {
      projectCategories = await executeQuery(`
        SELECT * FROM project_categories 
        WHERE is_active = TRUE
        ORDER BY name ASC
      `);
    }

    res.json({
      transaction_categories: transactionCategories,
      project_categories: projectCategories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Transaction Categories Routes
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const categories = await executeQuery(`
      SELECT * FROM transaction_categories 
      WHERE is_active = TRUE
      ORDER BY name ASC
    `);

    res.json(categories);

  } catch (error) {
    console.error('Get transaction categories error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction categories' });
  }
});

router.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const { name, description, color = '#3B82F6', type = 'expense' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists
    const existing = await executeQuery(
      'SELECT id FROM transaction_categories WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const result = await executeQuery(`
      INSERT INTO transaction_categories (name, type, description, color, is_active, created_at)
      VALUES (?, ?, ?, ?, TRUE, NOW())
    `, [name, type, description, color]);

    res.status(201).json({
      message: 'Transaction category created successfully',
      categoryId: result.insertId
    });

  } catch (error) {
    console.error('Create transaction category error:', error);
    res.status(500).json({ error: 'Failed to create transaction category' });
  }
});

router.put('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, color, type } = req.body;

    // Check if category exists
    const existing = await executeQuery(
      'SELECT id FROM transaction_categories WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await executeQuery(`
      UPDATE transaction_categories SET 
        name = ?, type = ?, description = ?, color = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, type, description, color, req.params.id]);

    res.json({ message: 'Transaction category updated successfully' });

  } catch (error) {
    console.error('Update transaction category error:', error);
    res.status(500).json({ error: 'Failed to update transaction category' });
  }
});

router.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if category exists
    const existing = await executeQuery(
      'SELECT id FROM transaction_categories WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category is being used
    const usage = await executeQuery(
      'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
      [req.params.id]
    );

    if (usage[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that is being used by transactions',
        usageCount: usage[0].count
      });
    }

    await executeQuery(
      'DELETE FROM transaction_categories WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Transaction category deleted successfully' });

  } catch (error) {
    console.error('Delete transaction category error:', error);
    res.status(500).json({ error: 'Failed to delete transaction category' });
  }
});

// Project Categories Routes
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const categories = await executeQuery(`
      SELECT * FROM project_categories 
      ORDER BY name ASC
    `);

    res.json(categories);

  } catch (error) {
    console.error('Get project categories error:', error);
    res.status(500).json({ error: 'Failed to fetch project categories' });
  }
});

router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, color = '#10B981', description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists
    const existing = await executeQuery(
      'SELECT id FROM project_categories WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const result = await executeQuery(`
      INSERT INTO project_categories (name, color, description, created_at)
      VALUES (?, ?, ?, NOW())
    `, [name, color, description]);

    res.status(201).json({
      message: 'Project category created successfully',
      categoryId: result.insertId
    });

  } catch (error) {
    console.error('Create project category error:', error);
    res.status(500).json({ error: 'Failed to create project category' });
  }
});

router.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color, description } = req.body;

    // Check if category exists
    const existing = await executeQuery(
      'SELECT id FROM project_categories WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await executeQuery(`
      UPDATE project_categories SET 
        name = ?, color = ?, description = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, color, description, req.params.id]);

    res.json({ message: 'Project category updated successfully' });

  } catch (error) {
    console.error('Update project category error:', error);
    res.status(500).json({ error: 'Failed to update project category' });
  }
});

router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    // Check if category exists
    const existing = await executeQuery(
      'SELECT id FROM project_categories WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category is being used
    const usage = await executeQuery(
      'SELECT COUNT(*) as count FROM projects WHERE category_id = ?',
      [req.params.id]
    );

    if (usage[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that is being used by projects',
        usageCount: usage[0].count
      });
    }

    await executeQuery(
      'DELETE FROM project_categories WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Project category deleted successfully' });

  } catch (error) {
    console.error('Delete project category error:', error);
    res.status(500).json({ error: 'Failed to delete project category' });
  }
});

module.exports = router;