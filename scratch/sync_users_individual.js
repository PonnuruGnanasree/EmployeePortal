require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function go() {
  const users = db.prepare('SELECT id, fullname, email, password, role, points FROM users').all();
  let ok = 0, skipped = 0;

  for (const u of users) {
    // Try upsert by email (in case ID differs between local and Supabase)
    const { error } = await supabase.from('users').upsert({
      id: u.id,
      fullname: u.fullname,
      email: u.email,
      password: u.password,
      role: u.role,
      points: u.points
    }, { onConflict: 'email' });

    if (error) {
      // If email conflict with different ID, update by email instead
      const { error: e2 } = await supabase.from('users')
        .update({ fullname: u.fullname, password: u.password, role: u.role, points: u.points })
        .eq('email', u.email);
      if (e2) {
        console.log('  Skip:', u.email, '-', e2.message);
        skipped++;
      } else {
        ok++;
      }
    } else {
      ok++;
    }
  }

  console.log(`Users: ✅ ${ok} synced, ${skipped} skipped`);
  db.close();
}

go();
