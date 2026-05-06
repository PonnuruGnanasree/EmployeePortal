require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectLink() {
  const data = { title: 'InspectMe', url: 'http://inspect.com', folder: 'General', uploaded_by: 'test@test.com' };
  console.log("Inserting...");
  const { data: inserted, error } = await supabase.from('resource_links').insert([data]).select();
  if (error) console.error(error);
  else {
    console.log("Inserted row:", inserted[0]);
  }
}

inspectLink();
