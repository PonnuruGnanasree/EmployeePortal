const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DB_FILE = path.join(__dirname, '..', 'data', 'database.sqlite');

async function main() {
  console.log('🔄 Starting clean up of Training Resources...');

  // 1. Supabase Cleanup
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    console.log('☁️ Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      console.log('🗑️ Deleting resource_uploads from Supabase...');
      const { error: err1 } = await supabase.from('resource_uploads').delete().neq('id', 0);
      if (err1) console.error('Error deleting resource_uploads from Supabase:', err1.message);
      else console.log('✅ Supabase resource_uploads cleared.');

      console.log('🗑️ Deleting resource_links from Supabase...');
      const { error: err2 } = await supabase.from('resource_links').delete().neq('id', 0);
      if (err2) console.error('Error deleting resource_links from Supabase:', err2.message);
      else console.log('✅ Supabase resource_links cleared.');

      // Clear storage files in Supabase resource-uploads bucket if possible
      console.log('🗑️ Clearing resource-uploads bucket...');
      const buckets = ['resource-uploads', 'resource_uploads'];
      for (const bucketName of buckets) {
        try {
          const { data: list, error: listErr } = await supabase.storage.from(bucketName).list();
          if (list && list.length > 0) {
            const filesToRemove = list.map(x => x.name);
            const { error: removeErr } = await supabase.storage.from(bucketName).remove(filesToRemove);
            if (removeErr) console.warn(`Bucket ${bucketName} file removal returned:`, removeErr.message);
            else console.log(`✅ Cleared root files from bucket: ${bucketName}`);
          }
        } catch (bucketErr) {
          console.warn(`Bucket ${bucketName} not accessible:`, bucketErr.message);
        }
      }
    } catch (e) {
      console.error('Supabase deletion error:', e.message);
    }
  } else {
    console.log('⚠️ Supabase credentials not found. Skipping Supabase clean up.');
  }

  // 2. Local SQLite Cleanup
  try {
    console.log('💾 Connecting to SQLite database...');
    const db = new Database(DB_FILE);
    db.prepare('DELETE FROM public_documents').run();
    console.log('✅ SQLite public_documents table cleared.');
    db.close();
  } catch (e) {
    console.error('SQLite deletion error:', e.message);
  }

  // 3. Clear uploads directory
  try {
    console.log('📂 Clearing uploads directory...');
    const items = await fs.readdir(UPLOADS_DIR);
    for (const item of items) {
      const itemPath = path.join(UPLOADS_DIR, item);
      await fs.remove(itemPath);
    }
    console.log('✅ Local uploads directory cleared.');
  } catch (e) {
    console.error('Uploads directory clearing error:', e.message);
  }

  console.log('✨ Training Resources have been fully reset successfully!');
}

main().catch(console.error);
