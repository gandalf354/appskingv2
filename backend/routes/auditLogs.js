const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all audit logs (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied. Admin or manager only.' });
    }

    const { 
      user_id,
      action_type,
      start_date,
      end_date,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const parsedLimit = parseInt(limit) || 50;
    const parsedPage = parseInt(page) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    let query = `
      SELECT al.*,
             t.transaction_code,
             t.type as transaction_type,
             t.amount as transaction_amount,
             t.description as transaction_description,
             p.name as project_name
      FROM audit_logs al
      LEFT JOIN transactions t ON al.transaction_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (action_type) {
      query += ' AND al.action_type = ?';
      params.push(action_type);
    }

    if (start_date && start_date !== '') {
      query += ' AND al.created_at >= ?';
      params.push(start_date);
    }

    if (end_date && end_date !== '') {
      query += ' AND al.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    query += ` ORDER BY al.created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;

    const logs = await executeQuery(query, params);

    // Format dates for all logs
    const formattedLogs = logs.map(log => {
      if (log.transaction_date) {
        const date = new Date(log.transaction_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        log.transaction_date = `${year}-${month}-${day}`;
      }
      
      if (log.created_at) {
        const createdDate = new Date(log.created_at);
        log.created_at_formatted = createdDate.toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      
      return log;
    });

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (user_id) {
      countQuery += ' AND user_id = ?';
      countParams.push(parseInt(user_id));
    }

    if (action_type) {
      countQuery += ' AND action_type = ?';
      countParams.push(action_type);
    }

    if (start_date && start_date !== '') {
      countQuery += ' AND created_at >= ?';
      countParams.push(start_date);
    }

    if (end_date && end_date !== '') {
      countQuery += ' AND created_at <= ?';
      countParams.push(end_date + ' 23:59:59');
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      logs: formattedLogs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log statistics (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied. Admin or manager only.' });
    }

    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        action_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (start_date && start_date !== '') {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date && end_date !== '') {
      query += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    query += ' GROUP BY action_type';

    const stats = await executeQuery(query, params);

    const result = {
      total_edits: 0,
      total_creates: 0,
      total_logs: 0
    };

    stats.forEach(row => {
      if (row.action_type === 'EDIT') {
        result.total_edits = row.count;
      } else if (row.action_type === 'CREATE') {
        result.total_creates = row.count;
      }
      result.total_logs += row.count;
    });

    res.json(result);

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Delete audit log (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied. Admin or manager only.' });
    }

    const logId = parseInt(req.params.id);

    // Check if log exists
    const existingLog = await executeQuery(
      'SELECT id FROM audit_logs WHERE id = ?',
      [logId]
    );

    if (existingLog.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    // Delete the log
    await executeQuery('DELETE FROM audit_logs WHERE id = ?', [logId]);

    res.json({ message: 'Audit log deleted successfully' });

  } catch (error) {
    console.error('Delete audit log error:', error);
    res.status(500).json({ error: 'Failed to delete audit log' });
  }
});

module.exports = router;
