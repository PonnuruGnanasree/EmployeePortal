const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking columns of gantec_idea_hub_posts...");
  const { error: postErr } = await supabase.from('gantec_idea_hub_posts').insert([{ invalid_column_xxx: 'test' }]);
  console.log("gantec_idea_hub_posts error message:", postErr ? postErr.message : "No error!");

  console.log("Checking columns of reportee_notifications...");
  const { error: notifErr } = await supabase.from('reportee_notifications').insert([{ invalid_column_xxx: 'test' }]);
  console.log("reportee_notifications error message:", notifErr ? notifErr.message : "No error!");
}

check();
