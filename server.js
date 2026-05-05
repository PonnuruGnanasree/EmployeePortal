const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const crypto = require('crypto');


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'data', 'database.sqlite');

// Ensure directories exist
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(path.dirname(DB_FILE));

const { createClient } = require('@supabase/supabase-js');

// Supabase Configuration (optional — falls back to SQLite if not configured)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase initialized');
  
  // Verify connection immediately
  supabase.from('users').select('count', { count: 'exact', head: true }).then(({ error }) => {
    if (error) {
      console.error('❌ Supabase Connection Error:', error.message);
      console.error('👉 Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    } else {
      console.log('✅ Supabase Connection Verified Successfully');
    }
  });
} else {
  console.log('⚠️ Supabase credentials not found — running in SQLite mode');
}

// Encryption Config (Move to top to avoid Temporal Dead Zone errors)
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'gantec-default-secret').digest();
const IV_LENGTH = 16;

// Initialize SQLite database
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    fullname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    points REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, path)
  );

  CREATE TABLE IF NOT EXISTS user_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    hashed_name TEXT NOT NULL,
    folder TEXT NOT NULL,
    size INTEGER NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS public_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uploader_email TEXT NOT NULL,
    folder TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(folder, filename)
  );
`);

// ─── Schema Migration for UUID Support ────────────────────────────────────────
// If users.id is INTEGER, we must migrate to TEXT to support Supabase UUIDs
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const idCol = tableInfo.find(c => c.name === 'id');
  if (idCol && (String(idCol.type).toUpperCase().includes('INT'))) {
    console.log('⚠️ Migrating users table to support UUIDs...');
    db.exec(`
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        fullname TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        points REAL DEFAULT 0
      );
      INSERT INTO users (id, fullname, email, password, role, points)
      SELECT CAST(id AS TEXT), fullname, email, password, role, points FROM users_old;
      DROP TABLE users_old;
    `);
    
    // Also migrate dependent tables
    db.exec(`
      ALTER TABLE user_folders RENAME TO user_folders_old;
      CREATE TABLE user_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, path)
      );
      INSERT INTO user_folders (user_id, path) SELECT CAST(user_id AS TEXT), path FROM user_folders_old;
      DROP TABLE user_folders_old;

      ALTER TABLE user_documents RENAME TO user_documents_old;
      CREATE TABLE user_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        hashed_name TEXT NOT NULL,
        folder TEXT NOT NULL,
        size INTEGER NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      INSERT INTO user_documents (user_id, original_name, hashed_name, folder, size)
      SELECT CAST(user_id AS TEXT), original_name, hashed_name, folder, size FROM user_documents_old;
      DROP TABLE user_documents_old;
    `);
    console.log('✅ Schema migration complete.');
  }
} catch (e) {
  console.error('❌ Schema migration failed:', e.message);
}

// Ensure columns exist (for existing databases)
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'employee'"); } catch (e) {}
try { db.exec("ALTER TABLE public_documents ADD COLUMN original_name TEXT"); } catch (e) {}
// Back‑fill existing rows where original_name is null
try { db.exec("UPDATE public_documents SET original_name = filename WHERE original_name IS NULL"); } catch (e) {}

// ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth API ───────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    if (!email || !email.endsWith('@gantecusa.com')) {
      return res.status(400).json({ error: 'Email must be an official @gantecusa.com address.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one special character' });
    }

    // Check if user exists
    const stmtCheck = db.prepare('SELECT * FROM users WHERE email = ?');
    const existingUser = stmtCheck.get(email);

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user in Supabase Auth if enabled
    if (supabase) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { fullname: fullname }
      });

      if (authError) {
        console.error('Supabase Auth signup error:', authError);
        return res.status(400).json({ error: authError.message });
      }

      // Sync with custom users table
      const { data, error } = await supabase
        .from('users')
        .insert([{ id: authUser.user.id, fullname, email, password: hashedPassword, role: 'employee', points: 0 }])
        .select();
      
      if (error) {
        console.error('Supabase DB sync error:', error);
      }
      console.log('User synced to Supabase Auth and DB');
    }

    // Insert new user in SQLite (always keep local copy for fallback/speed)
    const stmtInsert = db.prepare('INSERT INTO users (fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?)');
    stmtInsert.run(fullname, email, hashedPassword, 'employee', 0);

    res.json({ success: true, user: { fullname, email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sign up failed' });
  }
});


app.post('/api/auth/login', async (req, res) => {
  try {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;

    let user = null;
    let localUser = null;
    let supaUser = null;

    // 1. Check Local SQLite (most reliable for legacy)
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      localUser = stmt.get(email);
    } catch (e) { console.error('Local DB search failed:', e); }

    // 2. Check Supabase DB
    if (supabase) {
      const { data } = await supabase.from('users').select('*').eq('email', email);
      if (data && data.length > 0) supaUser = data[0];
    }

    // 3. Resolve source of truth (Prefer Supabase if exists, else Local)
    user = supaUser || localUser;

    // FIX: If Supabase profile has an empty password (managed by Auth),
    // we MUST securely fall back to the local SQLite password hash for bcrypt comparison.
    if (user && !user.password && localUser && localUser.password) {
      user.password = localUser.password;
    }

    if (!user) {
      console.log(`Login failed: Email ${email} not found in any database.`);
      return res.status(401).json({ error: 'Account does not exist' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Login attempt for ${email}:`);
    console.log(`- User found in DB: ${!!user}`);
    if (user) {
        console.log(`- Hash exists: ${!!user.password}`);
        console.log(`- Password provided length: ${password ? password.length : 0}`);
    }
    console.log(`- Password match result: ${isMatch}`);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // --- AUTO-MIGRATION LOGIC ---
    if (supabase) {
      try {
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        let authUser = null;
        if (listData && listData.users) {
           authUser = listData.users.find(u => u.email === email);
        }
        
        let supaId = null;
        if (!authUser) {
          console.log('Migrating legacy user to Supabase Auth:', email);
          const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
            email: email,
            password: password, 
            email_confirm: true,
            user_metadata: { fullname: user.fullname }
          });
          if (newAuth && newAuth.user) supaId = newAuth.user.id;
        } else {
          supaId = authUser.id;
        }

        // IMPORTANT: Ensure the user exists in public.users table for FK linking
        if (supaId) {
          const { data: existingProfile } = await supabase.from('users').select('id').eq('email', email).single();
          if (!existingProfile) {
            console.log('Creating missing profile in public.users:', email);
            await supabase.from('users').insert([{ 
              id: supaId, 
              fullname: user.fullname, 
              email: email,
              password: user.password,
              role: 'employee',
              points: user.points || 0 
            }]);
          }
        }
      } catch (e) {
        console.warn('Migration check skip:', e.message);
      }
    }

    res.json({ success: true, user: { fullname: user.fullname, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});


// GET /api/auth/profile – Get current user profile
app.get('/api/auth/profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    let user = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (data) user = data;
    }

    if (!user) {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      user = stmt.get(email);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
 
    res.json({ success: true, user: { fullname: user.fullname, email: user.email, points: user.points || 0, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});


// PUT /api/auth/profile – Update user profile
app.put('/api/auth/profile', async (req, res) => {
  try {
    const { currentEmail, fullname, email, currentPassword, newPassword } = req.body;

    if (!currentEmail) return res.status(400).json({ error: 'Current email required' });

    const stmtUser = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmtUser.get(currentEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate new email if provided
    if (email && email !== currentEmail) {
      if (!email.endsWith('@gantecusa.com')) {
        return res.status(400).json({ error: 'Email must be an official @gantecusa.com address.' });
      }
    }

    // Validate new password if provided
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
      }
      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one uppercase letter' });
      }
      if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one lowercase letter' });
      }
      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one number' });
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one special character' });
      }
    }

    // Verify current password if changing password or email and password is provided
    if (currentPassword && (newPassword || email !== currentEmail) && !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // If changing password or email without providing current password, skip the change
    if ((newPassword || email !== currentEmail) && !currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change email or password' });
    }

    // Check if new email is already taken by another user
    if (email !== currentEmail) {
      const existingEmail = stmtUser.get(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user data
    let newFullname = fullname || user.fullname;
    let newEmailToSet = email || user.email;
    let newPasswordHashed = user.password;

    if (newPassword) {
      newPasswordHashed = await bcrypt.hash(newPassword, 10);
    }

    const stmtUpdate = db.prepare('UPDATE users SET fullname = ?, email = ?, password = ? WHERE id = ?');
    stmtUpdate.run(newFullname, newEmailToSet, newPasswordHashed, user.id);

    res.json({ success: true, user: { fullname: newFullname, email: newEmailToSet } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Multer Storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || 'General';
    const folderPath = path.join(UPLOADS_DIR, folder);
    fs.ensureDirSync(folderPath);
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    // Save as .bin with a UUID to ensure backend privacy and anonymity
    cb(null, `${uuidv4()}.bin`);
  }
});


const upload = multer({
  storage
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// Iterative Folder Scanner (More robust on Windows/Deep paths)
async function getFoldersRecursive(startDir, baseDir) {
  let folders = [];
  let queue = [startDir];
  
  try {
    // Pre-fetch ownership data to map to files (moved inside try for safety)
    const ownershipMap = new Map();
    try {
      const ownershipData = db.prepare('SELECT folder, filename, original_name, uploader_email FROM public_documents').all();
      for (const row of ownershipData) {
        // Normalize DB folder paths to forward slashes for matching
        const normFolder = row.folder.replace(/\\/g, '/');
        const key = `${normFolder}/${row.filename}`;
        ownershipMap.set(key, { 
          uploader: row.uploader_email, 
          originalName: row.original_name || row.filename 
        });
      }
    } catch (dbErr) {
      console.warn('Could not fetch ownership data:', dbErr.message);
    }

    while (queue.length > 0) {
      const currentDir = queue.shift();
      let entries = [];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        console.warn(`Could not read directory ${currentDir}:`, e.message);
        continue;
      }

      const normCurrent = path.resolve(currentDir).toLowerCase();
      const normBase = path.resolve(baseDir).toLowerCase();

      if (normCurrent !== normBase) {
        const relPath = path.relative(baseDir, currentDir).replace(/\\/g, '/');
        const docFiles = [];

        for (const entry of entries) {
          if (entry.isFile()) {
            try {
              const filePath = path.join(currentDir, entry.name);
              const stat = await fs.stat(filePath);
              const meta = ownershipMap.get(`${relPath}/${entry.name}`) || {};
              docFiles.push({
                name: meta.originalName || entry.name,
                hashedName: entry.name,
                id: Buffer.from(path.join(relPath, entry.name)).toString('base64'),
                size: stat.size,
                uploadedAt: stat.mtime,
                uploader_email: meta.uploader || null
              });

            } catch (e) {
              /* ignore individual file errors */
            }
          }
        }
        folders.push({ name: relPath, files: docFiles });
      }

      // Add subdirectories to queue
      for (const entry of entries) {
        if (entry.isDirectory()) {
          queue.push(path.join(currentDir, entry.name));
        }
      }
    }
    
    // Auto-Sync to Supabase (Robust Healing)
    if (supabase) {
      console.log('🔄 Starting Supabase Resource Self-Healing Sync...');
      for (const f of folders) {
        // Sync Folder
        await supabase.from('resource_folders').upsert({ name: f.name }, { onConflict: 'name' });
        
        // Sync Files/Links in this folder
        for (const file of f.files) {
          if (file.name.endsWith('.ytlink')) {
            try {
              const filePath = path.join(UPLOADS_DIR, f.name, file.hashedName);
              const linkData = await fs.readJson(filePath);
              // FIX: Use .insert() or .upsert() without invalid onConflict
              await supabase.from('resource_links').insert([{
                title: linkData.title,
                url: linkData.url,
                folder: f.name,
                uploaded_by: file.uploader_email || 'anonymous@gantec.com'
              }]);
            } catch (e) { /* skip bad links */ }
          } else {
            // FIX: Remove original_name and size as they don't exist in Supabase
            await supabase.from('resource_uploads').insert([{
              filename: file.hashedName,
              folder: f.name,
              uploaded_by: file.uploader_email || 'anonymous@gantec.com'
            }]);
          }
        }
      }
      console.log('✅ Supabase Resource Sync Complete.');
    }

    return folders;
  } catch (err) {
    console.error(`Fatal error during scan:`, err.message);
    return [];
  }
}

// GET /api/folders – Return folder tree with files (Database-driven)
app.get('/api/folders', async (req, res) => {
  try {
    const foldersMap = {};

    // 1. Fetch Local Data (SQLite) - This is our most immediate record
    try {
      const localDocs = db.prepare('SELECT folder, filename, original_name, uploader_email FROM public_documents').all();
      localDocs.forEach(row => {
        if (!foldersMap[row.folder]) foldersMap[row.folder] = { name: row.folder, files: [], subfolders: [] };
        foldersMap[row.folder].files.push({ 
          name: row.original_name || row.filename, 
          path: row.filename, 
          type: 'file', 
          hashedName: row.filename,
          uploader_email: row.uploader_email
        });
      });
    } catch (e) { console.warn('⚠️ Local document fetch error:', e.message); }

    // 2. Merge with Supabase Data (if available)
    if (supabase) {
      const { data: dbFoldersList } = await supabase.from('resource_folders').select('name');
      const { data: dbFiles } = await supabase.from('resource_uploads').select('folder, filename, uploaded_by');
      const { data: dbLinks } = await supabase.from('resource_links').select('folder, title, url, uploaded_by');
      
      (dbFoldersList || []).forEach(f => { 
        if (!foldersMap[f.name]) foldersMap[f.name] = { name: f.name, files: [], subfolders: [] }; 
      });

      (dbFiles || []).forEach(row => {
        if (!foldersMap[row.folder]) foldersMap[row.folder] = { name: row.folder, files: [], subfolders: [] };
        // Avoid duplicates if already in local map
        if (!foldersMap[row.folder].files.some(f => f.hashedName === row.filename)) {
          foldersMap[row.folder].files.push({ 
            name: row.original_name || row.filename, 
            path: row.filename, 
            type: 'file', 
            hashedName: row.filename,
            uploader_email: row.uploaded_by
          });
        }
      });

      (dbLinks || []).forEach(row => {
        if (!foldersMap[row.folder]) foldersMap[row.folder] = { name: row.folder, files: [], subfolders: [] };
        if (!foldersMap[row.folder].files.some(f => f.name === row.title && f.type === 'link')) {
          foldersMap[row.folder].files.push({ name: row.title, url: row.url, type: 'link', uploader_email: row.uploaded_by });
        }
      });
    }

    // 3. If everything is empty, fallback to a disk scan
    if (Object.keys(foldersMap).length === 0) {
      await fs.ensureDir(UPLOADS_DIR);
      const folders = await getFoldersRecursive(UPLOADS_DIR, UPLOADS_DIR);
      return res.json({ folders });
    }
    
    res.json({ folders: Object.values(foldersMap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const safe = name.trim().replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_');
    const folderPath = path.join(UPLOADS_DIR, safe);
    if (await fs.pathExists(folderPath)) return res.status(409).json({ error: 'Folder already exists' });
    await fs.ensureDir(folderPath);
    if (supabase) {
      try { await supabase.from('resource_folders').upsert({ name: safe }); } catch (e) { console.error('Supabase folder sync error:', e.message); }
    }
    res.json({ success: true, name: safe });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const rawData = fs.readFileSync(req.file.path);
      const encryptedData = encryptFile(rawData);
      fs.writeFileSync(req.file.path, encryptedData);
    } catch (encryptErr) {
      console.error('Failed to encrypt public upload:', encryptErr);
      return res.status(500).json({ error: 'Failed to encrypt file' });
    }

    const folder = req.body.folder || 'General';
    const uploaderEmail = req.body.email || 'anonymous@gantec.com';
    
    if (supabase) {
      try {
        // FIX: Remove original_name and size as they don't exist in Supabase schema
        // Also use .insert() to avoid constraint matching errors
        await supabase.from('resource_uploads').insert([{
          filename: req.file.filename,
          folder: folder,
          uploaded_by: uploaderEmail
        }]);

        if (req.body.email) {
          const { data: supaUser } = await supabase.from('users').select('id, points').ilike('email', req.body.email).single();
          if (supaUser) await supabase.from('users').update({ points: (supaUser.points || 0) + 1 }).eq('id', supaUser.id);
        }
      } catch (e) { console.error('⚠️ Supabase upload sync error:', e.message); }
    }

    if (req.body.email) db.prepare('UPDATE users SET points = points + 1 WHERE email = ?').run(req.body.email);
    try {
      db.prepare('INSERT OR REPLACE INTO public_documents (uploader_email, folder, filename, original_name) VALUES (?, ?, ?, ?)')
        .run(uploaderEmail, folder, req.file.filename, req.file.originalname);
    } catch (e) { console.error('Failed to track public document in SQLite:', e); }

    res.json({ success: true, filename: req.file.filename, folder: folder, size: req.file.size });
  });
});

app.post('/api/resources/links', async (req, res) => {
  try {
    const { url, title, folder, email } = req.body;
    if (!url || !title || !folder) return res.status(400).json({ error: 'URL, title, and folder are required.' });
    const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, '_');
    const filename = `${safeTitle}.ytlink`;
    const folderPath = path.join(UPLOADS_DIR, folder);
    const filePath = path.join(folderPath, filename);
    await fs.ensureDir(folderPath);
    await fs.writeJson(filePath, { url, title, type: 'youtube' });
    if (supabase) {
      const uploaderEmail = email || 'anonymous@gantec.com';
      try {
        // FIX: Use .insert() instead of .upsert() because Supabase lacks the folder,title unique constraint
        await supabase.from('resource_links').insert([{ title, url, folder, uploaded_by: uploaderEmail }]);
        if (email) {
          const { data: user } = await supabase.from('users').select('id, points').ilike('email', email).single();
          if (user) await supabase.from('users').update({ points: (user.points || 0) + 1 }).eq('id', user.id);
        }
      } catch (e) { console.warn('⚠️ Supabase link sync error:', e.message); }
    }
    if (email) db.prepare('UPDATE users SET points = points + 1 WHERE email = ?').run(email);
    try {
      db.prepare('INSERT OR REPLACE INTO public_documents (uploader_email, folder, filename, original_name) VALUES (?, ?, ?, ?)')
        .run(email || 'anonymous@gantec.com', folder, filename, title);
    } catch (dbErr) { console.error('Failed to track video link in DB:', dbErr); }
    res.json({ success: true, filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    let users = [];
    if (supabase) {
      const { data } = await supabase.from('users').select('fullname, email, points').order('points', { ascending: false }).limit(3);
      if (data) users = data.map(u => ({ name: u.fullname, email: u.email, points: u.points }));
    }
    if (users.length === 0) users = db.prepare('SELECT fullname as name, email, points FROM users ORDER BY points DESC, fullname ASC LIMIT 3').all();
    res.json(users.map((u, i) => ({ ...u, stars: i < 3 ? 3 : (i < 7 ? 2 : 1) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/view-resource', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    db.prepare('UPDATE users SET points = points + 0.5 WHERE email = ?').run(email);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/video-redirect - Server-side redirect for YouTube links
app.get('/api/video-redirect', async (req, res) => {
  try {
    const { folder, file } = req.query;
    if (!folder || !file) return res.status(400).send('Missing parameters');
    
    const filePath = path.join(UPLOADS_DIR, folder, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('Link not found');
    
    const linkData = await fs.readJson(filePath);
    if (linkData && linkData.url) {
      return res.redirect(linkData.url);
    }
    res.status(404).send('Invalid link data');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const { folder, file } = req.query;
    if (!folder || !file) return res.status(400).json({ error: 'Missing folder or file param' });
    const filePath = path.join(UPLOADS_DIR, folder, file);
    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'File not found' });
    let doc = db.prepare('SELECT original_name FROM public_documents WHERE folder = ? AND filename = ?').get(folder, file);
    let downloadName = doc ? doc.original_name : file;
    serveDecryptedFile(filePath, res, downloadName);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/file', async (req, res) => {
  try {
    const { folder, file, email } = req.query;
    if (!folder || !file) return res.status(400).json({ error: 'Missing parameters' });
    
    // Find the document to check ownership
    let doc = db.prepare('SELECT filename, uploader_email, original_name FROM public_documents WHERE folder = ? AND (original_name = ? OR filename = ?)').get(folder, file, file);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    // RESTORE OWNERSHIP CHECK FOR FILES (Allow admins to bypass)
    const user = email ? await getUserByEmail(email) : null;
    const isAdmin = user && user.role === 'admin';

    if (email && doc.uploader_email && doc.uploader_email.toLowerCase() !== email.toLowerCase() && !isAdmin) {
      return res.status(403).json({ error: 'Access Denied: You are not the owner of this resource.' });
    }

    const filePath = path.join(UPLOADS_DIR, folder, doc.filename);
    if (await fs.pathExists(filePath)) await fs.remove(filePath);
    
    if (supabase) {
      await supabase.from('resource_uploads').delete().eq('folder', folder).eq('filename', doc.filename);
      if (doc.original_name.endsWith('.ytlink')) {
        await supabase.from('resource_links').delete().eq('folder', folder).eq('title', doc.original_name.replace('.ytlink', ''));
      }
    }
    
    db.prepare('DELETE FROM public_documents WHERE folder = ? AND filename = ?').run(folder, doc.filename);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/delete-folder', async (req, res) => {
  try {
    const folder = req.body.folder || req.query.folder;
    const email = req.body.email || req.query.email;
    if (!folder) return res.status(400).json({ error: 'Folder path required' });
    
    if (folder === '.' || folder === './' || folder === '') return res.status(403).json({ error: 'Cannot delete root' });

    // --- Ownership Check ---
    const user = email ? await getUserByEmail(email) : null;
    const isAdmin = user && user.role === 'admin';

    if (email && !isAdmin) {
      // Check if there are ANY files in this folder (or subfolders) owned by someone else
      const others = db.prepare('SELECT id FROM public_documents WHERE (folder = ? OR folder LIKE ?) AND uploader_email != ?')
                       .all(folder, folder + '/%', email);
      
      if (others.length > 0) {
        return res.status(403).json({ error: 'Access Denied: This folder contains documents uploaded by other users.' });
      }
    }
    
    const folderPath = path.join(UPLOADS_DIR, folder);
    if (await fs.pathExists(folderPath)) await fs.remove(folderPath);
    
    console.log(`[DELETE /api/delete-folder] Folder: "${folder}" by ${email || 'unknown'}`);
    
    if (supabase) {
      console.log(`[Supabase] Deleting folder records for: ${folder}`);
      await supabase.from('resource_uploads').delete().or(`folder.eq.${folder},folder.ilike.${folder}/%`);
      await supabase.from('resource_links').delete().or(`folder.eq.${folder},folder.ilike.${folder}/%`);
      await supabase.from('resource_folders').delete().or(`name.eq.${folder},name.ilike.${folder}/%`);
    }
    
    const delRes = db.prepare('DELETE FROM public_documents WHERE folder = ? OR folder LIKE ?').run(folder, folder + '/%');
    console.log(`[SQLite] Deleted ${delRes.changes} document records for ${folder}`);
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/rename-file', async (req, res) => {
  try {
    const { folder, oldName, newName, email } = req.body;
    if (!folder || !oldName || !newName || !email) return res.status(400).json({ error: 'All parameters required' });

    const doc = db.prepare('SELECT uploader_email FROM public_documents WHERE folder = ? AND (original_name = ? OR filename = ?)').get(folder, oldName, oldName);
    if (!doc || doc.uploader_email.toLowerCase() !== email.toLowerCase()) return res.status(403).json({ error: 'Access Denied: You are not the owner of this resource' });

    const oldPath = path.join(UPLOADS_DIR, folder, oldName);
    const newPath = path.join(UPLOADS_DIR, folder, newName);
    if (!await fs.pathExists(oldPath)) return res.status(404).json({ error: 'File not found' });
    if (await fs.pathExists(newPath)) return res.status(409).json({ error: 'Name already exists' });
    await fs.move(oldPath, newPath);

    if (supabase) {
      await supabase.from('resource_uploads').update({ filename: newName }).eq('folder', folder).eq('filename', oldName);
    }
    db.prepare('UPDATE public_documents SET original_name = ?, filename = ? WHERE folder = ? AND (original_name = ? OR filename = ?)')
      .run(newName, newName, folder, oldName, oldName);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/rename-folder', async (req, res) => {
  try {
    const { oldPath: oldRelPath, newName, email } = req.body;
    if (!oldRelPath || !newName || !email) return res.status(400).json({ error: 'All parameters required' });
    if (oldRelPath === '.' || oldRelPath === './' || oldRelPath === '') return res.status(403).json({ error: 'Cannot rename root' });

    const ownershipCheck = db.prepare('SELECT 1 FROM public_documents WHERE folder = ? AND uploader_email = ? LIMIT 1').get(oldRelPath, email);
    if (!ownershipCheck) return res.status(403).json({ error: 'Access Denied: You do not own any resources in this folder' });

    const parentDir = path.dirname(oldRelPath);
    const newRelPath = path.join(parentDir, newName).replace(/\\/g, '/');
    const fullOldPath = path.join(UPLOADS_DIR, oldRelPath);
    const fullNewPath = path.join(UPLOADS_DIR, newRelPath);

    if (!await fs.pathExists(fullOldPath)) return res.status(404).json({ error: 'Folder not found' });
    if (await fs.pathExists(fullNewPath)) return res.status(409).json({ error: 'Folder name already exists' });
    await fs.move(fullOldPath, fullNewPath);

    db.prepare('UPDATE public_documents SET folder = ? WHERE folder = ?').run(newRelPath, oldRelPath);
    db.prepare('UPDATE public_documents SET folder = REPLACE(folder, ?, ?) WHERE folder LIKE ? || "/%"').run(oldRelPath, newRelPath, oldRelPath);

    if (supabase) {
      await supabase.from('resource_uploads').update({ folder: newRelPath }).ilike('folder', `${oldRelPath}%`);
      await supabase.from('resource_links').update({ folder: newRelPath }).ilike('folder', `${oldRelPath}%`);
    }
    res.json({ success: true, newPath: newRelPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER DOCUMENTS API ────────────────────────────────────────────────────────

const USER_UPLOADS_DIR = path.join(__dirname, 'user_uploads');
fs.ensureDirSync(USER_UPLOADS_DIR);

// Encryption helpers (moved to config at top)

async function decryptFileToBuffer(filePath) {
  const data = await fs.readFile(filePath);
  if (data.length < IV_LENGTH) return data;
  
  const iv = data.slice(0, IV_LENGTH);
  const encrypted = data.slice(IV_LENGTH);
  
  // Check if it's actually encrypted by looking for common headers in the IV spot
  const head = iv.toString('utf8');
  const isUnencrypted = head.startsWith('%PDF') || 
                        head.startsWith('{') || 
                        head.startsWith('PK\x03\x04') || 
                        head.startsWith('http') ||
                        head.startsWith('{\n') ||
                        head.startsWith('{"');
  
  // Also check if size is valid for AES
  if (isUnencrypted || (data.length % 16 !== 0)) return data;

  try {
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_SECRET, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted;
  } catch (e) {
    console.warn('Decryption failed in decryptFileToBuffer, returning raw data:', e.message);
    return data;
  }
}

function encryptFile(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_SECRET, iv);
  const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return encrypted;
}

function serveDecryptedFile(filePath, res, filename) {
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  
  // Read the first 16 bytes to check for unencrypted headers
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const head = buffer.toString('utf8');
  const isUnencrypted = head.startsWith('%PDF') || 
                        head.startsWith('{') || 
                        head.startsWith('PK\x03\x04') || 
                        head.startsWith('http') ||
                        head.startsWith('{\n') ||
                        head.startsWith('{"');

  // Also, if the file size is not a multiple of 16, it cannot be encrypted by our system
  const sizeMismatched = (fileSize % 16 !== 0);

  if (isUnencrypted || sizeMismatched) {
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return fs.createReadStream(filePath).pipe(res);
  }

  // Proceed with decryption for everything else
  const readStream = fs.createReadStream(filePath);
  let iv = Buffer.alloc(0);
  let decipher = null;

  readStream.on('data', (chunk) => {
    if (iv.length < IV_LENGTH) {
      const needed = IV_LENGTH - iv.length;
      iv = Buffer.concat([iv, chunk.slice(0, needed)]);
      
      if (iv.length === IV_LENGTH) {
        try {
          decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_SECRET, iv);
          res.setHeader('Content-Type', getContentType(filename));
          res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
          
          const remaining = chunk.slice(needed);
          if (remaining.length > 0) {
            res.write(decipher.update(remaining));
          }
        } catch (e) {
          console.error('Decipher initialization failed:', e.message);
          // Fallback to raw if decryption setup fails
          res.setHeader('Content-Type', getContentType(filename));
          res.setHeader('Content-Disposition', 'inline');
          res.write(chunk);
        }
      }
    } else {
      if (decipher) {
        res.write(decipher.update(chunk));
      } else {
        res.write(chunk);
      }
    }
  });

  readStream.on('end', () => {
    try {
      if (decipher) {
        res.write(decipher.final());
      }
    } catch (err) {
      console.error('Decryption finalization failed (legacy fallback might be needed):', err.message);
    } finally {
      res.end();
    }
  });

  readStream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) res.status(500).send('Error reading file');
  });
}



async function getUserByEmail(email) {
  console.log('🔍 Looking up user:', email);

  // First check local SQLite
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  console.log('SQLite user lookup result:', user ? 'Found' : 'Not found');

  // If not found locally but Supabase is available, check Supabase Auth and users table
  if (!user && supabase) {
    try {
      console.log('Checking Supabase Auth for user...');
      // First check if user exists in Supabase Auth
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === email);

      if (authUser) {
        console.log('✅ Found user in Supabase Auth:', authUser.id);

        // Check if user exists in users table
        const { data: supaUser, error: userError } = await supabase.from('users').select('*').eq('id', authUser.id).single();

        if (supaUser) {
          console.log('✅ Found user in Supabase users table, syncing to SQLite');
          console.log('Supabase user data:', JSON.stringify(supaUser, null, 2));
          try {
            // First check if user already exists by email
            const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(supaUser.email);
            if (existingUser) {
              console.log('User already exists in SQLite, updating...');
              const updateStmt = db.prepare('UPDATE users SET id = ?, fullname = ?, password = ?, role = ?, points = ? WHERE email = ?');
              updateStmt.run(
                String(supaUser.id),
                String(supaUser.fullname || ''),
                String(supaUser.password || ''),
                String(supaUser.role || 'employee'),
                Number(supaUser.points || 0),
                String(supaUser.email)
              );
            } else {
              console.log('Creating new user in SQLite...');
              // Create user in local SQLite database - handle data type conversions
              const stmt = db.prepare('INSERT INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)');
              stmt.run(
                String(supaUser.id),
                String(supaUser.fullname || ''),
                String(supaUser.email || ''),
                String(supaUser.password || ''),
                String(supaUser.role || 'employee'),
                Number(supaUser.points || 0)
              );
            }
            user = supaUser;
            console.log('✅ SQLite sync successful');
          } catch (dbError) {
            console.error('❌ SQLite insert error:', dbError.message);
            console.error('❌ Statement:', dbError.stmt?.source || 'Unknown');
            // Try to get more info about existing records
            try {
              const existing = db.prepare('SELECT id, email FROM users WHERE email = ?').get(supaUser.email);
              console.error('❌ Existing user with same email:', existing);
            } catch (checkError) {
              console.error('❌ Could not check existing users:', checkError.message);
            }
            // Fallback: return Supabase user even if SQLite sync fails
            console.log('⚠️ Using Supabase user data despite SQLite sync failure');
            user = supaUser;
          }
        } else {
          console.log('⚠️ User exists in Auth but not in users table, creating profile');
          // Create user profile in Supabase users table
          const userData = {
            id: authUser.id,
            fullname: authUser.user_metadata?.fullname || email.split('@')[0],
            email: email,
            password: '', // No password for Auth users
            role: 'employee',
            points: 0
          };

          const { data: newUser, error: createError } = await supabase.from('users').insert([userData]).select().single();

          if (newUser) {
            try {
              // Create in local SQLite - handle data types
              const stmt = db.prepare('INSERT OR REPLACE INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?)');
              stmt.run(
                String(newUser.id),
                String(newUser.fullname || ''),
                String(newUser.email || ''),
                String(newUser.password || ''),
                String(newUser.role || 'employee'),
                Number(newUser.points || 0)
              );
              user = newUser;
              console.log('✅ User profile created and synced');
            } catch (dbError) {
              console.error('❌ SQLite sync error:', dbError.message);
            }
          } else {
            console.error('❌ Failed to create user profile:', createError?.message);
          }
        }
      } else {
        console.log('❌ User not found in Supabase Auth');
      }
    } catch (e) {
      console.warn('❌ Supabase lookup error:', e.message);
    }
  }

  console.log('Final user lookup result:', user ? 'Found' : 'Not found');
  return user;
}

app.get('/api/my-documents/folders', async (req, res) => {

  try {
    const { email } = req.query;
    console.log('Incoming folder request for:', email);
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await getUserByEmail(email);
    if (!user) {
      console.warn('User not found in DB:', email);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get folders
    const foldersStmt = db.prepare('SELECT path FROM user_folders WHERE user_id = ?');
    let userFolders = foldersStmt.all(user.id).map(f => f.path);

    // Get documents
    const docsStmt = db.prepare('SELECT original_name, hashed_name, folder, size, upload_date FROM user_documents WHERE user_id = ?');
    const userDocs = docsStmt.all(user.id);

    // Sync with Supabase if available
    if (supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          const { data: sbFolders } = await supabase.from('user_folders').select('path').eq('user_id', supaUser.id);
          const { data: sbDocs } = await supabase.from('user_documents').select('*').eq('user_id', supaUser.id);
          
          if (sbFolders && sbDocs) {
            const folderMap = { 'General': { name: 'General', files: [], subfolders: [] } };
            sbFolders.forEach(f => { folderMap[f.path] = { name: f.path, files: [], subfolders: [] }; });
            sbDocs.forEach(d => {
              const folder = d.folder || 'General';
              if (!folderMap[folder]) folderMap[folder] = { name: folder, files: [], subfolders: [] };
              folderMap[folder].files.push({ name: d.original_name, path: d.hashed_name, size: d.size, upload_date: d.upload_date, type: 'file' });
            });
            return res.json({ folders: Object.values(folderMap) });
          }
        }
      } catch (e) { console.warn('⚠️ Supabase sync fetch error:', e.message); }
    }

    // AUTO-MIGRATION: If Supabase was empty but local has data, sync them now
    if (supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          for (const path of userFolders) {
            await supabase.from('user_folders').upsert({ user_id: supaUser.id, path }, { onConflict: 'user_id,path' });
          }
          for (const d of userDocs) {
            await supabase.from('user_documents').upsert({
              user_id: supaUser.id,
              original_name: d.original_name,
              hashed_name: d.hashed_name,
              folder: d.folder,
              size: d.size,
              upload_date: d.upload_date
            }, { onConflict: 'hashed_name' });
          }
          console.log(`✅ Auto-Migrated ${userFolders.length} folders and ${userDocs.length} docs to Supabase for ${email}`);
        }
      } catch (e) { console.error('⚠️ Auto-Migration Failed:', e.message); }
    }


    let foldersMap = {};
    userFolders.forEach(f => {
      if (!foldersMap[f]) foldersMap[f] = { name: f, files: [] };
    });

    userDocs.forEach(doc => {
      if (!foldersMap[doc.folder]) {
        foldersMap[doc.folder] = { name: doc.folder, files: [] };
      }
      foldersMap[doc.folder].files.push({
        name: doc.original_name,
        hashedName: doc.hashed_name,
        size: doc.size,
        uploadedAt: doc.upload_date
      });
    });

    const folders = Object.values(foldersMap);
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/my-documents/folders', async (req, res) => {

  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const safe = name.trim().replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_');

    if (supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          await supabase.from('user_folders').upsert({ user_id: supaUser.id, path: safe }, { onConflict: 'user_id,path' });
          console.log(`✅ Folder "${safe}" synced to Supabase for UUID: ${supaUser.id}`);
        }
      } catch (e) { console.error('❌ Supabase Folder Sync FAILED:', e.message); }
    }

    const stmt = db.prepare('INSERT OR IGNORE INTO user_folders (user_id, path) VALUES (?, ?)');
    stmt.run(user.id, safe);
    res.json({ success: true, name: safe });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, USER_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Save as .bin to prevent direct execution/viewing
    cb(null, `${uuidv4()}.bin`);
  }
});
const uploadUserDoc = multer({
  storage: userStorage,
  limits: { fileSize: Infinity } // Allow any size as requested
});

app.post('/api/my-documents/upload', uploadUserDoc.single('file'), async (req, res) => {
  console.log('📥 Upload request received:', { email: req.body.email, folder: req.body.folder, file: req.file?.originalname });

  try {
    const { email, folder } = req.body;
    if (!email) {
      console.error('❌ Upload failed: No email provided');
      if (req.file) fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'Email required' });
    }
    const user = await getUserByEmail(email);
    if (!user) {
      console.error('❌ Upload failed: User not found for email:', email);
      if (req.file) fs.removeSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.file) {
      console.error('❌ Upload failed: No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Encrypt the file on disk FIRST (before any DB operations)
    const rawData = fs.readFileSync(req.file.path);
    const encryptedData = encryptFile(rawData);
    fs.writeFileSync(req.file.path, encryptedData);

    const targetFolder = folder || 'General';
    
    // Supabase Sync (sync to backend BEFORE responding)
    if (supabase) {
      try {
        // 1. Get the real Supabase UUID (the local user.id is a SQLite integer)
        const { data: supaUser, error: fetchError } = await supabase.from('users').select('id').ilike('email', email).single();
        
        if (fetchError) {
          console.error('❌ Supabase UUID Lookup FAILED:', fetchError.message);
        }

        if (supaUser && supaUser.id) {
          const supaId = supaUser.id;
          console.log(`Syncing private doc to Supabase using UUID: ${supaId}`);

          // 2. Use the UUID for Supabase inserts
          const { error: folderError } = await supabase.from('user_folders').upsert({ user_id: supaId, path: targetFolder }, { onConflict: 'user_id,path' });
          if (folderError) console.error('❌ Supabase Folder Sync FAILED:', folderError.message);

          const { error: syncError } = await supabase.from('user_documents').insert([{
            user_id: supaId,
            original_name: req.file.originalname,
            hashed_name: req.file.filename,
            folder: targetFolder,
            size: req.file.size
          }]);

          if (syncError) {
            console.error('❌ Supabase Private Doc Sync FAILED:', syncError.message);
          } else {
            console.log('✅ Supabase Private Doc Sync SUCCESS');
          }
          await supabase.from('users').update({ points: (user.points || 0) + 10 }).eq('id', supaId);
        } else {
          console.warn('⚠️ No Supabase UUID found for email. Sync skipped.');
        }
      } catch (e) {
        console.error('⚠️ Supabase private sync catch:', e.message);
      }
    }

    // Local SQLite operations
    db.prepare('INSERT OR IGNORE INTO user_folders (user_id, path) VALUES (?, ?)').run(user.id, targetFolder);
    const stmt = db.prepare('INSERT INTO user_documents (user_id, original_name, hashed_name, folder, size) VALUES (?, ?, ?, ?, ?)');
    stmt.run(user.id, req.file.originalname, req.file.filename, targetFolder, req.file.size);

    db.prepare('UPDATE users SET points = points + 10 WHERE id = ?').run(user.id);


    res.json({
      success: true,
      filename: req.file.originalname,
      folder: targetFolder,
      size: req.file.size
    });
  } catch (err) {
    if (req.file) fs.removeSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-documents/file', async (req, res) => {
  try {
    const { email, folder, file } = req.query;
    if (!email || !folder || !file) return res.status(400).json({ error: 'Missing params' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT hashed_name FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, file);
    if (!doc) return res.status(404).json({ error: 'File not found in DB' });

    const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'File missing on disk' });

    // Decrypt and serve using stream
    try {
      serveDecryptedFile(filePath, res, file);
    } catch (e) {
      console.error('Decryption failed:', e);
      res.status(500).json({ error: 'Failed to decrypt file' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Helper for content types
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.ytlink': 'application/json',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.xml': 'application/xml'
  };
  return types[ext] || 'application/octet-stream';
}


app.delete('/api/my-documents/file', async (req, res) => {
  try {
    const { email, folder, file } = req.query;
    if (!email || !folder || !file) return res.status(400).json({ error: 'Missing params' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, file);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    // 1. Delete from disk FIRST
    const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }

    // 2. Sync with Supabase
    if (supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          await supabase.from('user_documents').delete().eq('user_id', supaUser.id).eq('hashed_name', doc.hashed_name);
        }
      } catch (e) { console.error('Supabase doc delete sync error:', e.message); }
    }

    // 3. Delete from SQLite
    db.prepare('DELETE FROM user_documents WHERE id = ?').run(doc.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/my-documents/folder', async (req, res) => {
  try {
    const { email, folder } = req.body;
    if (!email || !folder) return res.status(400).json({ error: 'Missing params' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const docs = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND folder LIKE ?').all(user.id, folder + '%');
    
    // 1. Delete files from disk FIRST
    for (const doc of docs) {
      const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
      if (await fs.pathExists(filePath)) await fs.remove(filePath);
    }
    
    // 2. Sync with Supabase
    if (supabase) {
      for (const doc of docs) {
        await supabase.from('user_documents').delete().eq('hashed_name', doc.hashed_name);
      }
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          await supabase.from('user_folders').delete().eq('user_id', supaUser.id).eq('path', folder);
          await supabase.from('user_documents').delete().eq('user_id', supaUser.id).ilike('folder', `${folder}%`);
        }
      } catch (e) { console.error('Supabase folder delete sync error:', e.message); }
    }

    // 3. Delete from SQLite
    for (const doc of docs) {
      db.prepare('DELETE FROM user_documents WHERE id = ?').run(doc.id);
    }
    // Delete the folder and all sub-paths
    db.prepare('DELETE FROM user_folders WHERE user_id = ? AND (path = ? OR path LIKE ?)').run(user.id, folder, folder + '/%');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/my-documents/rename-file', async (req, res) => {
  try {
    const { email, folder, oldName, newName } = req.body;
    if (!email || !folder || !oldName || !newName) return res.status(400).json({ error: 'Missing params' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, oldName);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    const existing = db.prepare('SELECT id FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, newName);
    if (existing) return res.status(409).json({ error: 'Name already exists' });

    db.prepare('UPDATE user_documents SET original_name = ? WHERE id = ?').run(newName, doc.id);

    if (supabase) {
      await supabase.from('user_documents')
        .update({ original_name: newName })
        .eq('hashed_name', doc.hashed_name);
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/my-documents/rename-folder', async (req, res) => {
  try {
    const { email, oldPath, newName } = req.body;
    if (!email || !oldPath || !newName) return res.status(400).json({ error: 'Missing params' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName).replace(/\\/g, '/');

    const folders = db.prepare('SELECT path FROM user_folders WHERE user_id = ? AND path LIKE ?').all(user.id, oldPath + '%');
    folders.forEach(f => {
      const updated = f.path.replace(oldPath, newPath);
      db.prepare('UPDATE user_folders SET path = ? WHERE user_id = ? AND path = ?').run(updated, user.id, f.path);
    });

    const docs = db.prepare('SELECT id, folder, hashed_name FROM user_documents WHERE user_id = ? AND folder LIKE ?').all(user.id, oldPath + '%');
    docs.forEach(doc => {
      const updated = doc.folder.replace(oldPath, newPath);
      db.prepare('UPDATE user_documents SET folder = ? WHERE id = ?').run(updated, doc.id);
      
      if (supabase) {
        supabase.from('user_documents').update({ folder: updated }).eq('hashed_name', doc.hashed_name).then();
      }
    });

    if (supabase) {
      supabase.from('users').select('id').eq('email', email).single().then(({ data: supaUser }) => {
        if (supaUser) {
           supabase.from('user_folders').update({ path: newPath }).eq('user_id', supaUser.id).eq('path', oldPath).then();
        }
      });
    }

    res.json({ success: true, newPath });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Garbage Collection / Cleanup ───
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    // Logic to delete orphaned files or temporary data
    console.log('Cleanup triggered');
    res.json({ success: true, message: 'Cleanup complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Contact HR Email Route ───────────────────────────────────────────────────
app.post('/api/contact-hr', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    console.log(`\n📬 [NEW HR INQUIRY]`);
    console.log(`From: ${name} (${email})`);
    console.log(`Subject: ${subject || 'No Subject'}`);
    console.log(`Message: ${message}`);
    console.log(`-------------------\n`);

    res.json({ success: true, message: 'Inquiry received locally (Resend API removed)' });
  } catch (error) {
    console.error('Failed to process inquiry:', error);
    res.status(500).json({ error: 'Failed to process inquiry' });
  }
});

// ─── Gemini AI Chat Route ─────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is missing. Please provide it in the .env file.' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are the Gantec HR Assistant. 
            STRICT RULES:
            - BE EXTREMELY CONCISE. 
            - NO long introductions like "I'd be happy to help". Just give the answer.
            - Use bullet points for lists.
            - Maximum 2 sentences for general text.
            
            Platform Navigation:
            - Training Resources: Sidebar menu -> Training Resources.
            - Document Locker: Sidebar menu.
            - Company Culture/Certifications/Contact HR: Sidebar menu.
            
            Gantec Facts:
            - Monthly Feedback: Month-end by managers.
            - Weekly Connect: Thursdays 4:00 PM - 4:45 PM IST.
            - HR Manager: Hemalatha Malem.
            
            Question: ${message}`
          }]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429 || (data.error?.message && data.error.message.includes('high demand'))) {
        return res.json({ success: true, reply: "I'm a bit busy right now! Please try asking me again in a few seconds. 🤖" });
      }
      throw new Error(data.error?.message || 'Gemini API Error');
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
    res.json({ success: true, reply: replyText });
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    res.status(500).json({ error: 'AI Assistant is currently unavailable.' });
  }
});

// ─── Document Summarization Route ─────────────────────────────────────────────
app.post('/api/summarize', async (req, res) => {
  const { folder, filename, originalName } = req.body;
  console.log('Summarize request:', { folder, filename, originalName });
  if (!folder || !filename) return res.status(400).json({ error: 'Folder and filename are required' });

  try {
    // Resolve actual disk path: support both public & private docs
    // 1. If caller passes the hashed filename directly, try public uploads/folder/filename
    // 2. Also try to find by original_name in case display name was passed
    let filePath = path.join(UPLOADS_DIR, folder, filename);
    console.log(`🔍 Checking path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      // Try resolving via the public_documents table (caller may have passed original_name)
      try {
        const row = db.prepare(
          'SELECT filename FROM public_documents WHERE folder = ? AND (filename = ? OR original_name = ?)'
        ).get(folder, filename, filename);
        if (row) filePath = path.join(UPLOADS_DIR, folder, row.filename);
      } catch (e) { /* ignore */ }
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(USER_UPLOADS_DIR, filename);
    }

    // If still not found locally, try to download from Supabase storage
    if (!fs.existsSync(filePath) && supabase) {
      try {
        const row = db.prepare(
          'SELECT filename FROM public_documents WHERE folder = ? AND (filename = ? OR original_name = ?)'
        ).get(folder, filename, filename);
        const storageName = row ? row.filename : filename;
        const storagePath = `${folder}/${storageName}`;
        console.log(`⬇️  File not local, fetching from Supabase: ${storagePath}`);
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('resource-uploads')
          .download(storagePath);
        if (dlErr) throw new Error('Supabase download error: ' + dlErr.message);
        const arrayBuffer = await fileData.arrayBuffer();
        const tmpPath = path.join(UPLOADS_DIR, folder, storageName);
        await fs.ensureDir(path.dirname(tmpPath));
        await fs.writeFile(tmpPath, Buffer.from(arrayBuffer));
        filePath = tmpPath;
        console.log(`✅ Downloaded from Supabase to ${tmpPath}`);
      } catch (dlError) {
        console.error('Supabase storage download failed:', dlError.message);
      }
    }

    console.log(`📍 Final filePath: ${filePath} (Exists: ${fs.existsSync(filePath)})`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server. It may have been uploaded to a remote location. Please re-upload the file to enable summarization.' });
    }

    console.log('File found at:', filePath);
    let extractedText = '';
    const nameToUse = originalName || filename;
    const ext = path.extname(nameToUse).toLowerCase();
    console.log('Extension:', ext);

    // Use the decryption helper
    const dataBuffer = await decryptFileToBuffer(filePath);

    // Determine the actual file type — .bin files use originalName to detect format
    const effectiveName = nameToUse.toLowerCase();
    const isPdf  = effectiveName.endsWith('.pdf');
    const isDocx = effectiveName.endsWith('.docx');
    const isTxt  = effectiveName.endsWith('.txt');

    if (isPdf) {
      try {
        if (typeof pdfParse !== 'function') throw new Error('pdf-parse module is not loaded correctly.');
        const data = await pdfParse(dataBuffer);
        extractedText = data.text || '';
        console.log('PDF text length:', extractedText.length);
      } catch (e) {
        console.error('PDF parse error:', e.message);
        extractedText = '';
      }
    } else if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        extractedText = result.value || '';
        console.log('DOCX text length:', extractedText.length);
      } catch (e) {
        console.error('DOCX parse error:', e.message);
        extractedText = '';
      }
    } else if (isTxt || ext === '.txt' || ext === '.bin' || !ext) {
      // Fallback for .bin (encrypted user docs) or plaintext
      extractedText = dataBuffer.toString('utf-8').replace(/[\x00-\x08\x0e-\x1f\x7f-\x9f]/g, '').trim();
      console.log('TXT/BIN text length:', extractedText.length);
    } else {
      return res.status(400).json({ error: `Unsupported file format for summarization: ${ext || 'unknown'}` });
    }

    console.log('Extracted text sample:', extractedText.substring(0, 200));
    // Summarize the full extracted text for complete coverage
    const textToSummarize = extractedText;

    const apiKey = process.env.GEMINI_API_KEY;
    console.log('API Key present:', !!apiKey && apiKey !== 'your_gemini_api_key_here');

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.log('⚠️ GEMINI_API_KEY missing. Providing simulated summary.');

      // Smart simulation — only use meaningful sentences from the extracted text
      const cleanText = extractedText.trim();
      let highlights = '';
      if (cleanText.length > 30) {
        const sentences = cleanText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 400);
        const keyPoints = sentences.slice(0, 5);
        if (keyPoints.length > 0) {
          highlights = keyPoints.map(p => `* ${p}`).join('\n');
        } else {
          highlights = `* ${cleanText.substring(0, 300)}`;
        }
      } else {
        highlights = `* No extractable text found in this document. It may be an image-based PDF or a scanned document. AI summarization requires text-based PDFs.`;
      }

      const displayName = originalName || filename;
      const simulatedSummary = `### 📝 Simulated Summary (Demo Mode)
**Document:** ${displayName}
**Location:** ${folder} folder

**Key Highlights:**
${highlights}

---
*💡 Note: To enable genuine AI analysis, please add a valid **GEMINI_API_KEY** to your .env file.*`;

      return res.json({ success: true, summary: simulatedSummary });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Please provide a professional, complete summary of the following document content.
            Include all key points, main ideas, and important details. Use bullet points where appropriate for clarity.

            Document Content:
            ${textToSummarize}`
            }]
          }]
        })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API Error');
    }

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a summary.";
    res.json({ success: true, summary });

  } catch (err) {
    console.error('Summarization error:', err);
    res.status(500).json({ error: 'Failed to generate summary: ' + err.message });
  }
});

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Gantec Employee Portal running at http://localhost:${PORT}\n`);
  
  // Trigger initial scan to sync local folders with Supabase
  try {
    const folders = await getFoldersRecursive(UPLOADS_DIR, UPLOADS_DIR);
    console.log(`✅ Startup Sync Complete: Found ${folders.length} folders.`);
  } catch (err) {
    console.error('⚠️ Startup Sync Failed:', err.message);
  }
});
