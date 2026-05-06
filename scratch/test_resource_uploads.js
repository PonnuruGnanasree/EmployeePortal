require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUploads() {
  console.log("Testing resource_uploads insert...");
  
  // Test upsert
  const { error: err1 } = await supabase.from('resource_uploads').upsert({
    filename: 'test.txt',
    original_name: 'test.txt',
    folder: 'General',
    uploaded_by: 'gnana@gantecusa.com',
    size: 100
  }, { onConflict: 'folder,filename' });
  
  if (err1) console.error("Upsert failed:", err1.message);
  else console.log("Upsert succeeded.");

  // Test insert
  const { error: err2 } = await supabase.from('resource_uploads').insert([{
    filename: 'test2.txt',
    original_name: 'test2.txt',
    folder: 'General',
    uploaded_by: 'gnana@gantecusa.com',
    size: 100
  }]);
  
  if (err2) console.error("Insert failed:", err2.message);
  else console.log("Insert succeeded.");
}

testUploads();
