require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probeLinksDeep() {
  console.log("Probing resource_links for email columns...");
  
  const base = { title: 'probe_link', url: 'http://test.com', folder: 'General' };
  
  const cols = ['uploaded_by', 'uploader_email', 'email', 'user_email', 'uploader'];
  
  for (const c of cols) {
    const { error } = await supabase.from('resource_links').insert([{ ...base, [c]: 'test@test.com' }]);
    if (error) console.log(`Column ${c} failed:`, error.message);
    else console.log(`Column ${c} succeeded!`);
  }
}

probeLinksDeep();
