const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('better-sqlite3')('data/database.sqlite');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const USER_UPLOADS_DIR = path.join(__dirname, 'user_uploads');

async function migrateUserDocs() {
  console.log('Migrating User Documents...');
  const docs = db.prepare('SELECT id, hashed_name FROM user_documents').all();
  for (const doc of docs) {
    if (!doc.hashed_name.endsWith('.bin')) {
      const oldPath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
      const newHashedName = doc.hashed_name.split('.')[0] + '.bin';
      const newPath = path.join(USER_UPLOADS_DIR, newHashedName);

      if (fs.existsSync(oldPath)) {
        console.log(`Renaming ${doc.hashed_name} -> ${newHashedName}`);
        fs.renameSync(oldPath, newPath);
        db.prepare('UPDATE user_documents SET hashed_name = ? WHERE id = ?').run(newHashedName, doc.id);
      }
    }
  }
}

async function migratePublicDocs() {
  console.log('Migrating Public Documents...');
  // First, ensure all existing records have original_name populated
  db.prepare('UPDATE public_documents SET original_name = filename WHERE original_name IS NULL').run();

  const docs = db.prepare('SELECT id, folder, filename, original_name FROM public_documents').all();
  for (const doc of docs) {
    // Only rename if it's not already a .bin UUID-like name
    if (!doc.filename.endsWith('.bin')) {
      const oldPath = path.join(UPLOADS_DIR, doc.folder, doc.filename);
      const newHashedName = uuidv4() + '.bin';
      const newPath = path.join(UPLOADS_DIR, doc.folder, newHashedName);

      if (fs.existsSync(oldPath)) {
        console.log(`Renaming ${doc.folder}/${doc.filename} -> ${newHashedName}`);
        fs.renameSync(oldPath, newPath);
        db.prepare('UPDATE public_documents SET filename = ? WHERE id = ?').run(newHashedName, doc.id);
      }
    }
  }
}

async function run() {
  await migrateUserDocs();
  await migratePublicDocs();
  console.log('Privacy Migration Complete.');
}

run().catch(console.error);
