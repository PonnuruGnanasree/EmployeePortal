const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(DB_FILE);

try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log('Users Table Structure:', JSON.stringify(tableInfo, null, 2));
} catch (err) {
  console.error('Error getting table info:', err.message);
}
