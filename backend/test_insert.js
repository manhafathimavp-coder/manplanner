const Database = require('better-sqlite3');
const dbPath = './db/database.sqlite';
const sqlite = new Database(dbPath);
const convertToSqlite = (text) => {
    return text.replace(/\$\d+/g, '?');
};

const query = 'INSERT INTO tasks (title, description, priority, category, due_date, user_id, completed, favorite, subtasks) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)';
const params = ['Study', 'clat', 'High', 'Personal', '2027-02-11', 1, 0, '[]'];

try {
    const stmt = sqlite.prepare(convertToSqlite(query));
    const info = stmt.run(...params);
    console.log('Insert OK:', info);
} catch (err) {
    console.error('Insert FAILED:', err.message);
}
sqlite.close();
