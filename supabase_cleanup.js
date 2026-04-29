const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const USER_UPLOADS_DIR = path.join(__dirname, 'user_uploads');

async function cleanupShared() {
  console.log('Cleaning up shared resource records...');
  const { data: records, error } = await supabase.from('resource_uploads').select('*');
  if (error) throw error;

  for (const record of records) {
    const filePath = path.join(UPLOADS_DIR, record.folder, record.filename);
    if (!fs.existsSync(filePath)) {
      console.log(`Ghost found! Deleting ${record.folder}/${record.filename} from Supabase...`);
      await supabase.from('resource_uploads').delete().eq('id', record.id);
    }
  }
}

async function cleanupPrivate() {
  console.log('Cleaning up private document records...');
  const { data: records, error } = await supabase.from('user_documents').select('*');
  if (error) throw error;

  for (const record of records) {
    const filePath = path.join(USER_UPLOADS_DIR, record.hashed_name);
    if (!fs.existsSync(filePath)) {
      console.log(`Ghost found! Deleting private file ${record.hashed_name} from Supabase...`);
      await supabase.from('user_documents').delete().eq('id', record.id);
    }
  }
}

async function cleanupLinks() {
  console.log('Cleaning up link records...');
  const { data: records, error } = await supabase.from('resource_links').select('*');
  if (error) throw error;

  for (const record of records) {
    // We need to find the hashed name from the public_documents table to check disk
    const doc = db.prepare('SELECT filename FROM public_documents WHERE original_name = ? AND folder = ?').get(`${record.title}.ytlink`, record.folder);
    
    if (!doc) {
       console.log(`Link record for ${record.title} not tracked in local DB. Deleting from Supabase...`);
       await supabase.from('resource_links').delete().eq('id', record.id);
       continue;
    }

    const filePath = path.join(UPLOADS_DIR, record.folder, doc.filename);
    if (!fs.existsSync(filePath)) {
      console.log(`Ghost link found! Deleting ${record.title} from Supabase...`);
      await supabase.from('resource_links').delete().eq('id', record.id);
    }
  }
}

async function run() {
  await cleanupShared();
  await cleanupPrivate();
  await cleanupLinks();
  console.log('Supabase Cleanup Complete.');
}


run().catch(console.error);
