const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function migrate() {
  console.log('🚀 Starting Cloud Storage Migration...');
  const folders = await fs.readdir(UPLOADS_DIR);
  
  for (const folder of folders) {
    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!(await fs.stat(folderPath)).isDirectory()) continue;
    
    const files = await fs.readdir(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const storagePath = `${folder}/${file}`;
      
      console.log(`Checking ${storagePath}...`);
      
      // Check if file exists in storage
      const { data: existing, error: checkErr } = await supabase.storage
        .from('resource-uploads')
        .list(folder, { search: file });
        
      if (existing && existing.some(f => f.name === file)) {
        console.log(`✅ ${file} already in cloud.`);
        continue;
      }
      
      console.log(`⬆️ Uploading ${file} to cloud...`);
      const fileBuffer = await fs.readFile(filePath);
      const { error: upErr } = await supabase.storage
        .from('resource-uploads')
        .upload(storagePath, fileBuffer, { upsert: true });
        
      if (upErr) console.error(`❌ Failed to upload ${file}:`, upErr.message);
      else console.log(`🎉 Successfully uploaded ${file}`);
    }
  }
  console.log('🏁 Migration Complete.');
}

migrate().catch(console.error);
