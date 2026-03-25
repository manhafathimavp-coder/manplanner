const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const isProd = process.env.DATABASE_URL;
let db;

const schemaStr = `
  CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT false,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      due_date TIMESTAMP,
      priority TEXT DEFAULT 'Medium',
      category TEXT DEFAULT 'General',
      favorite BOOLEAN DEFAULT false,
      subtasks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const bcrypt = require('bcrypt');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@manplanner.com';
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash('admin123', salt);
        
        const exists = await runOne('SELECT * FROM users WHERE email = $1', [adminEmail]);
        if (!exists) {
            await runExec('INSERT INTO users (name, email, password, role, recovery_key) VALUES ($1, $2, $3, $4, $5)', 
                ['Master Admin', adminEmail, hashed, 'superadmin', 'MASTER_RECOVERY']);
            console.log('✅ Master SuperAdmin Initialized');
        } else {
            // Force reset credentials to master passcode
            await runExec('UPDATE users SET password = $1, role = $2 WHERE email = $3', [hashed, 'superadmin', adminEmail]);
            console.log('✅ Master SuperAdmin Synchronized');
        }
    } catch (err) {}
};

if (isProd) {
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('Using PostgreSQL (Production)');
    
    // Initialize PostgreSQL Schema
    db.query(schemaStr)
      .then(() => {
          console.log('PostgreSQL Schema Synchronized');
          seedAdmin();
      })
      .catch(err => console.error('PostgreSQL Schema Sync Error:', err));
} else {
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    const sqlite = new Database(dbPath, { verbose: console.log });
    
    // SQLite Specific Schema Fix (AUTOINCREMENT instead of SERIAL)
    sqlite.exec(schemaStr.replace(/SERIAL/g, 'INTEGER').replace(/PRIMARY KEY/g, 'PRIMARY KEY AUTOINCREMENT').replace(/TIMESTAMP/g, 'DATETIME').replace(/false/g, '0'));
    
    db = {
        query: async (text, params) => {
            const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
            return { rows: params ? stmt.all(...params) : stmt.all() };
        },
        one: async (text, params) => {
            const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
            return params ? stmt.get(...params) : stmt.get();
        },
        run: async (text, params) => {
            const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
            return stmt.run(...params);
        }
    };
    console.log('Using SQLite (Development)');
    seedAdmin();
}

// Helper to handle both drivers
const runQuery = async (text, params = []) => {
    if (isProd) {
        return db.query(text, params);
    } else {
        const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
        return { rows: stmt.all(...params) };
    }
};

const runOne = async (text, params = []) => {
    if (isProd) {
        const res = await db.query(text, params);
        return res.rows[0];
    } else {
        const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
        return stmt.get(...params);
    }
};

const runExec = async (text, params = []) => {
    if (isProd) {
        return db.query(text, params);
    } else {
        const stmt = sqlite.prepare(text.replace(/\$/g, '?'));
        return stmt.run(...params);
    }
};

module.exports = { query: runQuery, one: runOne, run: runExec, isProd };
