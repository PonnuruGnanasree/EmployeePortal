const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const DB_FILE = path.join(__dirname, '..', 'data', 'database.sqlite');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const db = new Database(DB_FILE);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairPublicDocs() {
  console.log('\n🔍 Checking for untracked public documents on disk...');
  const folders = await fs.readdir(UPLOADS_DIR);
  for (const folder of folders) {
    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!(await fs.stat(folderPath)).isDirectory()) continue;
    
    const files = await fs.readdir(folderPath);
    for (const filename of files) {
      const existing = db.prepare('SELECT id FROM public_documents WHERE folder = ? AND filename = ?').get(folder, filename);
      if (!existing) {
        console.log(`  ➕ Registering untracked file: ${folder}/${filename}`);
        let originalName = filename;
        if (filename.endsWith('.ytlink')) {
           try {
             const data = await fs.readJson(path.join(folderPath, filename));
             originalName = data.title || filename;
           } catch (e) {}
        }
        db.prepare('INSERT INTO public_documents (uploader_email, folder, filename, original_name) VALUES (?, ?, ?, ?)')
          .run('anonymous@gantec.com', folder, filename, originalName);
      }
    }
  }
}

async function syncAll() {
  console.log('🚀 Starting Full Supabase Sync...');
  await repairPublicDocs();

  try {
    // 1. Sync Users
    console.log('\n👥 Syncing Users...');
    const users = db.prepare('SELECT * FROM users').all();
    for (const user of users) {
      console.log(`  Syncing user: ${user.email}`);
      // Ensure user exists in Supabase Auth if possible (or just the users table)
      // We'll focus on the users table first
      const { error: userError } = await supabase.from('users').upsert({
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        password: user.password,
        role: user.role || 'employee',
        points: user.points || 0
      }, { onConflict: 'email' });
      
      if (userError) console.error(`    ❌ Error syncing user ${user.email}:`, userError.message);
    }

    // 2. Sync Public Folders and Documents
    console.log('\n📂 Syncing Public Folders and Documents...');
    const publicDocs = db.prepare('SELECT * FROM public_documents').all();
    const publicFolders = [...new Set(publicDocs.map(d => d.folder))];

    for (const folder of publicFolders) {
      await supabase.from('resource_folders').upsert({ name: folder }, { onConflict: 'name' });
    }

    for (const doc of publicDocs) {
      console.log(`  Syncing public doc: ${doc.folder}/${doc.original_name || doc.filename}`);
      if (doc.filename.endsWith('.ytlink')) {
        try {
          const filePath = path.join(UPLOADS_DIR, doc.folder, doc.filename);
          if (fs.existsSync(filePath)) {
            const linkData = fs.readJsonSync(filePath);
            await supabase.from('resource_links').upsert({
              title: linkData.title,
              url: linkData.url,
              folder: doc.folder,
              uploaded_by: doc.uploader_email || 'anonymous@gantec.com'
            }, { onConflict: 'folder,title' });
          }
        } catch (e) { console.error(`    ❌ Error reading link ${doc.filename}:`, e.message); }
      } else {
        // Normal file
        const filePath = path.join(UPLOADS_DIR, doc.folder, doc.filename);
        let size = 0;
        if (fs.existsSync(filePath)) {
          size = fs.statSync(filePath).size;
        }
        await supabase.from('resource_uploads').upsert({
          filename: doc.filename,
          original_name: doc.original_name || doc.filename,
          folder: doc.folder,
          uploaded_by: doc.uploader_email || 'anonymous@gantec.com',
          size: size
        }, { onConflict: 'folder,filename' });
      }
    }

    // 3. Sync User Folders and Private Documents
    console.log('\n🔒 Syncing Private User Folders and Documents...');
    const userFolders = db.prepare('SELECT * FROM user_folders').all();
    for (const f of userFolders) {
      await supabase.from('user_folders').upsert({
        user_id: f.user_id,
        path: f.path
      }, { onConflict: 'user_id,path' });
    }

    const userDocs = db.prepare('SELECT * FROM user_documents').all();
    for (const d of userDocs) {
      console.log(`  Syncing private doc: ${d.user_id} - ${d.folder}/${d.original_name}`);
      await supabase.from('user_documents').upsert({
        user_id: d.user_id,
        original_name: d.original_name,
        hashed_name: d.hashed_name,
        folder: d.folder,
        size: d.size,
        upload_date: d.upload_date
      }, { onConflict: 'hashed_name' });
    }

    console.log('\n✅ Full Sync Complete!');
  } catch (err) {
    console.error('\n❌ Fatal Sync Error:', err.message);
  }
}

syncAll();
