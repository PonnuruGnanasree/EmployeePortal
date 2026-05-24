const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking gantec_idea_hub_posts...");
  const { data: posts, error: postErr } = await supabase.from('gantec_idea_hub_posts').select('*').limit(5);
  if (postErr) {
    console.error("gantec_idea_hub_posts error:", postErr.message);
  } else {
    console.log("gantec_idea_hub_posts rows:", posts);
  }

  console.log("Checking reportee_notifications...");
  const { data: notifications, error: notifErr } = await supabase.from('reportee_notifications').select('*').limit(5);
  if (notifErr) {
    console.error("reportee_notifications error:", notifErr.message);
  } else {
    console.log("reportee_notifications rows:", notifications);
  }
}

check();
