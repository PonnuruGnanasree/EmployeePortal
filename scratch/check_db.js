const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));

const rows = db.prepare('SELECT * FROM public_documents LIMIT 20').all();
console.log(JSON.stringify(rows, null, 2));
