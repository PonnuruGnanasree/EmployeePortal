// scratch/check_supabase_feedback_columns.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('monthly_feedback').select('*');
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
check();
