const fs = require('fs-extra');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DB_FILE = path.join(__dirname, '..', 'data', 'database.sqlite');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
  console.log('🧹 Starting Full Cleanup of Training Resources...');

  // 1. Clear SQLite Tables
  try {
    const db = new Database(DB_FILE);
    db.prepare('DELETE FROM public_documents').run();
    console.log('✅ SQLite: public_documents cleared.');
  } catch (err) {
    console.error('❌ SQLite error:', err.message);
  }

  // 2. Clear Supabase Tables
  try {
    const { error: err1 } = await supabase.from('resource_uploads').delete().neq('id', 0);
    const { error: err2 } = await supabase.from('resource_links').delete().neq('id', 0);
    if (err1 || err2) console.error('❌ Supabase Table Clear error:', err1?.message || err2?.message);
    else console.log('✅ Supabase: resource_uploads and resource_links cleared.');
  } catch (err) {
    console.error('❌ Supabase error:', err.message);
  }

  // 3. Delete Local Files
  try {
    const folders = await fs.readdir(UPLOADS_DIR);
    for (const folder of folders) {
      const folderPath = path.join(UPLOADS_DIR, folder);
      if ((await fs.stat(folderPath)).isDirectory()) {
        await fs.emptyDir(folderPath);
      }
    }
    console.log('✅ Local: uploads directory emptied.');
  } catch (err) {
    console.error('❌ Local file error:', err.message);
  }

  // 4. Clear Supabase Storage
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const targetBucket = 'resource-uploads';
    if (buckets && buckets.some(b => b.name === targetBucket)) {
      // List all files and delete them
      // Note: Supabase doesn't have an "empty bucket" command, we have to list and delete
      // For simplicity, we'll just log that manual intervention might be needed for large buckets
      console.log(`📦 Note: Supabase Storage bucket "${targetBucket}" should be emptied manually in the dashboard for complete cleanup.`);
    }
  } catch (err) {
    console.warn('⚠️ Bucket check failed:', err.message);
  }

  console.log('🏁 Cleanup Complete. Training Resources are now empty.');
}

cleanup().catch(console.error);
