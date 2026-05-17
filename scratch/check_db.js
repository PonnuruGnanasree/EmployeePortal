const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));

const rows = db.prepare('SELECT id, fullname, email, points FROM users').all();
console.log(JSON.stringify(rows, null, 2));
