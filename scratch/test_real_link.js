require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRealLink() {
  const data = {
    title: 'Testing YouTube Link Sync',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    folder: 'General',
    uploaded_by: 'gnana@gantecusa.com'
  };
  
  console.log("Attempting real link insert...");
  const { error } = await supabase.from('resource_links').insert([data]);
  
  if (error) {
    console.error("FAILED:", error.message);
    console.error("Full error:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS!");
  }
}

testRealLink();
