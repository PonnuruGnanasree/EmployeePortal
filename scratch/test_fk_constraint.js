require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFk() {
  const data = {
    title: 'FK Test',
    url: 'http://fk-test.com',
    folder: 'General',
    uploaded_by: 'this-email-does-not-exist@test.com'
  };
  
  console.log("Attempting insert with non-existent email...");
  const { error } = await supabase.from('resource_links').insert([data]);
  
  if (error) {
    console.error("FAILED:", error.message);
  } else {
    console.log("SUCCESS! No FK constraint.");
  }
}

testFk();
