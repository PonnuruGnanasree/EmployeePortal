const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
console.log('--- user_folders ---');
console.log(JSON.stringify(db.prepare("PRAGMA table_info(user_folders)").all(), null, 2));
console.log('--- user_documents ---');
console.log(JSON.stringify(db.prepare("PRAGMA table_info(user_documents)").all(), null, 2));
db.close();
