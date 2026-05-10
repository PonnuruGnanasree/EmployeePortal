require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUrlUniqueness() {
  const url = 'http://unique-test.com';
  const data = { title: 'test', url, folder: 'General', uploaded_by: 'test@test.com' };

  console.log("Inserting first time...");
  const { error: e1 } = await supabase.from('resource_links').insert([data]);
  if (e1) console.log("First failed:", e1.message);
  else console.log("First succeeded.");

  console.log("Inserting second time with same URL...");
  const { error: e2 } = await supabase.from('resource_links').insert([data]);
  if (e2) console.log("Second failed:", e2.message);
  else console.log("Second succeeded.");
}

testUrlUniqueness();
