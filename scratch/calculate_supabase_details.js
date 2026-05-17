require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users } = await supabase.from('users').select('*');
  
  for (const u of users) {
    // 1. Public resources
    const { count: publicDocs } = await supabase.from('resource_uploads').select('*', { count: 'exact', head: true }).eq('uploaded_by', u.email);
    const { count: publicLinks } = await supabase.from('resource_links').select('*', { count: 'exact', head: true }).eq('uploaded_by', u.email);
    
    // 2. Private locker documents
    const { count: privateDocs } = await supabase.from('user_documents').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    
    console.log(`User: ${u.fullname} (${u.email})`);
    console.log(`  - Current Points: ${u.points}`);
    console.log(`  - Public Uploads: ${publicDocs}`);
    console.log(`  - Public Links: ${publicLinks}`);
    console.log(`  - Private Docs: ${privateDocs}`);
  }
}

run();
