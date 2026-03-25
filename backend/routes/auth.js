const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, recovery_key } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const trimmedEmail = email.trim().toLowerCase();
    const userExists = await db.one('SELECT * FROM users WHERE LOWER(email) = $1', [trimmedEmail]);
    if (userExists) return res.status(400).json({ error: 'User already exists' });

    // Role Logic: 1. Master Init Name, 2. First User in DB, 3. Standard User
    const userCount = await db.one('SELECT COUNT(*) as count FROM users');
    let role = parseInt(userCount.count) === 0 ? 'superadmin' : 'user';
    if (name === 'MASTER_INIT') role = 'superadmin';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.run('INSERT INTO users (name, email, password, role, recovery_key) VALUES ($1, $2, $3, $4, $5)', [name, trimmedEmail, hashedPassword, role, recovery_key || 'TACTICAL_DEFAULT']);
    const newUser = await db.one('SELECT id, name, email, role, avatar FROM users WHERE LOWER(email) = $1', [trimmedEmail]);

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1d' });
    res.status(201).json({ user: newUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/recovery', async (req, res) => {
  try {
    const { email, recovery_key, newPassword } = req.body;
    const user = await db.one('SELECT * FROM users WHERE email = $1', [email.trim()]);
    if (!user || user.recovery_key !== recovery_key) {
      return res.status(401).json({ error: 'Invalid recovery credentials' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await db.run('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

    res.json({ message: 'Secret key restored.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const authenticateToken = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.one('SELECT * FROM users WHERE LOWER(email) = $1', [trimmedEmail]);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    // Auto-promote first user on login if needed
    const userCountRes = await db.one('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCountRes.count) === 1 && user.role !== 'superadmin') {
      await db.run('UPDATE users SET role = $1 WHERE id = $2', ['superadmin', user.id]);
      user.role = 'superadmin';
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user', avatar: user.avatar }, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, password, avatar } = req.body;
    let updates = [];
    let values = [];

    if (name) { updates.push(`name = $${updates.length + 1}`); values.push(name); }
    if (avatar) { updates.push(`avatar = $${updates.length + 1}`); values.push(avatar); }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updates.push(`password = $${updates.length + 1}`);
      values.push(hashedPassword);
    }

    if (updates.length > 0) {
      values.push(req.user.id);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    }

    const updatedUser = await db.one('SELECT id, name, email, role, avatar FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/profile', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Identity redacted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
