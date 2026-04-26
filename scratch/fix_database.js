const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(DB_FILE);

try {
  console.log('Adding role column...');
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'employee'");
  console.log('Role column added.');
} catch (e) {
  console.log('Role column likely exists or error:', e.message);
}

try {
  console.log('Adding points column...');
  db.exec("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0");
  console.log('Points column added.');
} catch (e) {
  console.log('Points column likely exists or error:', e.message);
}
