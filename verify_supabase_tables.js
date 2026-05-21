// verify_supabase_tables.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing in .env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'users',
  'admin_emails',
  'certificate_leaders',
  'leave_balances',
  'monthly_feedback',
  'hr_queries',
  'support_tickets',
  'weekly_connect_members',
  'weekly_sessions',
  'holidays',
  'public_documents',
  'user_folders',
  'user_documents',
  'social_posts',
  'social_comments',
  'social_likes',
  'social_stories',
  'main_sub_mails'
];

async function check() {
  const results = [];
  for (const t of tables) {
    try {
      const { error, count } = await supabase.from(t).select('id', { count: 'exact', head: true });
      if (error) {
        results.push({ table: t, status: 'MISSING', message: error.message });
      } else {
        results.push({ table: t, status: 'OK', count });
      }
    } catch (e) {
      results.push({ table: t, status: 'ERROR', message: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}
check();
