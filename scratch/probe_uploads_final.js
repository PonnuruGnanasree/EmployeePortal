require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probeUploads() {
  console.log("Probing resource_uploads again...");
  
  const base = { filename: 'p1.txt', folder: 'General' };
  
  // Try minimal
  const { error: e1 } = await supabase.from('resource_uploads').insert([base]);
  if (e1) console.log("Minimal failed:", e1.message);
  else console.log("Minimal succeeded!");

  // Try with uploaded_by
  const { error: e2 } = await supabase.from('resource_uploads').insert([{ ...base, filename: 'p2.txt', uploaded_by: 'test@test.com' }]);
  if (e2) console.log("uploaded_by failed:", e2.message);
  else console.log("uploaded_by succeeded!");
}

probeUploads();
