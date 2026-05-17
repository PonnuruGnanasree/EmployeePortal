const Database = require('better-sqlite3');
const db = new Database('./data/database.sqlite');
const tables = ['user_documents', 'public_documents', 'resource_uploads', 'resource_links'];
let found = false;

for (const table of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table} WHERE filename LIKE '%a89564fc%' OR original_name LIKE '%a89564fc%'`).all();
    if (rows.length > 0) {
      console.log(`Found in ${table}:`, rows);
      db.prepare(`DELETE FROM ${table} WHERE filename LIKE '%a89564fc%' OR original_name LIKE '%a89564fc%'`).run();
      console.log(`Deleted from ${table}`);
      found = true;
    }
  } catch (e) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table} WHERE filename LIKE '%a89564fc%'`).all();
      if (rows.length > 0) {
        console.log(`Found in ${table} (filename only):`, rows);
        db.prepare(`DELETE FROM ${table} WHERE filename LIKE '%a89564fc%'`).run();
        console.log(`Deleted from ${table}`);
        found = true;
      }
    } catch(err) {}
  }
}
if (!found) console.log('Not found in any standard document table.');
