const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const filter = req.query.filter; // all, pending, completed, favorites, work, personal
    const search = req.query.search;
    
    let queryArgs = [req.user.id];
    let queryStr = 'SELECT * FROM tasks WHERE user_id = ?';

    if (filter === 'completed') { queryStr += ' AND completed = 1'; }
    else if (filter === 'pending') { queryStr += ' AND completed = 0'; }
    else if (filter === 'favorites') { queryStr += ' AND favorite = 1'; }
    else if (filter === 'Work') { queryStr += ' AND category = \'Work\''; }
    else if (filter === 'Personal') { queryStr += ' AND category = \'Personal\''; }

    if (search) {
      queryStr += ' AND (title LIKE ? OR description LIKE ?)';
      queryArgs.push(`%${search}%`, `%${search}%`);
    }
    
    // Sort by favorite first, then pending/completed, then date
    queryStr += ' ORDER BY favorite DESC, completed ASC, due_date ASC, created_at DESC';

    const tasks = db.prepare(queryStr).all(...queryArgs);
    const formatted = tasks.map(t => ({...t, completed: t.completed === 1, favorite: t.favorite === 1}));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, description, priority, category, due_date, favorite } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const info = db.prepare(
      'INSERT INTO tasks (title, description, priority, category, due_date, user_id, completed, favorite) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(
      title, 
      description || null, 
      priority || 'Medium', 
      category || 'General', 
      due_date || null, 
      req.user.id,
      favorite ? 1 : 0
    );
    
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({...newTask, completed: false, favorite: newTask.favorite === 1});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, completed, favorite, due_date } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Not found' });

    let updates = [];
    let values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (completed !== undefined) { updates.push('completed = ?'); values.push(completed ? 1 : 0); }
    if (favorite !== undefined) { updates.push('favorite = ?'); values.push(favorite ? 1 : 0); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }

    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id, req.user.id);
      db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({...updatedTask, completed: updatedTask.completed === 1, favorite: updatedTask.favorite === 1});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
