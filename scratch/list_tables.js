const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);
db.close();
