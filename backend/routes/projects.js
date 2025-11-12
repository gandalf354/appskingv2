const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, category_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('User ID from token:', req.user.id);
    console.log('Query params:', { status, category_id, page, limit, offset });

    // Build dynamic query with transaction totals
    let query = `
      SELECT p.*, 
             pc.name as category_name, 
             pc.color as category_color,
             COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
             COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      LEFT JOIN transactions t ON p.id = t.project_id
      WHERE 1=1
    `;
    const params = [];

    // Add status filter
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    // Add category filter
    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }

    // Add GROUP BY before ordering
    query += ' GROUP BY p.id';

    // Add ordering and pagination
    query += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    console.log('Final query:', query);
    console.log('Final params:', params);

    const projects = await executeQuery(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM projects WHERE 1=1';
    const countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (category_id) {
      countQuery += ' AND category_id = ?';
      countParams.push(category_id);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const projects = await executeQuery(`
      SELECT p.*, pc.name as category_name, pc.color as category_color
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      WHERE p.id = ?
    `, [req.params.id, req.user.id]);

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project milestones
    const milestones = await executeQuery(`
      SELECT * FROM project_milestones 
      WHERE project_id = ? 
      ORDER BY due_date ASC
    `, [req.params.id]);

    // Get project transactions
    const transactions = await executeQuery(`
      SELECT t.*, tc.name as category_name, pm.name as payment_method_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.project_id = ?
      ORDER BY t.transaction_date DESC
    `, [req.params.id]);

    // Calculate total income and expense
    const financialSummary = await executeQuery(`
      SELECT 
        type,
        SUM(amount) as total
      FROM transactions
      WHERE project_id = ?
      GROUP BY type
    `, [req.params.id]);

    let total_income = 0;
    let total_expense = 0;

    financialSummary.forEach(row => {
      if (row.type === 'income') {
        total_income = parseFloat(row.total) || 0;
      } else if (row.type === 'expense') {
        total_expense = parseFloat(row.total) || 0;
      }
    });

    const project = {
      ...projects[0],
      milestones,
      transactions,
      total_income,
      total_expense,
      balance: total_income - total_expense
    };

    res.json(project);

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      budget,
      start_date,
      end_date,
      client_name,
      client_email,
      client_phone,
      status = 'active'
    } = req.body;

    if (!name || !budget) {
      return res.status(400).json({ error: 'Name and budget are required' });
    }

    const result = await executeQuery(`
      INSERT INTO projects (
        created_by, name, description, category_id, budget, 
        start_date, end_date, client_name, client_email, 
        client_phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id, name, description, category_id, budget,
      start_date, end_date, client_name, client_email,
      client_phone, status
    ]);

    res.status(201).json({
      message: 'Project created successfully',
      projectId: result.insertId
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      budget,
      start_date,
      end_date,
      client_name,
      client_email,
      client_phone,
      status
    } = req.body;

    // Check if project exists
    const existingProject = await executeQuery(
      'SELECT id FROM projects WHERE id = ?',
      [req.params.id]
    );

    if (existingProject.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await executeQuery(`
      UPDATE projects SET 
        name = ?, description = ?, category_id = ?, budget = ?,
        start_date = ?, end_date = ?, client_name = ?,
        client_email = ?, client_phone = ?, status = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      name, description, category_id, budget,
      start_date, end_date, client_name,
      client_email, client_phone, status,
      req.params.id
    ]);

    res.json({ message: 'Project updated successfully' });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if project exists
    const existingProject = await executeQuery(
      'SELECT id FROM projects WHERE id = ?',
      [req.params.id]
    );

    if (existingProject.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete project (cascading deletes handled by foreign keys)
    await executeQuery(
      'DELETE FROM projects WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Project deleted successfully' });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Project milestones routes
router.get('/:id/milestones', authenticateToken, async (req, res) => {
  try {
    // Verify project ownership
    const project = await executeQuery(
      'SELECT id FROM projects WHERE id = ?',
      [req.params.id, req.user.id]
    );

    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const milestones = await executeQuery(
      'SELECT * FROM project_milestones WHERE project_id = ? ORDER BY due_date ASC',
      [req.params.id]
    );

    res.json(milestones);

  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

router.post('/:id/milestones', authenticateToken, async (req, res) => {
  try {
    const { title, description, due_date, amount, status = 'pending' } = req.body;

    if (!title || !due_date) {
      return res.status(400).json({ error: 'Title and due date are required' });
    }

    // Verify project ownership
    const project = await executeQuery(
      'SELECT id FROM projects WHERE id = ?',
      [req.params.id, req.user.id]
    );

    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await executeQuery(`
      INSERT INTO project_milestones (project_id, title, description, due_date, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, title, description, due_date, amount, status]);

    res.status(201).json({
      message: 'Milestone created successfully',
      milestoneId: result.insertId
    });

  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

router.put('/:id/milestones/:milestoneId', authenticateToken, async (req, res) => {
  try {
    const { title, description, due_date, amount, status } = req.body;

    // Verify project ownership
    const project = await executeQuery(
      'SELECT id FROM projects WHERE id = ?',
      [req.params.id, req.user.id]
    );

    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await executeQuery(`
      UPDATE project_milestones SET 
        title = ?, description = ?, due_date = ?, amount = ?, status = ?,
        updated_at = NOW()
      WHERE id = ? AND project_id = ?
    `, [title, description, due_date, amount, status, req.params.milestoneId, req.params.id]);

    res.json({ message: 'Milestone updated successfully' });

  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

module.exports = router;