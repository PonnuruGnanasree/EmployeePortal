const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'gantec_idea_hub_posts' });
  if (error) {
    // If RPC doesn't exist, try querying a non-existent column or getting one row metadata
    console.log("RPC get_table_columns failed, trying custom SQL or select...");
    // Let's insert a dummy row or fetch a single row to see properties of returned object (even if empty)
    // Or we can try to insert a null row with UUID
    const { data: colsData, error: colsErr } = await supabase
      .from('gantec_idea_hub_posts')
      .select('*')
      .limit(1);
    console.log("Cols Data:", colsData, "Error:", colsErr);
  } else {
    console.log("Columns:", data);
  }

  // Let's also check reportee_notifications
  const { data: colsData2, error: colsErr2 } = await supabase
    .from('reportee_notifications')
    .select('*')
    .limit(1);
  console.log("Notifications columns:", colsData2, "Error:", colsErr2);
}

check();
