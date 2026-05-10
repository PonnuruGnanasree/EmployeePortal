const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('Attempting to create bucket: resource-uploads');
  const { data, error } = await supabase.storage.createBucket('resource-uploads', {
    public: true,
    fileSizeLimit: 52428800 // 50MB
  });
  if (error) console.error('Create Error:', error);
  else console.log('Create Success:', data);
}
check();
