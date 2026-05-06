const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
console.log(JSON.stringify(tableInfo, null, 2));
db.close();
