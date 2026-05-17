require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function nuke() {
  const target = 'a89564fc-d568-43a0-b28c-511e50dd25e2.bin';
  
  console.log('1. DELETING FROM SUPABASE...');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  await supabase.from('resource_uploads').delete().like('filename', `%${target}%`);
  await supabase.from('public_documents').delete().like('filename', `%${target}%`);
  await supabase.storage.from('resource-uploads').remove([`Weekly Connect/${target}`]);
  
  console.log('2. DELETING FROM LOCAL SQLITE...');
  const db = new Database('./data/database.sqlite');
  const tables = ['user_documents', 'public_documents', 'resource_uploads', 'resource_links'];
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table} WHERE filename LIKE ?`).run(`%${target}%`);
    } catch(e) {}
    try {
      db.prepare(`DELETE FROM ${table} WHERE id LIKE ?`).run(`%${target}%`);
    } catch(e) {}
  }
  
  console.log('3. DELETING FROM LOCAL DISK...');
  function findFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      if (fs.statSync(fullPath).isDirectory()) {
        findFiles(fullPath);
      } else if (f.includes(target)) {
        console.log('Found file on disk:', fullPath);
        fs.unlinkSync(fullPath);
      }
    }
  }
  findFiles('./uploads');
  
  console.log('NUKE COMPLETE.');
}
nuke();
