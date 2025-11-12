const express = require('express');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Debug route: list users (limited)
router.get('/users', async (req, res) => {
  try {
    const users = await executeQuery(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users ORDER BY id DESC LIMIT 100'
    );
    res.json({ users });
  } catch (error) {
    console.error('Debug /users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user's email by id (debug only)
router.put('/users/:id/email', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { email } = req.body;
    if (!id || !email) {
      return res.status(400).json({ error: 'ID and email are required' });
    }

    // Check if email already used by another user
    const existing = await executeQuery('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    await executeQuery('UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?', [email, id]);
    const users = await executeQuery('SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?', [id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: users[0] });
  } catch (error) {
    console.error('Debug update user email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

module.exports = router;
