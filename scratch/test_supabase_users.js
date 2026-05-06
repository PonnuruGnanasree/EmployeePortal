require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  const { data, error } = await supabase.from('users').select('*');
  console.log("Users in Supabase:", data);
  if (error) console.error(error);
}

checkUsers();
