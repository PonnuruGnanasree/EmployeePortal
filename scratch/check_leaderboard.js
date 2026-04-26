const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(DB_FILE);

try {
  const users = db.prepare('SELECT fullname as name, points FROM users ORDER BY points DESC, fullname ASC').all();
  console.log('Leaderboard Data:', JSON.stringify(users, null, 2));
} catch (err) {
  console.error('Error querying leaderboard:', err.message);
}
