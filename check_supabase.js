require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

async function check() {
  const { data: uploads, error: err1 } = await supabase
    .from('resource_uploads')
    .select('*')
    .like('filename', '%a89564fc%');
    
  console.log('resource_uploads:', uploads, err1);

  const { data: links, error: err2 } = await supabase
    .from('resource_links')
    .select('*')
    .like('url', '%a89564fc%');
    
  console.log('resource_links:', links, err2);

  // Check the storage bucket
  const { data: files, error: err3 } = await supabase.storage.from('resource-uploads').list('Weekly Connect');
  console.log('bucket contents:', files ? files.filter(f => f.name.includes('a89564fc')) : [], err3);
}

check();
