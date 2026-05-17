require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

async function clean() {
  const { data, error } = await supabase
    .from('resource_uploads')
    .delete()
    .like('filename', '%a89564fc%');
    
  console.log('Supabase resource_uploads delete:', error ? error.message : 'Success', data || '');
}

clean();
