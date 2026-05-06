require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSync() {
  console.log("Testing Supabase Sync...");

  // Test 1: resource_links
  console.log("\\n--- Testing resource_links ---");
  const { error: err1 } = await supabase.from('resource_links').upsert({
    title: 'test_link',
    url: 'http://test.com',
    folder: 'General',
    uploaded_by: 'test@gantecusa.com'
  }, { onConflict: 'folder,title' });
  if (err1) console.error("Link sync failed:", err1.message);
  else console.log("Link sync succeeded.");

  // Test 2: user_folders (requires a valid user UUID, we'll try to find one first)
  console.log("\\n--- Testing user_documents & user_folders ---");
  const { data: users, error: errUsers } = await supabase.from('users').select('id, email').limit(1);
  if (errUsers || !users || users.length === 0) {
    console.error("Could not fetch a user to test private docs sync.");
  } else {
    const supaId = users[0].id;
    console.log(`Using user UUID: ${supaId}`);

    const { error: errFolder } = await supabase.from('user_folders').upsert({
      user_id: supaId,
      path: 'General'
    }, { onConflict: 'user_id,path' });
    if (errFolder) console.error("User folder sync failed:", errFolder.message);
    else console.log("User folder sync succeeded.");

    const { error: errDoc } = await supabase.from('user_documents').insert([{
      user_id: supaId,
      original_name: 'test.pdf',
      hashed_name: 'test.pdf',
      folder: 'General',
      size: 100
    }]);
    if (errDoc) console.error("User doc sync failed:", errDoc.message);
    else console.log("User doc sync succeeded.");
  }
}

testSync();
