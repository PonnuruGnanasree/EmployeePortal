const Database = require('better-sqlite3');
const db = new Database('data/database.sqlite');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function clean() {
  console.log('--- Checking SQLite Database ---');
  const localDocs = db.prepare("SELECT * FROM public_documents WHERE folder LIKE '%onerror%' OR folder LIKE '%img%'").all();
  console.log('Matching SQLite Docs:', localDocs);

  if (localDocs.length > 0) {
    console.log('Deleting from SQLite...');
    db.prepare("DELETE FROM public_documents WHERE folder LIKE '%onerror%' OR folder LIKE '%img%'").run();
    console.log('Deleted successfully.');
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('--- Checking Supabase Database ---');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Check resource_folders
    const { data: folders, error: fErr } = await supabase
      .from('resource_folders')
      .select('*')
      .or('name.ilike.%onerror%,name.ilike.%img%');
    console.log('Matching Supabase folders:', folders);

    if (folders && folders.length > 0) {
      console.log('Deleting folders from Supabase...');
      const { error } = await supabase
        .from('resource_folders')
        .delete()
        .or('name.ilike.%onerror%,name.ilike.%img%');
      if (error) console.error('Error deleting folders:', error);
      else console.log('Folders deleted successfully.');
    }

    // Check resource_uploads
    const { data: uploads, error: uErr } = await supabase
      .from('resource_uploads')
      .select('*')
      .or('folder.ilike.%onerror%,folder.ilike.%img%');
    console.log('Matching Supabase uploads:', uploads);

    if (uploads && uploads.length > 0) {
      console.log('Deleting uploads from Supabase...');
      const { error } = await supabase
        .from('resource_uploads')
        .delete()
        .or('folder.ilike.%onerror%,folder.ilike.%img%');
      if (error) console.error('Error deleting uploads:', error);
      else console.log('Uploads deleted successfully.');
    }

    // Check resource_links
    const { data: links, error: lErr } = await supabase
      .from('resource_links')
      .select('*')
      .or('folder.ilike.%onerror%,folder.ilike.%img%');
    console.log('Matching Supabase links:', links);

    if (links && links.length > 0) {
      console.log('Deleting links from Supabase...');
      const { error } = await supabase
        .from('resource_links')
        .delete()
        .or('folder.ilike.%onerror%,folder.ilike.%img%');
      if (error) console.error('Error deleting links:', error);
      else console.log('Links deleted successfully.');
    }
  }

  db.close();
}

clean().catch(console.error);
