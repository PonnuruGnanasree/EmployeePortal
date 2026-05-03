require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'gnana@gantecusa.com');
  console.log('Supabase DB User:', JSON.stringify(data, null, 2));
}
check();
