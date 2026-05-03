require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'gnana@gantecusa.com');
  console.log('Supabase Auth User:', JSON.stringify(user, null, 2));
  if (error) console.log('Error:', error);
}
check();
