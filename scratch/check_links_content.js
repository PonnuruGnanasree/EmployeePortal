require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLinks() {
  console.log("Checking resource_links table...");
  const { data, error, count } = await supabase.from('resource_links').select('*', { count: 'exact' });
  if (error) console.error(error);
  else {
    console.log(`Total links: ${count}`);
    console.log("Last 5 links:", data.slice(-5));
  }
}

checkLinks();
