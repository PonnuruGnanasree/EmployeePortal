// migrate_leave_balances.js
require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = require('path').join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

// Fetch all rows from SQLite leave_balances
const rows = db.prepare('SELECT * FROM leave_balances').all();
if (rows.length === 0) {
  console.log('No rows to migrate');
  process.exit(0);
}

(async () => {
  const { data, error } = await supabase.from('leave_balances').upsert(rows, { onConflict: 'user_email' });
  if (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
  console.log(`Migrated ${data.length} rows to Supabase`);
})();
