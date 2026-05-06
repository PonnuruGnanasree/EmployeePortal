require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probeColumns() {
  console.log("Probing columns for resource_uploads...");
  
  const testData = {
    filename: 'probe.txt',
    folder: 'General',
    size: 10
  };
  
  // Try with original_name
  console.log("Trying with original_name...");
  const { error: err1 } = await supabase.from('resource_uploads').insert([{ ...testData, original_name: 'test' }]);
  if (err1) console.log("original_name failed:", err1.message);
  else console.log("original_name succeeded!");

  // Try with uploaded_by
  console.log("Trying with uploaded_by...");
  const { error: err2 } = await supabase.from('resource_uploads').insert([{ ...testData, uploaded_by: 'test@test.com' }]);
  if (err2) console.log("uploaded_by failed:", err2.message);
  else console.log("uploaded_by succeeded!");

  // Try with uploader_email
  console.log("Trying with uploader_email...");
  const { error: err3 } = await supabase.from('resource_uploads').insert([{ ...testData, uploader_email: 'test@test.com' }]);
  if (err3) console.log("uploader_email failed:", err3.message);
  else console.log("uploader_email succeeded!");

  console.log("\nProbing columns for resource_links...");
  const linkData = { title: 'probe', url: 'http://test.com', folder: 'General' };
  
  console.log("Trying link with uploaded_by...");
  const { error: err4 } = await supabase.from('resource_links').insert([{ ...linkData, uploaded_by: 'test@test.com' }]);
  if (err4) console.log("link uploaded_by failed:", err4.message);
  else console.log("link uploaded_by succeeded!");

  console.log("Trying link with uploader_email...");
  const { error: err5 } = await supabase.from('resource_links').insert([{ ...linkData, uploader_email: 'test@test.com' }]);
  if (err5) console.log("link uploader_email failed:", err5.message);
  else console.log("link uploader_email succeeded!");
}

probeColumns();
