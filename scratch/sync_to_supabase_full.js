require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sync() {
  console.log('=== SYNCING SQLite -> Supabase ===\n');

  // 1. Users
  const users = db.prepare('SELECT id, fullname, email, password, role, points, profile_image FROM users').all();
  console.log('Users to sync:', users.length);
  if (users.length > 0) {
    const { error } = await supabase.from('users').upsert(users, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 2. Weekly Sessions
  const sessions = db.prepare('SELECT * FROM weekly_sessions').all();
  console.log('Weekly sessions:', sessions.length);
  if (sessions.length > 0) {
    const mapped = sessions.map(s => ({
      ...s,
      winners: typeof s.winners === 'string' ? JSON.parse(s.winners) : s.winners
    }));
    const { error } = await supabase.from('weekly_sessions').upsert(mapped, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 3. Weekly Connect Members
  const members = db.prepare('SELECT id, name, team, email, created_at FROM weekly_connect_members').all();
  console.log('Weekly connect members:', members.length);
  if (members.length > 0) {
    const { error } = await supabase.from('weekly_connect_members').upsert(members, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 4. Holidays
  const holidays = db.prepare('SELECT * FROM holidays').all();
  console.log('Holidays:', holidays.length);
  if (holidays.length > 0) {
    const { error } = await supabase.from('holidays').upsert(holidays, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 5. Certificate Leaders
  const certs = db.prepare('SELECT * FROM certificate_leaders').all();
  console.log('Certificate leaders:', certs.length);
  if (certs.length > 0) {
    const { error } = await supabase.from('certificate_leaders').upsert(certs, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 6. HR Queries
  const hrq = db.prepare('SELECT * FROM hr_queries').all();
  console.log('HR queries:', hrq.length);
  if (hrq.length > 0) {
    const { error } = await supabase.from('hr_queries').upsert(hrq, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 7. Support Tickets
  const tickets = db.prepare('SELECT * FROM support_tickets').all();
  console.log('Support tickets:', tickets.length);
  if (tickets.length > 0) {
    const { error } = await supabase.from('support_tickets').upsert(tickets, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 8. Monthly Feedback
  const fb = db.prepare('SELECT * FROM monthly_feedback').all();
  console.log('Monthly feedback:', fb.length);
  if (fb.length > 0) {
    const mapped = fb.map(r => ({
      ...r,
      selections: typeof r.selections === 'string' ? JSON.parse(r.selections) : r.selections,
      remarks: typeof r.remarks === 'string' ? JSON.parse(r.remarks) : r.remarks,
      is_submitted: r.is_submitted === 1
    }));
    const { error } = await supabase.from('monthly_feedback').upsert(mapped, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 9. Main Sub Mails
  const mails = db.prepare('SELECT * FROM main_sub_mails').all();
  console.log('Main sub mails:', mails.length);
  if (mails.length > 0) {
    const { error } = await supabase.from('main_sub_mails').upsert(mails, { onConflict: 'id' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 10. Leave Balances
  const leaves = db.prepare('SELECT * FROM leave_balances').all();
  console.log('Leave balances:', leaves.length);
  if (leaves.length > 0) {
    const { error } = await supabase.from('leave_balances').upsert(leaves, { onConflict: 'user_email' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 11. Admin Emails
  const admins = db.prepare('SELECT * FROM admin_emails').all();
  console.log('Admin emails:', admins.length);
  if (admins.length > 0) {
    const { error } = await supabase.from('admin_emails').upsert(admins, { onConflict: 'email' });
    console.log(error ? '  ERROR: ' + error.message : '  ✅ OK');
  }

  // 12. Social Posts (sync to gantec_idea_hub_posts)
  const posts = db.prepare('SELECT p.*, u.fullname FROM social_posts p LEFT JOIN users u ON LOWER(p.user_email) = LOWER(u.email) GROUP BY p.id').all();
  console.log('Social posts:', posts.length);
  if (posts.length > 0) {
    for (const p of posts) {
      const { error } = await supabase.from('gantec_idea_hub_posts').upsert({
        id: p.id,
        user_email: p.user_email.toLowerCase(),
        username: p.fullname || p.user_email.split('@')[0],
        post_content: p.caption || '',
        image_url: p.image_url || null,
        likes_count: 0,
        comments_count: 0,
        post_visibility: 'public',
        is_deleted: false
      }, { onConflict: 'id' });
      if (error) console.log('  Post ERROR:', error.message);
    }
    console.log('  ✅ OK');
  }

  console.log('\n=== SYNC COMPLETE ===');
  db.close();
}

sync().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
