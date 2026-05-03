const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../data', 'database.sqlite'));
const user = db.prepare('SELECT * FROM users WHERE email = ?').get('gnana@gantecusa.com');
console.log(user ? 'User found in local DB: ' + JSON.stringify(user) : 'User not found in local DB');
