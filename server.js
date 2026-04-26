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
} else {
  console.log('Supabase credentials not found — running in SQLite mode');
}

// Initialize SQLite database
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    points INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS user_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, path)
  );

  CREATE TABLE IF NOT EXISTS user_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    hashed_name TEXT NOT NULL,
    folder TEXT NOT NULL,
    size INTEGER NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Ensure columns exist (for existing databases)
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'employee'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0"); } catch (e) {}

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

    // Insert new user
    const stmtInsert = db.prepare('INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)');
    stmtInsert.run(fullname, email, hashedPassword);

    res.json({ success: true, user: { fullname, email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sign up failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ success: true, user: { fullname: user.fullname, email: user.email } });
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

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
 
    res.json({ success: true, user: { fullname: user.fullname, email: user.email, points: user.points || 0 } });
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
    // Keep original name but avoid collisions
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_');
    cb(null, `${base}${ext}`);
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
              docFiles.push({
                name: entry.name,
                id: Buffer.from(path.join(relPath, entry.name)).toString('base64'),
                size: stat.size,
                uploadedAt: stat.mtime
              });
            } catch (e) {
              /* ignore individual file errors */
            }
          }
        }
        folders.push({ name: relPath, files: docFiles });
        console.log(`  Found folder: ${relPath} with ${docFiles.length} files`);
      }

      // Add subdirectories to queue
      for (const entry of entries) {
        if (entry.isDirectory()) {
          queue.push(path.join(currentDir, entry.name));
        }
      }
    }
    console.log(`Scan complete. Found ${folders.length} folders.`);
    return folders;
  } catch (err) {
    console.error(`Fatal error during scan:`, err.message);
    return [];
  }
}

// GET /api/folders – Return folder tree with files
app.get('/api/folders', async (req, res) => {
  try {
    await fs.ensureDir(UPLOADS_DIR);
    const folders = await getFoldersRecursive(UPLOADS_DIR, UPLOADS_DIR);
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders – Create a new folder
app.post('/api/folders', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });

    // Allow forward/back slashes to build nested directories
    const safe = name.trim().replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_');
    const folderPath = path.join(UPLOADS_DIR, safe);

    if (await fs.pathExists(folderPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }

    await fs.ensureDir(folderPath);
    res.json({ success: true, name: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload – Upload a PDF
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
      success: true,
      filename: req.file.filename,
      folder: req.body.folder || 'General',
      size: req.file.size
    });

    // Award points if email is provided
    if (req.body.email) {
      db.prepare('UPDATE users SET points = points + 10 WHERE email = ?').run(req.body.email);
    }
  });
});

// GET /api/leaderboard – Return real users sorted by points
app.get('/api/leaderboard', (req, res) => {
  try {
    const users = db.prepare('SELECT fullname as name, email, points FROM users ORDER BY points DESC, fullname ASC').all();
    
    // Map stars based on rank
    const leaderboard = users.map((u, index) => {
      let stars = 1;
      const rank = index + 1;
      if (rank <= 3) stars = 3;
      else if (rank <= 7) stars = 2;
      
      return {
        ...u,
        stars
      };
    });

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/view-resource – Award points for viewing
app.post('/api/view-resource', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    db.prepare('UPDATE users SET points = points + 1 WHERE email = ?').run(email);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file?folder=...&file=... – Serve PDF inline
app.get('/api/file', async (req, res) => {
  try {
    const { folder, file } = req.query;
    if (!folder || !file) return res.status(400).json({ error: 'Missing folder or file param' });

    const filePath = path.join(UPLOADS_DIR, folder, file);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/file?folder=...&file=... – Delete a file
app.delete('/api/file', async (req, res) => {
  try {
    const { folder, file } = req.query;
    if (!folder || !file) return res.status(400).json({ error: 'Missing folder or file param' });

    const filePath = path.join(UPLOADS_DIR, folder, file);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    await fs.remove(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/delete-folder', async (req, res) => {
  try {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'Folder path required' });

    // Security check: Don't allow deleting the root
    if (folder === '.' || folder === './' || folder === '') {
      return res.status(403).json({ error: 'Cannot delete the root directory' });
    }

    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!await fs.pathExists(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await fs.remove(folderPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/rename-file', async (req, res) => {
  try {
    const { folder, oldName, newName } = req.body;
    if (!folder || !oldName || !newName) return res.status(400).json({ error: 'All parameters required' });

    const oldPath = path.join(UPLOADS_DIR, folder, oldName);
    const newPath = path.join(UPLOADS_DIR, folder, newName);

    if (!await fs.pathExists(oldPath)) return res.status(404).json({ error: 'File not found' });
    if (await fs.pathExists(newPath)) return res.status(409).json({ error: 'Name already exists' });

    await fs.move(oldPath, newPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/rename-folder', async (req, res) => {
  try {
    const { oldPath: oldRelPath, newName } = req.body;
    if (!oldRelPath || !newName) return res.status(400).json({ error: 'All parameters required' });

    // Security check: Don't allow renaming root
    if (oldRelPath === '.' || oldRelPath === './' || oldRelPath === '') {
      return res.status(403).json({ error: 'Cannot rename the root directory' });
    }

    const parentDir = path.dirname(oldRelPath);
    const newRelPath = path.join(parentDir, newName).replace(/\\/g, '/');

    const fullOldPath = path.join(UPLOADS_DIR, oldRelPath);
    const fullNewPath = path.join(UPLOADS_DIR, newRelPath);

    if (!await fs.pathExists(fullOldPath)) return res.status(404).json({ error: 'Folder not found' });
    if (await fs.pathExists(fullNewPath)) return res.status(409).json({ error: 'Folder name already exists' });

    await fs.move(fullOldPath, fullNewPath);
    res.json({ success: true, newPath: newRelPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER DOCUMENTS API ────────────────────────────────────────────────────────

const USER_UPLOADS_DIR = path.join(__dirname, 'user_uploads');
fs.ensureDirSync(USER_UPLOADS_DIR);

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

app.get('/api/my-documents/folders', (req, res) => {
  try {
    const { email } = req.query;
    console.log('Incoming folder request for:', email);
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = getUserByEmail(email);
    if (!user) {
      console.warn('User not found in DB:', email);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get folders
    const foldersStmt = db.prepare('SELECT path FROM user_folders WHERE user_id = ?');
    let userFolders = foldersStmt.all(user.id).map(f => f.path);

    // No default folders created anymore

    // Get documents
    const docsStmt = db.prepare('SELECT original_name, hashed_name, folder, size, upload_date FROM user_documents WHERE user_id = ?');
    const userDocs = docsStmt.all(user.id);

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

app.post('/api/my-documents/folders', (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const safe = name.trim().replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_');
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

app.post('/api/my-documents/upload', uploadUserDoc.single('file'), (req, res) => {
  try {
    const { email, folder } = req.body;
    if (!email) {
      if (req.file) fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'Email required' });
    }
    const user = getUserByEmail(email);
    if (!user) {
      if (req.file) fs.removeSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const targetFolder = folder || 'General';
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
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT hashed_name FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, file);
    if (!doc) return res.status(404).json({ error: 'File not found in DB' });

    const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'File missing on disk' });

    // Serve inline so browser can preview rather than forcing download
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file)}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/my-documents/file', async (req, res) => {
  try {
    const { email, folder, file } = req.query;
    if (!email || !folder || !file) return res.status(400).json({ error: 'Missing params' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, file);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    db.prepare('DELETE FROM user_documents WHERE id = ?').run(doc.id);

    const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/my-documents/folder', async (req, res) => {
  try {
    const { email, folder } = req.body;
    if (!email || !folder) return res.status(400).json({ error: 'Missing params' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const docs = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND folder LIKE ?').all(user.id, folder + '%');
    for (const doc of docs) {
      db.prepare('DELETE FROM user_documents WHERE id = ?').run(doc.id);
      const filePath = path.join(USER_UPLOADS_DIR, doc.hashed_name);
      if (await fs.pathExists(filePath)) await fs.remove(filePath);
    }

    db.prepare('DELETE FROM user_folders WHERE user_id = ? AND path LIKE ?').run(user.id, folder + '%');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/my-documents/rename-file', async (req, res) => {
  try {
    const { email, folder, oldName, newName } = req.body;
    if (!email || !folder || !oldName || !newName) return res.status(400).json({ error: 'Missing params' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = db.prepare('SELECT id FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, oldName);
    if (!doc) return res.status(404).json({ error: 'File not found' });

    const existing = db.prepare('SELECT id FROM user_documents WHERE user_id = ? AND folder = ? AND original_name = ?').get(user.id, folder, newName);
    if (existing) return res.status(409).json({ error: 'Name already exists' });

    db.prepare('UPDATE user_documents SET original_name = ? WHERE id = ?').run(newName, doc.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/my-documents/rename-folder', async (req, res) => {
  try {
    const { email, oldPath, newName } = req.body;
    if (!email || !oldPath || !newName) return res.status(400).json({ error: 'Missing params' });
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName).replace(/\\/g, '/');

    const folders = db.prepare('SELECT path FROM user_folders WHERE user_id = ? AND path LIKE ?').all(user.id, oldPath + '%');
    folders.forEach(f => {
      const updated = f.path.replace(oldPath, newPath);
      db.prepare('UPDATE user_folders SET path = ? WHERE user_id = ? AND path = ?').run(updated, user.id, f.path);
    });

    const docs = db.prepare('SELECT id, folder FROM user_documents WHERE user_id = ? AND folder LIKE ?').all(user.id, oldPath + '%');
    docs.forEach(doc => {
      const updated = doc.folder.replace(oldPath, newPath);
      db.prepare('UPDATE user_documents SET folder = ? WHERE id = ?').run(updated, doc.id);
    });

    res.json({ success: true, newPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Resource Links (YouTube etc) ───
app.post('/api/resources/links', async (req, res) => {
  try {
    const { title, url, folder } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
    
    // In a real Supabase implementation, this would go to the resource_links table
    console.log(`[LINK ADDED] ${title}: ${url} in ${folder}`);
    res.json({ success: true, message: 'Link added successfully' });
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

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Gantec Employee Portal running at http://localhost:${PORT}\n`);
});
