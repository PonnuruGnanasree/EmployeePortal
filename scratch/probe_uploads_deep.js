require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probeUploadsDeep() {
  console.log("Probing resource_uploads for display name columns...");
  
  const base = { filename: 'probe_deep.txt', folder: 'General', uploaded_by: 'test@test.com' };
  
  const names = ['name', 'title', 'display_name', 'orig_name'];
  
  for (const n of names) {
    const { error } = await supabase.from('resource_uploads').insert([{ ...base, [n]: 'Test Name' }]);
    if (error) console.log(`Column ${n} failed:`, error.message);
    else console.log(`Column ${n} succeeded!`);
  }
}

probeUploadsDeep();
