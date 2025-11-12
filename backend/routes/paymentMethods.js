const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all payment methods
router.get('/', authenticateToken, async (req, res) => {
  try {
    const paymentMethods = await executeQuery(`
      SELECT * FROM payment_methods 
      WHERE is_active = TRUE
      ORDER BY name ASC
    `);

    res.json(paymentMethods);

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Get single payment method
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const paymentMethods = await executeQuery(`
      SELECT * FROM payment_methods 
      WHERE id = ?
    `, [req.params.id]);

    if (paymentMethods.length === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    res.json(paymentMethods[0]);

  } catch (error) {
    console.error('Get payment method error:', error);
    res.status(500).json({ error: 'Failed to fetch payment method' });
  }
});

// Create new payment method
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      type = 'bank', 
      account_number, 
      account_name, 
      bank_name, 
      description,
      is_active = true 
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Payment method name is required' });
    }

    // Validate type
    const validTypes = ['bank', 'cash', 'e_wallet', 'credit_card', 'debit_card', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid payment method type' });
    }

    // Check if payment method already exists
    const existing = await executeQuery(
      'SELECT id FROM payment_methods WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Payment method already exists' });
    }

    const result = await executeQuery(`
      INSERT INTO payment_methods (
        name, type, account_number, bank_name, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [name, type, account_number, bank_name, description, is_active]);

    res.status(201).json({
      message: 'Payment method created successfully',
      paymentMethodId: result.insertId
    });

  } catch (error) {
    console.error('Create payment method error:', error);
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

// Update payment method
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      type, 
      account_number, 
      account_name, 
      bank_name, 
      description,
      is_active 
    } = req.body;

    // Check if payment method exists
    const existing = await executeQuery(
      'SELECT id FROM payment_methods WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['cash', 'bank', 'digital_wallet', 'credit_card', 'other'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid payment method type' });
      }
    }

    await executeQuery(`
      UPDATE payment_methods SET 
        name = ?, type = ?, account_number = ?,
        bank_name = ?, description = ?, is_active = ?
      WHERE id = ?
    `, [name, type, account_number, bank_name, description, is_active, req.params.id]);

    res.json({ message: 'Payment method updated successfully' });

  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

// Delete payment method
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if payment method exists
    const existing = await executeQuery(
      'SELECT id FROM payment_methods WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Check if payment method is being used
    const usage = await executeQuery(
      'SELECT COUNT(*) as count FROM transactions WHERE payment_method_id = ?',
      [req.params.id]
    );

    if (usage[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete payment method that is being used by transactions',
        usageCount: usage[0].count
      });
    }

    await executeQuery(
      'DELETE FROM payment_methods WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Payment method deleted successfully' });

  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// Get payment method usage statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Check if payment method exists
    const existing = await executeQuery(
      'SELECT id, name FROM payment_methods WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    let query = `
      SELECT 
        type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
      FROM transactions 
      WHERE payment_method_id = ?
    `;
    const params = [req.params.id];

    if (start_date) {
      query += ' AND transaction_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND transaction_date <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY type';

    const stats = await executeQuery(query, params);

    // Get recent transactions
    let recentQuery = `
      SELECT id, type, amount, description, transaction_date 
      FROM transactions 
      WHERE payment_method_id = ?
    `;
    const recentParams = [req.params.id];

    if (start_date) {
      recentQuery += ' AND transaction_date >= ?';
      recentParams.push(start_date);
    }

    if (end_date) {
      recentQuery += ' AND transaction_date <= ?';
      recentParams.push(end_date);
    }

    recentQuery += ' ORDER BY transaction_date DESC LIMIT 10';

    const recentTransactions = await executeQuery(recentQuery, recentParams);

    res.json({
      payment_method: existing[0],
      statistics: stats,
      recent_transactions: recentTransactions
    });

  } catch (error) {
    console.error('Get payment method stats error:', error);
    res.status(500).json({ error: 'Failed to fetch payment method statistics' });
  }
});

module.exports = router;