const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get expense transaction details by project and reference_number
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, reference_number, start_date, end_date } = req.query;
    console.log('[DEBUG] /expense-details params:', { project_id, reference_number, start_date, end_date });
    if (!project_id || !reference_number) {
      return res.status(400).json({ error: 'project_id and reference_number are required' });
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
      WHERE t.description = 'Pengeluaran' AND t.project_id = ? AND t.reference_number = ?
    `;
    const params = [project_id, reference_number];
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
    console.log('[DEBUG] /expense-details result count:', transactions.length);
    if (transactions.length === 0) {
      console.log('[DEBUG] Tidak ada transaksi ditemukan untuk', { project_id, reference_number });
    }
    res.json({ transactions });
  } catch (error) {
    console.error('Get expense details error:', error);
    res.status(500).json({ error: 'Failed to fetch expense details' });
  }
});

module.exports = router;
