require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('--- Fixing remaining sync issues ---\n');

  // 1. Users (without profile_image since Supabase doesn't have that column)
  const users = db.prepare('SELECT id, fullname, email, password, role, points FROM users').all();
  const { error: e1 } = await supabase.from('users').upsert(users, { onConflict: 'id' });
  console.log('Users:', e1 ? 'ERROR: ' + e1.message : '✅ ' + users.length + ' synced');

  // 2. Social post with user_id
  const post = db.prepare(`
    SELECT p.id, p.user_email, p.caption, p.image_url, u.id as uid, u.fullname 
    FROM social_posts p 
    LEFT JOIN users u ON LOWER(p.user_email) = LOWER(u.email) 
    GROUP BY p.id
  `).get();
  if (post && post.uid) {
    const { error: e3 } = await supabase.from('gantec_idea_hub_posts').upsert({
      id: post.id,
      user_id: post.uid,
      user_email: post.user_email.toLowerCase(),
      username: post.fullname || post.user_email.split('@')[0],
      post_content: post.caption || '',
      image_url: post.image_url || null,
      likes_count: 0,
      comments_count: 0,
      post_visibility: 'public',
      is_deleted: false
    }, { onConflict: 'id' });
    console.log('Social post:', e3 ? 'ERROR: ' + e3.message : '✅ OK');
  }

  // 3. Monthly feedback
  const fb = db.prepare('SELECT * FROM monthly_feedback').all();
  let fbOk = 0, fbErr = 0;
  for (const r of fb) {
    let sel = r.selections;
    let rem = r.remarks;
    try { sel = typeof sel === 'string' ? JSON.parse(sel) : sel; } catch(e) { sel = {}; }
    try { rem = typeof rem === 'string' ? JSON.parse(rem) : rem; } catch(e) { rem = {}; }
    
    const { error } = await supabase.from('monthly_feedback').upsert({
      user_email: r.user_email,
      role: r.role,
      period: r.period,
      selections: sel,
      remarks: rem,
      is_submitted: r.is_submitted === 1,
      updated_at: r.updated_at
    }, { onConflict: 'user_email,role,period' });
    if (!error) fbOk++;
    else fbErr++;
  }
  console.log('Feedback:', '✅ ' + fbOk + ' synced, ' + fbErr + ' skipped');

  console.log('\n--- Done ---');
  db.close();
}

fix().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
