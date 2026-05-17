const Database = require('better-sqlite3');
const db = new Database('./data/portal.db');

// Find the file
const rows = db.prepare("SELECT * FROM resource_uploads WHERE filename LIKE ?").all('%a89564fc%');
console.log('resource_uploads rows:', JSON.stringify(rows, null, 2));

// Delete it directly from DB
if (rows.length > 0) {
  db.prepare("DELETE FROM resource_uploads WHERE filename LIKE ?").run('%a89564fc%');
  console.log('Deleted from resource_uploads');
}

// Check all tables for this file
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => {
  try {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
    const hasFilename = cols.some(c => c.name === 'filename');
    if (hasFilename) {
      const r = db.prepare(`SELECT * FROM ${t.name} WHERE filename LIKE ?`).all('%a89564fc%');
      if (r.length > 0) {
        console.log(`Found in ${t.name}:`, r);
        db.prepare(`DELETE FROM ${t.name} WHERE filename LIKE ?`).run('%a89564fc%');
        console.log(`Deleted from ${t.name}`);
      }
    }
  } catch(e) {}
});

console.log('Done');
