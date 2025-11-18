const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get income transaction details by project and category
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, category_name, start_date, end_date } = req.query;
    if (!project_id || !category_name) {
      return res.status(400).json({ error: 'project_id and category_name are required' });
    }
    let query = `
      SELECT t.*,
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.type = 'income' AND t.project_id = ? AND tc.name = ?
    `;
    const params = [project_id, category_name];
    if (start_date) {
      query += ' AND t.transaction_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND t.transaction_date <= ?';
      params.push(end_date);
    }
    query += ' ORDER BY t.transaction_date DESC, t.created_at DESC';
    const transactions = await executeQuery(query, params);
    res.json({ transactions });
  } catch (error) {
    console.error('Get income details error:', error);
    res.status(500).json({ error: 'Failed to fetch income details' });
  }
});

module.exports = router;
