require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('resource_folders').select('*');
  console.log('resource_folders:', data, error);
}

check();
