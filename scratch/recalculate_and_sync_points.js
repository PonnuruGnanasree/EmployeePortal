require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Databases
const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function recalculate() {
  console.log('🔄 STEP 1: Recalculating Local SQLite Points...');
  const sqliteUsers = db.prepare('SELECT * FROM users').all();
  
  for (const user of sqliteUsers) {
    // Count private documents in SQLite
    const { count } = db.prepare('SELECT COUNT(*) as count FROM user_documents WHERE user_id = ?').get(user.id) || { count: 0 };
    
    const oldPoints = user.points || 0;
    // Private documents are worth exactly 0 points now.
    // Since the database points were set to (views_and_public + count * 1.0) previously, 
    // we subtract count * 1.0 to get the exact score for training resources only.
    const newPoints = Math.max(0, oldPoints - count);
    
    db.prepare('UPDATE users SET points = ? WHERE email = ?').run(newPoints, user.email);
    console.log(`SQLite - ${user.fullname} (${user.email}): ${oldPoints} pts -> ${newPoints} pts (Private Docs: ${count})`);
  }

  console.log('\n🔄 STEP 2: Recalculating Supabase Cloud Points...');
  const { data: supaUsers, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr) {
    console.error('Failed to fetch Supabase users:', usersErr.message);
    return;
  }

  for (const user of supaUsers) {
    // Count private documents in Supabase
    const { count, error: countErr } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
      
    if (countErr) {
      console.warn(`Could not count docs for ${user.fullname}:`, countErr.message);
      continue;
    }

    const oldPoints = user.points || 0;
    const newPoints = Math.max(0, oldPoints - count);

    const { error: updateErr } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', user.id);

    if (updateErr) {
      console.error(`Failed to update points for ${user.fullname} in Supabase:`, updateErr.message);
    } else {
      console.log(`Supabase - ${user.fullname} (${user.email}): ${oldPoints} pts -> ${newPoints} pts (Private Docs: ${count})`);
    }
  }

  console.log('\n🎉 ALL POINTS SUCCESSFULLY RECALCULATED AND IN SYNC!');
}

recalculate().then(() => {
  db.close();
  process.exit(0);
}).catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
