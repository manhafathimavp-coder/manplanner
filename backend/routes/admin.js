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

router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    
    // Enrich with task count for each user
    const usersWithStats = users.map(u => {
      const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(u.id).count;
      return { ...u, taskCount };
    });

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself.' });
    }
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
