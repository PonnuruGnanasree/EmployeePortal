const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- Buckets ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) console.error('Buckets Error:', bErr);
  else console.log('Buckets:', JSON.stringify(buckets, null, 2));

  if (buckets && buckets.length > 0) {
    for (const b of buckets) {
      console.log(`--- Files in ${b.name} ---`);
      const { data: files, error: fErr } = await supabase.storage.from(b.name).list('', { limit: 100 });
      if (fErr) console.error(`Files Error in ${b.name}:`, fErr);
      else {
        console.log(`Files in ${b.name} (root):`, JSON.stringify(files, null, 2));
        // Also check some folders
        for (const f of files) {
          if (!f.id) { // it's a folder
             const { data: sub } = await supabase.storage.from(b.name).list(f.name);
             console.log(`Files in ${b.name}/${f.name}:`, JSON.stringify(sub, null, 2));
          }
        }
      }
    }
  }
}
check();
