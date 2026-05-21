const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE manager_notifications ADD COLUMN type TEXT DEFAULT 'assign_reportee'");
  console.log("✅ Successfully altered table and added column 'type'!");
} catch (e) {
  console.log("⚠️ Error or already altered:", e.message);
}

console.log("Columns after alteration:");
console.log(db.prepare('PRAGMA table_info(manager_notifications)').all());
