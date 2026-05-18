const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function clean() {
  console.log('--- Checking SQLite Database ---');
  // Check in SQLite public_documents
  const localDocs = db.prepare("SELECT * FROM public_documents WHERE original_name LIKE '%Rick Roll%' OR original_name LIKE '%Another Video%' OR filename LIKE '%Rick Roll%' OR filename LIKE '%Another Video%'").all();
  console.log('Matching SQLite Docs:', localDocs);

  if (localDocs.length > 0) {
    console.log('Deleting from SQLite public_documents...');
    db.prepare("DELETE FROM public_documents WHERE original_name LIKE '%Rick Roll%' OR original_name LIKE '%Another Video%' OR filename LIKE '%Rick Roll%' OR filename LIKE '%Another Video%'").run();
    console.log('Deleted from SQLite successfully.');
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('--- Checking Supabase Database ---');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Check resource_links
    const { data: links, error: lErr } = await supabase
      .from('resource_links')
      .select('*')
      .or('title.ilike.%Rick Roll%,title.ilike.%Another Video%');
    console.log('Matching Supabase links:', links);

    if (links && links.length > 0) {
      console.log('Deleting links from Supabase...');
      const { error } = await supabase
        .from('resource_links')
        .delete()
        .or('title.ilike.%Rick Roll%,title.ilike.%Another Video%');
      if (error) console.error('Error deleting links:', error);
      else console.log('Links deleted successfully.');
    }

    // Check resource_uploads just in case
    const { data: uploads, error: uErr } = await supabase
      .from('resource_uploads')
      .select('*')
      .or('filename.ilike.%Rick Roll%,filename.ilike.%Another Video%');
    console.log('Matching Supabase uploads:', uploads);

    if (uploads && uploads.length > 0) {
      console.log('Deleting uploads from Supabase...');
      const { error } = await supabase
        .from('resource_uploads')
        .delete()
        .or('filename.ilike.%Rick Roll%,filename.ilike.%Another Video%');
      if (error) console.error('Error deleting uploads:', error);
      else console.log('Uploads deleted successfully.');
    }
  }

  db.close();
}

clean().catch(console.error);
