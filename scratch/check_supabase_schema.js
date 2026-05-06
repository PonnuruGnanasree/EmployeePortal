require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  console.log("Checking table schemas in Supabase...");

  // We can't directly get schema easily without RPC or standard API.
  // But we can try a select * limit 1 and see the keys.
  
  const tables = ['resource_uploads', 'resource_links', 'resource_folders', 'users'];
  
  for (const table of tables) {
    console.log(`\n--- Table: ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Columns found:`, Object.keys(data[0]));
    } else {
      console.log("No data in table to inspect columns.");
      // Try to insert a row with minimal columns to see what works
    }
  }
}

checkSchema();
