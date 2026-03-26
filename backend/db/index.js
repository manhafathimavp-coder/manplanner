const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const isProd = process.env.DATABASE_URL;
let db;
let sqlite;

const schemaStr = `
  CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      recovery_key TEXT,
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

const convertToSqlite = (text) => {
    return text.replace(/\$\d+/g, '?');
};

const sanitizeParams = (params) => {
    if (isProd) return params;
    return params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
};

const runQuery = async (text, params = []) => {
    try {
        if (isProd) {
            return await db.query(text, params);
        } else {
            const stmt = sqlite.prepare(convertToSqlite(text));
            const rows = stmt.all(...sanitizeParams(params));
            return { rows };
        }
    } catch (err) {
        console.error('❌ DB Query Error:', err.message, '| Query:', text);
        throw err;
    }
};

const runOne = async (text, params = []) => {
    try {
        if (isProd) {
            const res = await db.query(text, params);
            return res.rows[0];
        } else {
            const stmt = sqlite.prepare(convertToSqlite(text));
            return stmt.get(...sanitizeParams(params));
        }
    } catch (err) {
        console.error('❌ DB One Error:', err.message, '| Query:', text);
        throw err;
    }
};

const runExec = async (text, params = []) => {
    try {
        if (isProd) {
            return await db.query(text, params);
        } else {
            const stmt = sqlite.prepare(convertToSqlite(text));
            return stmt.run(...sanitizeParams(params));
        }
    } catch (err) {
        console.error('❌ DB Exec Error:', err.message, '| Query:', text);
        throw err;
    }
};

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
            await runExec('UPDATE users SET password = $1, role = $2 WHERE email = $3', [hashed, 'superadmin', adminEmail]);
            console.log('✅ Master SuperAdmin Synchronized');
        }
    } catch (err) {
        console.error('❌ seedAdmin Error:', err.message);
    }
};

if (isProd) {
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('Using PostgreSQL (Production)');
    
    const migrations = `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_key TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks TEXT DEFAULT '[]';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
    `;

    db.query(schemaStr)
      .then(() => db.query(migrations))
      .then(() => {
          console.log('PostgreSQL Schema & Migrations Synchronized');
          seedAdmin();
      })
      .catch(err => console.error('PostgreSQL Initialization Error:', err));
} else {
    try {
        const dbPath = path.resolve(__dirname, 'database.sqlite');
        sqlite = new Database(dbPath, { verbose: null }); 
        sqlite.pragma('foreign_keys = ON'); // Enable foreign keys for CASCADE support
        
        const sqliteSchema = schemaStr
            .replace(/SERIAL/g, 'INTEGER')
            .replace(/PRIMARY KEY/g, 'PRIMARY KEY AUTOINCREMENT')
            .replace(/TIMESTAMP/g, 'DATETIME')
            .replace(/false/g, '0')
            .replace(/true/g, '1');
            
        sqlite.exec(sqliteSchema);
        console.log('Using SQLite (Development)');
        seedAdmin();
    } catch (err) {
        console.error('❌ SQLite Init Error:', err.message);
    }
}

module.exports = { query: runQuery, one: runOne, run: runExec, isProd };
