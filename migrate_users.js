const db = require('better-sqlite3')('data/database.sqlite');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateUsers() {
  console.log('Fetching users from SQLite...');
  const localUsers = db.prepare('SELECT * FROM users').all();
  console.log(`Found ${localUsers.length} users.`);

  for (const user of localUsers) {
    console.log(`Syncing ${user.email}...`);
    const { error } = await supabase
      .from('users')
      .upsert({
        fullname: user.fullname,
        email: user.email,
        password: user.password,
        role: user.role || 'employee',
        points: user.points || 0
      }, { onConflict: 'email' });

    if (error) {
      console.error(`Failed to sync ${user.email}:`, error.message);
    } else {
      console.log(`Success.`);
    }
  }
  console.log('User Migration Complete.');
}

migrateUsers().catch(console.error);
