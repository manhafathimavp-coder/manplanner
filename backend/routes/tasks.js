const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { filter, search } = req.query;
    let queryArgs = [req.user.id];
    let queryStr = 'SELECT * FROM tasks WHERE user_id = $1';

    if (filter === 'completed') { queryStr += ' AND completed = true'; }
    else if (filter === 'pending') { queryStr += ' AND completed = false'; }
    else if (filter === 'favorites') { queryStr += ' AND favorite = true'; }
    else if (filter === 'Work' || filter === 'Personal') { 
        queryStr += ` AND category = $${queryArgs.length + 1}`; 
        queryArgs.push(filter); 
    }

    if (search) {
      queryStr += ` AND (title LIKE $${queryArgs.length + 1} OR description LIKE $${queryArgs.length + 2})`;
      queryArgs.push(`%${search}%`, `%${search}%`);
    }
    
    queryStr += ' ORDER BY favorite DESC, completed ASC, due_date ASC, created_at DESC';

    const result = await db.query(queryStr, queryArgs);
    const formatted = result.rows.map(t => ({
        ...t, 
        completed: !!t.completed, 
        favorite: !!t.favorite 
    }));
    res.json(formatted);
  } catch (err) {
    console.error('TASKS_GET_ERROR:', err);
    res.status(500).json({ error: 'SERVER_ERR: ' + err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, category, due_date, favorite, subtasks } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Use a placeholder for 'completed' to let the DB driver/sanitizer handle types
    await db.run(
      'INSERT INTO tasks (title, description, priority, category, due_date, user_id, completed, favorite, subtasks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [title, description || null, priority || 'Medium', category || 'General', due_date || null, req.user.id, false, favorite, subtasks || '[]']
    );
    
    const newTask = await db.one('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    if (!newTask) throw new Error('Failed to retrieve newly created task');
    
    res.status(201).json({...newTask, completed: false, favorite: !!newTask.favorite});
  } catch (err) {
    console.error('TASKS_POST_ERROR:', err);
    res.status(500).json({ error: 'SERVER_ERR: ' + err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, completed, favorite, due_date, subtasks } = req.body;

    const task = await db.one('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!task) return res.status(404).json({ error: 'Not found' });

    let updates = [];
    let values = [];

    const addUpdate = (col, val) => {
        if (val !== undefined) {
            updates.push(`${col} = $${values.length + 1}`);
            values.push(val);
        }
    };

    addUpdate('title', title);
    addUpdate('description', description);
    addUpdate('priority', priority);
    addUpdate('category', category);
    addUpdate('completed', completed);
    addUpdate('favorite', favorite);
    addUpdate('due_date', due_date);
    addUpdate('subtasks', subtasks);

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`); 
      values.push(id, req.user.id);
      await db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}`, values);
    }

    const updatedTask = await db.one('SELECT * FROM tasks WHERE id = $1', [id]);
    res.json({...updatedTask, completed: !!updatedTask.completed, favorite: !!updatedTask.favorite});
  } catch (err) {
    console.error('TASKS_PUT_ERROR:', err);
    res.status(500).json({ error: 'SERVER_ERR: ' + err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERR: ' + err.message });
  }
});

module.exports = router;
