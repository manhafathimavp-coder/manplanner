const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Middleware to check for superadmin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    return res.status(403).json({ error: 'Super Admin privileges required.' });
  }
};

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    const users = result.rows;
    
    // Enrich with task count for each user
    const usersWithStats = await Promise.all(users.map(async u => {
      const stats = await db.one('SELECT COUNT(*) as count FROM tasks WHERE user_id = $1', [u.id]);
      return { ...u, taskCount: stats.count };
    }));

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself.' });
    }
    await db.run('DELETE FROM users WHERE id = $1', [targetId]);
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
