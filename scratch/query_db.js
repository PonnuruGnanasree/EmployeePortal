const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
const rows = db.prepare("SELECT * FROM public_documents;").all();
console.log(JSON.stringify(rows, null, 2));
db.close();
