const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Security middleware
const { authMiddleware, optionalAuth, adminOnly, generateToken } = require('./middleware/auth');
const { authLimiter, apiLimiter, uploadLimiter, chatLimiter } = require('./middleware/rateLimiter');
const { securityHeaders, escapeHtml } = require('./middleware/security');
const { sanitizePath, isPathSafe, sanitizeEmail, isValidEmail, sanitizeText, validateRequired } = require('./utils/validation');

// Helper to dynamically read variables from .env to avoid requiring a server restart
function getDynamicEnv(key, defaultValue) {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const parts = trimmed.split('=');
          const currentKey = parts[0].trim();
          if (currentKey === key) {
            const val = parts.slice(1).join('=').trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              return val.slice(1, -1);
            }
            return val;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading dynamic .env:', err);
  }
  return process.env[key] || defaultValue;
}
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure SMTP Transporter for silent background emails
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
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
    points REAL DEFAULT 0,
    profile_image TEXT
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

  CREATE TABLE IF NOT EXISTS weekly_sessions (
    id INTEGER PRIMARY KEY,
    week TEXT NOT NULL,
    name TEXT NOT NULL,
    topic TEXT NOT NULL,
    link TEXT DEFAULT '#',
    filename TEXT DEFAULT '',
    updates TEXT DEFAULT '',
    fun TEXT NOT NULL,
    winners TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS certificate_leaders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_name TEXT NOT NULL,
    expiry_date TEXT,
    certificate_owner TEXT,
    provider TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leave_balances (
    user_email TEXT PRIMARY KEY,
    pto DECIMAL DEFAULT 12.5,
    sick DECIMAL DEFAULT 4.5,
    floating INTEGER DEFAULT 3,
    celebration INTEGER DEFAULT 1,
    power_apps_link TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_emails (
    email TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS hr_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS main_sub_mails (
    id TEXT PRIMARY KEY,
    main_email TEXT NOT NULL,
    sub_email TEXT NOT NULL,
    period TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS manager_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_email TEXT NOT NULL,
    reportee_email TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_posts (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    image_url TEXT,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES social_posts(id)
  );

  CREATE TABLE IF NOT EXISTS social_likes (
    post_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(post_id, user_email),
    FOREIGN KEY(post_id) REFERENCES social_posts(id)
  );

  CREATE TABLE IF NOT EXISTS weekly_connect_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_stories (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    image_url TEXT,
    story_text TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS monthly_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL,
    period TEXT NOT NULL,
    selections TEXT,
    remarks TEXT,
    is_submitted INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, role, period)
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
        points REAL DEFAULT 0,
        profile_image TEXT
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
try { db.exec("ALTER TABLE users ADD COLUMN profile_image TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE public_documents ADD COLUMN original_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE main_sub_mails ADD COLUMN period TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE manager_notifications ADD COLUMN type TEXT DEFAULT 'assign_reportee'"); } catch (e) {}
// Fix old NULL-type notifications: assign them 'assign_reportee' if they don't match social patterns
try { db.exec("UPDATE manager_notifications SET type = 'assign_reportee' WHERE type IS NULL"); } catch (e) {}
// Back‑fill existing rows where original_name is null
try { db.exec("UPDATE public_documents SET original_name = filename WHERE original_name IS NULL"); } catch (e) {}
// Clean up duplicate social posts (keep the first one, delete the rest)
try {
  const dupes = db.prepare(`
    SELECT user_email, caption, created_at, COUNT(*) as cnt
    FROM social_posts
    GROUP BY user_email, caption, created_at
    HAVING cnt > 1
  `).all();
  for (const dupe of dupes) {
    const ids = db.prepare(`
      SELECT id FROM social_posts
      WHERE LOWER(user_email) = LOWER(?) AND caption = ? AND created_at = ?
      ORDER BY rowid ASC
    `).all(dupe.user_email, dupe.caption, dupe.created_at);
    // Keep the first, delete the rest
    for (let i = 1; i < ids.length; i++) {
      db.prepare('DELETE FROM social_comments WHERE post_id = ?').run(ids[i].id);
      db.prepare('DELETE FROM social_likes WHERE post_id = ?').run(ids[i].id);
      db.prepare('DELETE FROM social_posts WHERE id = ?').run(ids[i].id);
    }
  }
  if (dupes.length > 0) console.log(`✅ Cleaned up ${dupes.length} duplicate post groups.`);
} catch (e) { console.warn('Duplicate post cleanup skipped:', e.message); }
// Clean up duplicate user accounts (same email, different case) — keep the first, delete the rest
try {
  db.pragma('foreign_keys = OFF');
  const dupeEmails = db.prepare(`SELECT LOWER(email) as em, COUNT(*) as cnt FROM users GROUP BY LOWER(email) HAVING cnt > 1`).all();
  for (const d of dupeEmails) {
    const rows = db.prepare('SELECT id, email FROM users WHERE LOWER(email) = ? ORDER BY rowid ASC').all(d.em);
    const keepId = rows[0].id;
    for (let i = 1; i < rows.length; i++) {
      // Reassign orphaned documents/folders before deleting
      db.prepare('UPDATE user_documents SET user_id = ? WHERE user_id = ?').run(keepId, rows[i].id);
      db.prepare('UPDATE user_folders SET user_id = ? WHERE user_id = ?').run(keepId, rows[i].id);
      db.prepare('DELETE FROM users WHERE id = ?').run(rows[i].id);
    }
  }
  db.pragma('foreign_keys = ON');
  if (dupeEmails.length > 0) console.log(`✅ Cleaned up ${dupeEmails.length} duplicate user email groups.`);
} catch (e) { console.warn('Duplicate user cleanup skipped:', e.message); }

// Robust mention/tag parser supporting @username and @email, checking DB user existence
function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g) || [];
  const emails = [];
  matches.forEach(m => {
    const raw = m.slice(1); // strip leading @
    let email;
    if (raw.includes('@')) {
      email = raw.toLowerCase().trim();
    } else {
      email = `${raw}@gantecusa.com`.toLowerCase().trim();
    }
    try {
      const user = db.prepare('SELECT email FROM users WHERE LOWER(email) = ?').get(email);
      if (user) {
        emails.push(user.email.toLowerCase());
      }
    } catch (dbErr) {
      console.warn('DB check failed in extractMentions:', dbErr.message);
      emails.push(email);
    }
  });
  return [...new Set(emails)];
}

// ─── Certifications Table Migration ───────────────────────────────────────────
// If certifications table has old schema (name, category), migrate to new schema
try {
  const certCols = db.prepare("PRAGMA table_info(certifications)").all().map(c => c.name);
  if (certCols.includes('name') && !certCols.includes('certificate_name')) {
    console.log('⚠️ Migrating certifications table to new schema...');
    db.exec(`
      ALTER TABLE certifications RENAME TO certifications_old;
      CREATE TABLE certifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificate_name TEXT NOT NULL,
        expiry_date TEXT,
        certificate_owner TEXT,
        provider TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO certifications (id, certificate_name, created_at)
      SELECT id, name, created_at FROM certifications_old;
      DROP TABLE certifications_old;
    `);
    console.log('✅ Certifications table migrated.');
  }
} catch (e) {
  console.warn('⚠️ Certifications migration skipped or failed:', e.message);
}

// ─── Weekly Connect Members Table Seeding ─────────────────────────────────────
try {
  const count = db.prepare('SELECT COUNT(*) as count FROM weekly_connect_members').get().count;
  if (count === 0) {
    console.log('🌱 Seeding initial weekly connect members into SQLite...');
    const initialMembers = [
      { name: "Gnana Sree", team: "VibeTribe", email: "gnana.sree@gantec.com" },
      { name: "Vikram Raj", team: "CtrlAltDefeat", email: "vikram.raj@gantec.com" },
      { name: "Anita Sharma", team: "Titans", email: "anita.s@gantec.com" },
      { name: "Rahul Singh", team: "CtrlAltDefeat", email: "rahul.s@gantec.com" }
    ];
    const insert = db.prepare('INSERT INTO weekly_connect_members (name, team, email) VALUES (?, ?, ?)');
    for (const m of initialMembers) {
      insert.run(m.name, m.team, m.email);
    }
    console.log('✅ Seeded initial weekly connect members.');
  }
} catch (e) {
  console.warn('⚠️ Weekly connect members check/seeding failed or skipped:', e.message);
}

// ─── Admin Configuration & Sync ──────────────────────────────────────────────
const ADMIN_CONFIG_PATH = path.join(__dirname, 'config', 'admins.json');

async function getAdminEmails() {
  let adminEmails = new Set();
  
  // ONLY source of truth: config/admins.json
  try {
    if (fs.existsSync(ADMIN_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf-8'));
      if (config.admins && Array.isArray(config.admins)) {
        config.admins.forEach(email => adminEmails.add(email.toLowerCase().trim()));
      }
    }
  } catch (err) {
    console.error('Error reading admin config file:', err.message);
  }

  return Array.from(adminEmails);
}

async function syncAdminEmails() {
  console.log('🔄 Syncing admin emails...');
  const emails = await getAdminEmails();
  
  // Clear and Update Local SQLite Cache
  db.prepare('DELETE FROM admin_emails').run();
  const insertStmt = db.prepare('INSERT INTO admin_emails (email) VALUES (?)');
  const transaction = db.transaction((list) => {
    for (const email of list) insertStmt.run(email);
  });
  transaction(emails);

  // Update Supabase
  if (supabase) {
    try {
      // Attempt to upsert admin emails; if the table does not exist in Supabase, this will fail silently
      const payload = emails.map(email => ({ email }));
      const { error } = await supabase.from('admin_emails').upsert(payload, { onConflict: 'email' });
      if (error) {
        console.debug('Supabase admin sync skipped (table may not exist):', error.message);
      } else {
        console.log('✅ Supabase admin emails synced.');
      }
    } catch (err) {
      console.warn('Supabase admin sync failed (might need table creation):', err.message);
    }
  }
}

// Helper to check if email is admin (ALWAYS reads fresh from admins.json)
async function checkIsAdmin(email) {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  const admins = await getAdminEmails();
  return admins.includes(normalizedEmail);
}

// ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');

// ─── Auth API ───────────────────────────────────────────────────────────────

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    if (!email || !isValidEmail(email) || !email.toLowerCase().endsWith('@gantecusa.com')) {
      return res.status(400).json({ error: 'Email must be a valid official @gantecusa.com address.' });
    }

    if (!fullname || !fullname.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if user already exists (SQLite)
    const existingLocal = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existingLocal) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId = uuidv4();
    const isAdmin = await checkIsAdmin(email);
    const signupRole = isAdmin ? 'admin' : 'employee';

    // 1. Create in Supabase Auth if enabled (to get the definitive UUID)
    if (supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { fullname: fullname.trim() }
        });

        if (authData && authData.user) {
          userId = authData.user.id;
        } else if (authError && (authError.message.includes('already exists') || authError.status === 422)) {
          // If already in Auth, try to find existing profile ID to keep them in sync
          const { data: existingProf } = await supabase.from('users').select('id').ilike('email', email).single();
          if (existingProf) userId = existingProf.id;
        } else if (authError) {
          console.error('Supabase Auth error during signup:', authError.message);
          // We continue anyway and try to create locally
        }
      } catch (err) {
        console.warn('Supabase Auth sync skipped:', err.message);
      }
    }

    // 2. ALWAYS insert into local SQLite
    try {
      db.prepare('INSERT INTO users (id, fullname, email, password, role, points, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, fullname.trim(), email.toLowerCase(), hashedPassword, signupRole, 0, null);
      console.log('✅ User created in local SQLite:', email);
    } catch (sqlErr) {
      console.error('❌ SQLite Signup Error:', sqlErr.message);
      return res.status(500).json({ error: 'Failed to create local account: ' + sqlErr.message });
    }

    // 3. Final background sync to Supabase public.users
    if (supabase) {
      supabase.from('users').upsert({
        id: userId,
        fullname: fullname.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role: signupRole,
        points: 0
      }).then(({ error }) => {
        if (error) console.error('⚠️ Supabase background sync failed:', error.message);
        else console.log('✅ Supabase background sync successful for:', email);
      });
    }

    const token = generateToken({ email: email.toLowerCase(), role: signupRole, userId: userId });
    res.json({ success: true, token, user: { fullname: fullname.trim(), email: email.toLowerCase(), role: signupRole } });
  } catch (err) {
    console.error('Signup crash:', err);
    res.status(500).json({ error: 'Sign up failed' });
  }
});



app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = req.body.email ? sanitizeEmail(req.body.email) : '';
    const password = req.body.password;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    let user = null;
    let localUser = null;
    let supaUser = null;

    // 1. Check Local SQLite (most reliable for legacy)
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
      localUser = stmt.get(email);
    } catch (e) { console.error('Local DB search failed:', e); }

    // 2. Check Supabase DB
    if (supabase) {
      const { data } = await supabase.from('users').select('*').ilike('email', email);
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
      console.log(`Email ${email} not found in DBs. Attempting direct Supabase Auth fallback...`);
      
      if (supabase) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (authData && authData.user) {
            console.log(`✅ Direct Auth Success for ${email}. Auto-creating missing database profile...`);
            const isAdmin = await checkIsAdmin(email);
            const signupRole = isAdmin ? 'admin' : 'employee';
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Auto-heal: Create in both DBs
            const newUserId = authData.user.id;
            const fullname = authData.user.user_metadata?.fullname || email.split('@')[0];
            
            db.prepare('INSERT OR IGNORE INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)')
              .run(newUserId, fullname, email, hashedPassword, signupRole, 0);
            
            await supabase.from('users').upsert({
              id: newUserId,
              fullname: fullname,
              email: email,
              password: hashedPassword,
              role: signupRole,
              points: 0
            });

            // Set the 'user' variable so the rest of the logic continues normally
            user = { id: newUserId, fullname, email, role: signupRole, password: hashedPassword };
          } else {
            console.warn(`Direct Auth fallback failed for ${email}:`, authError?.message);
            return res.status(401).json({ error: 'Account does not exist' });
          }
        } catch (err) {
          console.error(`Direct Auth crash for ${email}:`, err.message);
          return res.status(401).json({ error: 'Account does not exist' });
        }
      } else {
        return res.status(401).json({ error: 'Account does not exist' });
      }
    }

    // Now we have a 'user' (either from DB or from Auth Fallback)
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // --- AUTO-MIGRATION LOGIC ---
    if (supabase) {
      try {
        // Instead of listing, try to create — if they exist, it will throw an error we can catch
        const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
          email: email,
          password: password, 
          email_confirm: true,
          user_metadata: { fullname: user.fullname }
        });

        let supaId = null;
        if (newAuth && newAuth.user) {
          supaId = newAuth.user.id;
          console.log('Migrated legacy user to Supabase Auth:', email);
        } else if (createErr && (createErr.message.includes('already exists') || createErr.status === 422)) {
          // They already exist in Auth, we need their ID to ensure public.users is synced
          // Note: we can't easily get the ID from admin without listing, but we can search in public.users
          const { data: profile } = await supabase.from('users').select('id').ilike('email', email).single();
          if (profile) supaId = profile.id;
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

    const isAdmin = await checkIsAdmin(email);
    const finalRole = isAdmin ? 'admin' : 'employee';

    // Sync role in databases (Automatic Grant/Revoke)
    if (user.role !== finalRole) {
      console.log(`Role change for ${email}: ${user.role} -> ${finalRole}`);
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(finalRole, user.id);
      if (supabase) {
        await supabase.from('users').update({ role: finalRole }).eq('id', user.id);
      }
    }

    const token = generateToken({ email: user.email, role: finalRole, userId: user.id });
    res.json({ success: true, token, user: { fullname: user.fullname, email: user.email, role: finalRole } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});


// GET /api/auth/profile – Get current user profile
app.get('/api/auth/profile', optionalAuth, async (req, res) => {
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
      
      if (data) {
        user = data;
        // Auto-heal: If user in Supabase but not in local SQLite, sync them
        const localCheck = db.prepare('SELECT id, profile_image FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (!localCheck) {
          console.log(`Auto-healing: Syncing Supabase user ${email} to local SQLite`);
          db.prepare('INSERT INTO users (id, fullname, email, password, role, points, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(user.id, user.fullname, user.email, user.password || '', user.role || 'employee', user.points || 0, user.profile_image || null);
        } else if (localCheck.profile_image) {
          user.profile_image = localCheck.profile_image;
        }
      }
    }

    if (!user) {
      const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
      user = stmt.get(email);
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    const isAdmin = await checkIsAdmin(user.email);
    const finalRole = isAdmin ? 'admin' : 'employee';

    // Always sync role to DB so removal from admins.json takes effect immediately
    if (user.role !== finalRole) {
      db.prepare('UPDATE users SET role = ? WHERE LOWER(email) = LOWER(?)').run(finalRole, user.email);
      if (supabase) {
        supabase.from('users').update({ role: finalRole }).ilike('email', user.email).then(() => {});
      }
    }

    res.json({ success: true, user: { 
      fullname: user.fullname, 
      email: user.email, 
      points: user.points || 0, 
      role: finalRole,
      profile_image: user.profile_image 
    } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// GET /api/users/profile-image – Fetch any user's profile image dynamically
app.get('/api/users/profile-image', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email query parameter is required.' });

    // 1. Check local SQLite
    const userLocal = db.prepare('SELECT profile_image FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (userLocal && userLocal.profile_image) {
      return res.json({ profile_image: userLocal.profile_image });
    }

    // 2. Check Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('profile_image')
          .eq('email', email.toLowerCase().trim())
          .single();
        if (!error && data && data.profile_image) {
          return res.json({ profile_image: data.profile_image });
        }
      } catch (sbErr) {
        console.warn('Supabase profile image fetch error:', sbErr.message);
      }
    }

    res.json({ profile_image: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hr/config – Fetch dynamic HR configuration
app.get('/api/hr/config', (req, res) => {
  res.json({
    hr_email: getDynamicEnv('HR_EMAIL', 'hemalatha.malem@gantecusa.com')
  });
});

// GET /api/support/config – Fetch dynamic Support configuration
app.get('/api/support/config', (req, res) => {
  res.json({
    support_email: getDynamicEnv('SUPPORT_EMAIL', 'gnanasree.ponnuru@gantecusa.com')
  });
});

// GET /api/config/supabase – Public config for client SDK (anon key only)
app.get('/api/config/supabase', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});


// PUT /api/auth/profile – Update user profile
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { currentEmail, fullname, email, currentPassword, newPassword, profile_image } = req.body;
    console.log(`Profile update request for: ${currentEmail}`);

    if (!currentEmail) return res.status(400).json({ error: 'Current email required' });

    let stmtUser = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
    let user = stmtUser.get(currentEmail);

    // If not in local SQLite, check Supabase
    if (!user && supabase) {
      console.log(`User ${currentEmail} not in SQLite, checking Supabase...`);
      const { data } = await supabase.from('users').select('*').eq('email', currentEmail).single();
      if (data) {
        user = data;
        // Sync to SQLite for future use
        console.log(`Syncing user ${currentEmail} from Supabase to SQLite`);
        db.prepare('INSERT INTO users (id, fullname, email, password, role, points, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(user.id, user.fullname, user.email, user.password || '', user.role || 'employee', user.points || 0, user.profile_image || null);
      }
    }

    if (!user) {
      console.error(`User update failed: ${currentEmail} not found in SQLite or Supabase`);
      return res.status(404).json({ error: 'User not found. Please log out and log in again to sync your account.' });
    }

    const isEmailChanged = email && email !== currentEmail;
    
    // Validate new email if provided
    if (isEmailChanged) {
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
    if (currentPassword && (newPassword || isEmailChanged)) {
      console.log(`Verifying password for ${currentEmail}...`);
      
      let isMatch = false;
      
      // 1. Try local bcrypt comparison if password exists
      if (user.password && user.password.length > 10) { // Hashed passwords are long
        try {
          isMatch = await bcrypt.compare(currentPassword, user.password);
        } catch (e) {
          console.log(`Bcrypt comparison failed for ${currentEmail}`);
        }
      }

      // 2. Fallback: Verify against Supabase Auth directly
      // This handles cases where the local DB has a NULL/stale password
      if (!isMatch && supabase) {
        console.log(`Local check failed, verifying against Supabase Auth for ${currentEmail}...`);
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: currentEmail,
            password: currentPassword
          });
          
          if (authData && authData.user) {
            console.log(`Supabase Auth verification successful for ${currentEmail}`);
            isMatch = true;
            // Sign out immediately so we don't keep the session on the server
            await supabase.auth.signOut();
          } else {
            console.log(`Supabase Auth verification failed: ${authError ? authError.message : 'Unknown error'}`);
          }
        } catch (supaErr) {
          console.error(`Supabase Auth verification error:`, supaErr.message);
        }
      }

      if (!isMatch) {
        console.log(`Final password mismatch for ${currentEmail}.`);
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // If changing password or email without providing current password, skip the change
    if ((newPassword || isEmailChanged) && !currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change email or password' });
    }

    // Check if new email is already taken by another user
    if (isEmailChanged) {
      const existingEmail = stmtUser.get(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user data
    let newFullname = fullname || user.fullname;
    let newEmailToSet = email || user.email;
    let newProfileImage = profile_image !== undefined ? profile_image : user.profile_image;
    let newPasswordHashed = user.password;


    if (newPassword) {
      newPasswordHashed = await bcrypt.hash(newPassword, 10);
    }

    const stmtUpdate = db.prepare('UPDATE users SET fullname = ?, email = ?, password = ?, profile_image = ? WHERE id = ?');
    stmtUpdate.run(newFullname, newEmailToSet, newPasswordHashed, newProfileImage, user.id);

    // Sync to Supabase if enabled
    if (supabase) {
      try {
        const updatePayload = {
          fullname: newFullname,
          email: newEmailToSet,
          password: newPasswordHashed
        };
        
        await supabase.from('users').update(updatePayload).eq('id', user.id);
        
        // Also update Supabase Auth email/password/metadata if changed
        let authUpdate = {};
        if (email && email !== currentEmail) authUpdate.email = email;
        if (newPassword) authUpdate.password = newPassword;
        if (fullname && fullname !== user.fullname) authUpdate.user_metadata = { fullname: newFullname };
        
        if (Object.keys(authUpdate).length > 0) {
          await supabase.auth.admin.updateUserById(user.id, authUpdate);
        }
      } catch (supaErr) {
        console.error('Supabase profile sync failed:', supaErr.message);
      }
    }

    console.log(`Profile updated successfully for: ${currentEmail}`);
    res.json({ success: true, user: { fullname: newFullname, email: newEmailToSet, profile_image: newProfileImage } });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
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


// Allowed file extensions for uploads
const ALLOWED_EXTENSIONS = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv','.png','.jpg','.jpeg','.gif','.webp','.svg','.mp4','.mp3','.webm','.json','.xml','.html','.htm','.ytlink','.md','.rtf']);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' is not allowed.`));
    }
  }
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
              // Check if link already exists before inserting to prevent duplicates
              const { data: existingLink } = await supabase.from('resource_links')
                .select('id').eq('folder', f.name).eq('title', linkData.title).maybeSingle();
              if (!existingLink) {
                await supabase.from('resource_links').insert([{
                  title: linkData.title,
                  url: linkData.url,
                  folder: f.name,
                  uploaded_by: file.uploader_email || 'anonymous@gantec.com'
                }]);
              }
            } catch (e) { /* skip bad links */ }
          } else {
            // Check if file already exists before inserting to prevent duplicates
            const { data: existingFile } = await supabase.from('resource_uploads')
              .select('id').eq('folder', f.name).eq('filename', file.hashedName).maybeSingle();
            if (!existingFile) {
              await supabase.from('resource_uploads').insert([{
                filename: file.hashedName,
                folder: f.name,
                uploaded_by: file.uploader_email || 'anonymous@gantec.com'
              }]);
            }
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
        
        const isYt = row.filename.toLowerCase().endsWith('.ytlink');
        let displayName = row.original_name || row.filename;
        if (isYt) displayName = displayName.replace(/\.ytlink$/i, '');
        
        foldersMap[row.folder].files.push({ 
          name: displayName, 
          path: row.filename, 
          type: isYt ? 'link' : 'file', 
          hashedName: row.filename,
          uploader_email: row.uploader_email
        });
      });
    } catch (e) { console.warn('⚠️ Local document fetch error:', e.message); }

    // 2. Merge with Supabase Data (if available)
    if (supabase) {
      try {
        const { data: dbFoldersList } = await supabase.from('resource_folders').select('name');
        // Select only existing columns: folder, filename, uploaded_by (ignore original_name if it fails)
        const { data: dbFiles, error: fileErr } = await supabase.from('resource_uploads').select('folder, filename, uploaded_by');
        const { data: dbLinks } = await supabase.from('resource_links').select('folder, title, url, uploaded_by');
        
        if (fileErr) console.warn('⚠️ Supabase file fetch error:', fileErr.message);

        (dbFoldersList || []).forEach(f => { 
          if (!foldersMap[f.name]) foldersMap[f.name] = { name: f.name, files: [], subfolders: [] }; 
        });

        (dbFiles || []).forEach(row => {
          if (!foldersMap[row.folder]) foldersMap[row.folder] = { name: row.folder, files: [], subfolders: [] };
          
          // SYNC: Ensure this file is in our local SQLite for later retrieval/decryption
          try {
            const exists = db.prepare('SELECT id FROM public_documents WHERE folder = ? AND filename = ?').get(row.folder, row.filename);
            if (!exists) {
              console.log(`📡 Syncing missing Supabase file record: ${row.filename}`);
              // Use filename as original_name since we don't have that column in Supabase yet
              db.prepare('INSERT INTO public_documents (folder, filename, original_name, uploader_email) VALUES (?, ?, ?, ?)')
                .run(row.folder, row.filename, row.filename, row.uploaded_by);
            }
          } catch (syncErr) { /* ignore sync errors */ }

          if (!foldersMap[row.folder].files.some(f => f.hashedName === row.filename)) {
            foldersMap[row.folder].files.push({ 
              name: row.filename, 
              path: row.filename, 
              type: 'file', 
              hashedName: row.filename,
              uploader_email: row.uploaded_by
            });
          }
        });

        (dbLinks || []).forEach(row => {
          if (!foldersMap[row.folder]) foldersMap[row.folder] = { name: row.folder, files: [], subfolders: [] };
          
          const safeTitle = row.title.replace(/[^a-zA-Z0-9_\- ]/g, '_');
          const filename = `${safeTitle}.ytlink`;
          
          // SYNC: Ensure this link is in our local SQLite
          try {
            const exists = db.prepare('SELECT id FROM public_documents WHERE folder = ? AND filename = ?').get(row.folder, filename);
            if (!exists) {
              console.log(`📡 Syncing missing Supabase link record: ${filename}`);
              db.prepare('INSERT INTO public_documents (folder, filename, original_name, uploader_email) VALUES (?, ?, ?, ?)')
                .run(row.folder, filename, row.title, row.uploaded_by);
            }
          } catch (syncErr) { /* ignore sync errors */ }

          const normalize = s => (s || '').toLowerCase().replace(/_/g, ' ').trim();
          const alreadyExists = foldersMap[row.folder].files.some(f => 
            normalize(f.name) === normalize(row.title) && f.type === 'link'
          );

          if (!alreadyExists) {
            foldersMap[row.folder].files.push({ 
              name: row.title, 
              url: row.url, 
              type: 'link', 
              hashedName: filename,
              path: filename,
              uploader_email: row.uploaded_by 
            });
          }
        });
      } catch (e) { console.error('Supabase global sync error:', e.message); }
    }

    // 3. If everything is empty, fallback to a disk scan
    if (Object.keys(foldersMap).length === 0) {
      await fs.ensureDir(UPLOADS_DIR);
      const folders = await getFoldersRecursive(UPLOADS_DIR, UPLOADS_DIR);
      return res.json({ folders: folders.filter(f => f.name !== 'Weekly Connect') });
    }
    
    // Exclude 'Weekly Connect' folder from Training Resources (it's managed by Weekly Connect page)
    delete foldersMap['Weekly Connect'];
    res.json({ folders: Object.values(foldersMap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name required' });
    const safe = sanitizePath(name.trim().replace(/[^a-zA-Z0-9_\-\.\/\\ ]/g, '_'));
    if (!safe || !isPathSafe(UPLOADS_DIR, safe)) return res.status(400).json({ error: 'Invalid folder name' });
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
        // 1. Upload to Supabase Storage (Bucket: resource-uploads)
        const fileBuffer = fs.readFileSync(req.file.path);
        const { error: storageErr } = await supabase.storage
          .from('resource-uploads')
          .upload(`${folder}/${req.file.filename}`, fileBuffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (storageErr) {
            console.error('⚠️ Supabase Storage Upload Error:', storageErr.message);
            // If bucket not found, it might be named with underscore
            await supabase.storage.from('resource_uploads').upload(`${folder}/${req.file.filename}`, fileBuffer, {
              contentType: req.file.mimetype,
              upsert: true
            });
        }

        // 2. Sync Metadata to resource_uploads table
        await supabase.from('resource_uploads').insert([{
          filename: req.file.filename,
          folder: folder,
          uploaded_by: uploaderEmail
        }]);

        const isNotEmpty = req.file.size > 0;
        if (req.body.email && isNotEmpty) {
          const { data: supaUser } = await supabase.from('users').select('id, points').ilike('email', req.body.email).single();
          if (supaUser) await supabase.from('users').update({ points: (supaUser.points || 0) + 1 }).eq('id', supaUser.id);
        }
      } catch (e) { console.error('⚠️ Supabase sync error:', e.message); }
    }

    const isNotEmpty = req.file.size > 0;
    if (req.body.email && isNotEmpty) db.prepare('UPDATE users SET points = points + 1 WHERE email = ?').run(req.body.email);
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
    
    const safeFolder = sanitizePath(folder);
    const safeFile = sanitizePath(file);
    if (!isPathSafe(UPLOADS_DIR, path.join(safeFolder, safeFile))) {
      return res.status(403).send('Access denied');
    }
    
    const filePath = path.join(UPLOADS_DIR, safeFolder, safeFile);
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
    
    const safeFolder = sanitizePath(folder);
    const safeFile = sanitizePath(file);
    if (!isPathSafe(UPLOADS_DIR, path.join(safeFolder, safeFile))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    let filePath = path.join(UPLOADS_DIR, safeFolder, safeFile);
    
    // Check if file exists locally
    if (!await fs.pathExists(filePath)) {
      console.log(`🔍 File not found locally: ${filePath}. Checking Supabase...`);
      
      if (supabase) {
        try {
          // Find the record to confirm it exists and get its metadata if needed
          const row = db.prepare('SELECT filename FROM public_documents WHERE folder = ? AND (filename = ? OR original_name = ?)').get(folder, file, file);
          const storageName = row ? row.filename : file;
          const storagePath = `${folder}/${storageName}`;
          
          console.log(`📡 Attempting Supabase download: ${storagePath}`);
          
          let { data: fileData, error: dlErr } = await supabase.storage
            .from('resource-uploads')
            .download(storagePath);
            
          // Fallback to resource_uploads if resource-uploads fails
          if (dlErr) {
            console.warn(`⚠️ Primary bucket failed, trying fallback: ${dlErr.message}`);
            const fallback = await supabase.storage.from('resource_uploads').download(storagePath);
            fileData = fallback.data;
            dlErr = fallback.error;
          }
            
          if (!dlErr && fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, Buffer.from(arrayBuffer));
            console.log(`✅ Downloaded ${file} from Supabase.`);
          } else {
            console.error(`❌ Supabase download failed for ${file}:`, dlErr?.message);
          }
        } catch (supaErr) {
          console.error(`❌ Supabase logic error:`, supaErr.message);
        }
      }
    }

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    let doc = db.prepare('SELECT original_name FROM public_documents WHERE folder = ? AND filename = ?').get(folder, file);
    let downloadName = doc ? doc.original_name : file;
    serveDecryptedFile(filePath, res, downloadName);
  } catch (err) { 
    console.error('API /api/file error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

app.delete('/api/file', async (req, res) => {
  try {
    const { folder, file, email } = req.query;
    if (!folder || !file) return res.status(400).json({ error: 'Missing parameters' });
    
    // Find the document to check ownership
    let doc = db.prepare('SELECT filename, uploader_email, original_name FROM public_documents WHERE folder = ? AND (original_name = ? OR filename = ?)').get(folder, file, file);
    if (!doc) {
      if (supabase) {
        // Look up by original title (case-insensitive)
        const { data: linkDoc } = await supabase.from('resource_links').select('title, uploaded_by').ilike('folder', folder).ilike('title', file).single();
        if (linkDoc) {
          if (!email) return res.status(401).json({ error: 'Authentication required to delete resources.' });
          const user = await getUserByEmail(email);
          const isAdmin = user && user.role === 'admin';
          if (linkDoc.uploaded_by && linkDoc.uploaded_by.toLowerCase() !== email.toLowerCase() && !isAdmin) {
            return res.status(403).json({ error: 'Access Denied: You are not the owner of this resource.' });
          }
          await supabase.from('resource_links').delete().ilike('folder', folder).ilike('title', file);
          
          // Deduct Point from Link Uploader
          if (linkDoc.uploaded_by) {
            db.prepare('UPDATE users SET points = MAX(0, points - 1) WHERE email = ?').run(linkDoc.uploaded_by);
            try {
              const { data: supaUser } = await supabase.from('users').select('id, points').ilike('email', linkDoc.uploaded_by).single();
              if (supaUser) {
                const newPoints = Math.max(0, (supaUser.points || 0) - 1);
                await supabase.from('users').update({ points: newPoints }).eq('id', supaUser.id);
              }
            } catch (supaErr) { console.warn('⚠️ Supabase point deduction error:', supaErr.message); }
          }
          return res.json({ success: true });
        }
      }
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (!email) return res.status(401).json({ error: 'Authentication required to delete resources.' });

    // RESTORE OWNERSHIP CHECK FOR FILES (Allow admins to bypass)
    const user = await getUserByEmail(email);
    const isAdmin = user && user.role === 'admin';

    if (doc.uploader_email && doc.uploader_email.toLowerCase() !== email.toLowerCase() && !isAdmin) {
      return res.status(403).json({ error: 'Access Denied: You are not the owner of this resource.' });
    }

    const filePath = path.join(UPLOADS_DIR, folder, doc.filename);
    let isNotEmpty = true;
    try {
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) isNotEmpty = false;
      }
    } catch (e) {
      console.warn('Failed to check size of deleting file:', e.message);
    }

    if (await fs.pathExists(filePath)) await fs.remove(filePath);
    
    if (supabase) {
      await supabase.from('resource_uploads').delete().ilike('folder', folder).ilike('filename', doc.filename);
      if (doc.filename.endsWith('.ytlink') || (doc.original_name && doc.original_name.endsWith('.ytlink'))) {
        await supabase.from('resource_links').delete().ilike('folder', folder).ilike('title', (doc.original_name || '').replace('.ytlink', ''));
      }
    }
    
    db.prepare('DELETE FROM public_documents WHERE folder = ? AND filename = ?').run(folder, doc.filename);

    // Deduct Point from File Uploader only if file was not empty
    if (doc.uploader_email && isNotEmpty) {
      db.prepare('UPDATE users SET points = MAX(0, points - 1) WHERE email = ?').run(doc.uploader_email);
      if (supabase) {
        try {
          const { data: supaUser } = await supabase.from('users').select('id, points').ilike('email', doc.uploader_email).single();
          if (supaUser) {
            const newPoints = Math.max(0, (supaUser.points || 0) - 1);
            await supabase.from('users').update({ points: newPoints }).eq('id', supaUser.id);
          }
        } catch (supaErr) { console.warn('⚠️ Supabase point deduction error:', supaErr.message); }
      }
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/delete-folder', async (req, res) => {
  try {
    const folder = req.body.folder || req.query.folder;
    const email = req.body.email || req.query.email;
    if (!folder) return res.status(400).json({ error: 'Folder path required' });
    
    if (folder === '.' || folder === './' || folder === '') return res.status(403).json({ error: 'Cannot delete root' });

    if (!email) return res.status(401).json({ error: 'Authentication required to delete folders.' });

    // --- Ownership Check ---
    const user = await getUserByEmail(email);
    const isAdmin = user && user.role === 'admin';

    if (!isAdmin) {
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

    // Deduct Point from all Uploaders whose files are in this folder or its subfolders
    const folderDocs = db.prepare('SELECT uploader_email FROM public_documents WHERE folder = ? OR folder LIKE ?').all(folder, folder + '/%');
    for (const d of folderDocs) {
      if (d.uploader_email) {
        db.prepare('UPDATE users SET points = MAX(0, points - 1) WHERE email = ?').run(d.uploader_email);
        if (supabase) {
          try {
            const { data: supaUser } = await supabase.from('users').select('id, points').ilike('email', d.uploader_email).single();
            if (supaUser) {
              const newPoints = Math.max(0, (supaUser.points || 0) - 1);
              await supabase.from('users').update({ points: newPoints }).eq('id', supaUser.id);
            }
          } catch (supaErr) { console.warn('⚠️ Supabase point deduction error:', supaErr.message); }
        }
      }
    }
    
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
  const headHex = iv.slice(0, 4).toString('hex');
  const isUnencrypted = head.startsWith('%PDF') || 
                        head.startsWith('{') || 
                        headHex === '504b0304' ||
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
  const headHex = buffer.slice(0, 4).toString('hex');
  const isUnencrypted = head.startsWith('%PDF') || 
                        head.startsWith('{') || 
                        headHex === '504b0304' ||
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
              const stmt = db.prepare('INSERT OR REPLACE INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)');
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
    let user = await getUserByEmail(email);
    if (!user) {
      // Auto-heal: create a stub user so document locker works for authenticated users
      console.warn('User not found in DB:', email, '— creating stub profile');
      try {
        const stubId = require('uuid').v4();
        const stubName = email.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        db.prepare('INSERT INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)')
          .run(stubId, stubName, email.toLowerCase(), '', 'employee', 0);
        user = { id: stubId, fullname: stubName, email: email.toLowerCase() };
        console.log('✅ Created stub user for document locker:', email);
      } catch (stubErr) {
        // If insert fails (e.g. already exists with different case), try fetching again
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
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
            const folderMap = {};
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
    let user = await getUserByEmail(email);
    if (!user) {
      // Auto-heal: create stub user
      try {
        const stubId = require('uuid').v4();
        const stubName = email.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        db.prepare('INSERT INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)')
          .run(stubId, stubName, email.toLowerCase(), '', 'employee', 0);
        user = { id: stubId, fullname: stubName, email: email.toLowerCase() };
      } catch (stubErr) {
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (!user) return res.status(404).json({ error: 'User not found' });
      }
    }

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' is not allowed.`));
    }
  }
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

          // 2. Upload encrypted file bytes to Supabase Storage (user-uploads bucket)
          try {
            const encryptedBuffer = fs.readFileSync(req.file.path);
            const storagePath = `${supaId}/${targetFolder}/${req.file.filename}`;
            const { error: storageErr } = await supabase.storage
              .from('user-uploads')
              .upload(storagePath, encryptedBuffer, { contentType: 'application/octet-stream', upsert: true });
            if (storageErr) {
              // Try alternate bucket name
              await supabase.storage.from('user_uploads').upload(storagePath, encryptedBuffer, { contentType: 'application/octet-stream', upsert: true });
            }
            console.log('✅ Supabase Storage upload SUCCESS for private doc');
          } catch (storageUploadErr) {
            console.warn('⚠️ Supabase Storage upload failed (file still on disk):', storageUploadErr.message);
          }

          // 3. Sync metadata to user_folders and user_documents tables
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

    // If file not on local disk, try to recover from Supabase Storage
    if (!await fs.pathExists(filePath) && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('id').ilike('email', email).single();
        if (supaUser) {
          const storagePath = `${supaUser.id}/${folder}/${doc.hashed_name}`;
          let { data: fileData, error: dlErr } = await supabase.storage.from('user-uploads').download(storagePath);
          if (dlErr) {
            const fallback = await supabase.storage.from('user_uploads').download(storagePath);
            fileData = fallback.data; dlErr = fallback.error;
          }
          if (!dlErr && fileData) {
            const buf = Buffer.from(await fileData.arrayBuffer());
            await fs.ensureDir(USER_UPLOADS_DIR);
            await fs.writeFile(filePath, buf);
            console.log(`✅ Recovered private doc from Supabase Storage: ${doc.hashed_name}`);
          } else {
            console.error('❌ Supabase Storage recovery failed for private doc:', dlErr?.message);
          }
        }
      } catch (recoverErr) {
        console.error('Supabase Storage recovery error:', recoverErr.message);
      }
    }

    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'File missing on disk and could not be recovered' });

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
    let user = await getUserByEmail(email);
    if (!user) {
      // Auto-heal: create stub user
      try {
        const stubId = require('uuid').v4();
        const stubName = email.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        db.prepare('INSERT INTO users (id, fullname, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)')
          .run(stubId, stubName, email.toLowerCase(), '', 'employee', 0);
        user = { id: stubId };
      } catch (stubErr) {
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (!user) return res.status(404).json({ error: 'User not found' });
      }
    }

    const docs = db.prepare('SELECT id, hashed_name FROM user_documents WHERE user_id = ? AND (folder = ? OR folder LIKE ?)').all(user.id, folder, folder + '/%');
    
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
          await supabase.from('user_folders').delete().eq('user_id', supaUser.id).ilike('path', `${folder}/%`);
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

    // Store in local SQLite FIRST (fast)
    try {
      db.prepare(`
        INSERT INTO hr_queries (employee_name, employee_email, subject, message, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(name, email, subject || 'No Subject', message);
    } catch (dbLocalErr) {
      console.error('❌ Failed to save query to SQLite:', dbLocalErr.message);
      return res.status(500).json({ error: 'Failed to save query' });
    }

    // Respond immediately
    res.json({ success: true, message: 'Your query has been sent to HR successfully!' });

    // Background sync to Supabase (non-blocking)
    if (supabase) {
      supabase.from('hr_queries').insert({
        employee_name: name,
        employee_email: email,
        subject: subject || 'No Subject',
        message: message,
        status: 'pending'
      }).then(({ error }) => {
        if (error) console.warn('HR query Supabase sync failed:', error.message);
      });
    }
  } catch (error) {
    console.error('Failed to process inquiry:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to process inquiry' });
  }
});

// ─── HR Inbox Dashboard APIs ──────────────────────────────────────────────────
app.get('/api/hr/queries', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || !(await checkIsAdmin(email))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized to view HR inquiries.' });
    }

    // Always read from SQLite (most up-to-date since writes go here first)
    const queries = db.prepare('SELECT * FROM hr_queries ORDER BY created_at DESC').all();
    res.json(queries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/hr/queries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, status } = req.body; // 'pending', 'in-progress', 'resolved'

    if (!adminEmail || !(await checkIsAdmin(adminEmail))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized.' });
    }

    if (!['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // 1. Update in local SQLite
    db.prepare('UPDATE hr_queries SET status = ? WHERE id = ?').run(status, id);

    // 2. Update in Supabase if active
    if (supabase) {
      try {
        const { error } = await supabase
          .from('hr_queries')
          .update({ status })
          .eq('id', id);
        if (error) console.error('Supabase query status update skipped:', error.message);
      } catch (err) {
        console.error('Supabase status sync error:', err.message);
      }
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/hr/queries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email || !(await checkIsAdmin(email))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized.' });
    }

    db.prepare('DELETE FROM hr_queries WHERE id = ?').run(id);
    res.json({ success: true, message: 'HR query deleted successfully' });

    // Background Supabase sync
    if (supabase) {
      supabase.from('hr_queries').delete().eq('id', id).then(() => {});
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Support Tickets Tracker APIs ──────────────────────────────────────
app.get('/api/admin/support-tickets', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || !(await checkIsAdmin(email))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized to view support tickets.' });
    }

    // Always read from SQLite (most up-to-date since writes go here first)
    const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/support-tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, status } = req.body; // 'pending', 'in-progress', 'resolved'

    if (!adminEmail || !(await checkIsAdmin(adminEmail))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized.' });
    }

    if (!['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // 1. Update in local SQLite
    db.prepare('UPDATE support_tickets SET status = ? WHERE id = ?').run(status, id);

    // 2. Update in Supabase if active
    if (supabase) {
      try {
        const { error } = await supabase
          .from('support_tickets')
          .update({ status })
          .eq('id', id);
        if (error) console.error('Supabase support ticket status update error:', error.message);
      } catch (err) {
        console.error('Supabase status sync error:', err.message);
      }
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/support-tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email || !(await checkIsAdmin(email))) {
      return res.status(403).json({ error: 'Access Denied: You are not authorized.' });
    }

    db.prepare('DELETE FROM support_tickets WHERE id = ?').run(id);
    res.json({ success: true, message: 'Support ticket deleted successfully' });

    // Background Supabase sync
    if (supabase) {
      supabase.from('support_tickets').delete().eq('id', id).then(() => {});
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Employee Support Ticket Route ────────────────────────────────────────────
app.post('/api/employee-support/ticket', async (req, res) => {
  try {
    const { name, email, category, priority, subject, description } = req.body;

    if (!name || !email || !subject || !description) {
      return res.status(400).json({ error: 'Name, email, subject, and description are required.' });
    }

    // Store in SQLite FIRST (fast)
    try {
      db.prepare(`
        INSERT INTO support_tickets (name, email, category, priority, subject, description, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(name, email, category, priority, subject, description);
    } catch (sqlErr) {
      console.error('❌ SQLite ticket storage error:', sqlErr.message);
      return res.status(500).json({ error: 'Failed to save ticket' });
    }

    // Respond immediately
    res.json({ success: true, message: 'Ticket submitted successfully!' });

    // Background sync to Supabase (non-blocking)
    if (supabase) {
      supabase.from('support_tickets').insert({
        name, email, category, priority, subject, description, status: 'pending'
      }).then(({ error }) => {
        if (error) console.warn('Support ticket Supabase sync failed:', error.message);
      });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to process support ticket' });
  }
});

// ─── Weekly Connect Team Members APIs ──────────────────────────────────────────
app.get('/api/team-members', async (req, res) => {
  try {
    // 1. Fetch from Supabase if active
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('weekly_connect_members')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          return res.json(data);
        }
        if (error) {
          console.warn('Supabase weekly_connect_members fetch issue, falling back to SQLite:', error.message);
        }
      } catch (err) {
        console.warn('Supabase fetch failed, falling back to SQLite:', err.message);
      }
    }

    // 2. Fetch from SQLite fallback
    const members = db.prepare('SELECT * FROM weekly_connect_members ORDER BY created_at ASC').all();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team-members', express.json(), async (req, res) => {
  try {
    const { name, team, email } = req.body;
    if (!name || !team) {
      return res.status(400).json({ error: 'Name and Team are required.' });
    }

    // 1. Store in SQLite
    let localId;
    try {
      const result = db.prepare(`
        INSERT INTO weekly_connect_members (name, team, email)
        VALUES (?, ?, ?)
      `).run(name, team, email || 'N/A');
      localId = result.lastInsertRowid;
      console.log('✅ Team member saved to local SQLite database.');
    } catch (sqlErr) {
      console.error('❌ SQLite team member storage error:', sqlErr.message);
    }

    // 2. Sync to Supabase if active
    if (supabase) {
      try {
        const { error } = await supabase.from('weekly_connect_members').insert({
          name,
          team,
          email: email || 'N/A',
          created_at: new Date()
        });
        if (error) {
          console.warn('Supabase weekly_connect_members sync issue:', error.message);
        } else {
          console.log('✅ Team member synced to cloud database.');
        }
      } catch (dbErr) {
        console.warn('Supabase weekly_connect_members DB error:', dbErr.message);
      }
    }

    res.json({ success: true, message: 'Member added successfully!', id: localId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

app.delete('/api/team-members/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the member from SQLite before deleting so we can sync delete with Supabase
    let memberToDelete = null;
    try {
      memberToDelete = db.prepare('SELECT * FROM weekly_connect_members WHERE id = ?').get(id);
    } catch (sqlErr) {
      console.error('❌ SQLite error fetching team member before deletion:', sqlErr.message);
    }

    // 1. Delete from SQLite
    try {
      db.prepare('DELETE FROM weekly_connect_members WHERE id = ?').run(id);
      console.log('✅ Team member deleted from local SQLite.');
    } catch (sqlErr) {
      console.error('❌ SQLite team member delete error:', sqlErr.message);
    }

    // 2. Delete from Supabase if active
    if (supabase && memberToDelete && !process.env.SOFT_DELETE) {
      try {
        const { error } = await supabase
          .from('weekly_connect_members')
          .delete()
          .eq('email', memberToDelete.email)
          .eq('name', memberToDelete.name);
        if (error) {
          console.warn('Supabase weekly_connect_members delete sync issue:', error.message);
        } else {
          console.log('✅ Team member deleted from cloud database.');
        }
      } catch (dbErr) {
        console.warn('Supabase weekly_connect_members delete DB error:', dbErr.message);
      }
    }

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Gemini AI Chat Route ─────────────────────────────────────────────────────
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const sanitizedMessage = sanitizeText(message, 2000);
  if (!sanitizedMessage) return res.status(400).json({ error: 'Message is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is missing. Please provide it in the .env file.' });
  }

  try {
    // Load knowledge base
    let knowledgeBase = '';
    try {
      const kbPath = path.join(__dirname, 'data', 'knowledge_base.txt');
      if (fs.existsSync(kbPath)) {
        knowledgeBase = fs.readFileSync(kbPath, 'utf8');
      }
    } catch (kbErr) {
      console.warn('Could not read knowledge base file:', kbErr.message);
    }

    const today = new Date();
    const currentDateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `You are the Gantec HR Assistant. 
    STRICT RULES:
    - BE EXTREMELY CONCISE. 
    - NO long introductions like "I'd be happy to help". Just give the answer.
    - Use bullet points for lists.
    - Maximum 3 sentences for general text.
    - Prioritize using the Gantec Knowledge Base below for all Gantec-specific policy, holiday, and procedural questions.
    - If the user asks about the "next holiday" or upcoming holidays, you MUST explicitly list BOTH the next upcoming "Company Holiday" and the next upcoming "Floating Holiday Option" from the list based on the Current Date Context.
    - If the user's question is NOT explicitly found in the Gantec Knowledge Base, DO NOT say "I don't know" or "Contact HR" as your only reply. Instead, you MUST use your general knowledge to provide a highly relevant, helpful, and closely related answer to their query, and then add a brief friendly note at the end that they can contact the HR Manager, Hemalatha Malem (hemalatha.malem@gantecusa.com), or the HR Department (hr@gantecusa.com) for official Gantec policies.
    
    Current Date Context:
    - Today is: ${currentDateStr}
    
    Platform Navigation:
    - Training Resources: Sidebar menu -> Training Resources.
    - Document Locker: Sidebar menu.
    - Company Culture/Certifications/Contact HR: Sidebar menu.
    
    Gantec Knowledge Base:
    ${knowledgeBase}
    
    Question: ${message}`;

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const result = await model.generateContent(prompt);
    const replyText = result.response.text() || "I'm sorry, I couldn't generate a response.";
    res.json({ success: true, reply: replyText });
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('demand'))) {
      return res.json({ success: true, reply: "I'm a bit busy right now! Please try asking me again in a few seconds. 🤖" });
    }
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
        console.log(`⬇️  Summarizer: Fetching from Supabase: ${storagePath}`);
        
        let { data: fileData, error: dlErr } = await supabase.storage
          .from('resource-uploads')
          .download(storagePath);
          
        if (dlErr) {
          console.warn(`⚠️ Summarizer primary bucket failed, trying fallback...`);
          const fallback = await supabase.storage.from('resource_uploads').download(storagePath);
          fileData = fallback.data;
          dlErr = fallback.error;
        }

        if (!dlErr && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const tmpPath = path.join(UPLOADS_DIR, folder, storageName);
          await fs.ensureDir(path.dirname(tmpPath));
          await fs.writeFile(tmpPath, Buffer.from(arrayBuffer));
          filePath = tmpPath;
          console.log(`✅ Summarizer: Downloaded to ${tmpPath}`);
        } else {
          console.error('Summarizer: Supabase download failed:', dlErr?.message);
        }
      } catch (dlError) {
        console.error('Summarizer: Supabase storage logic error:', dlError.message);
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
    } else if (isTxt || ['.txt', '.md', '.rtf', '.html', '.htm', '.csv', '.bin'].includes(ext) || !ext) {
      // Fallback for plaintext and other readable types
      extractedText = dataBuffer.toString('utf-8').replace(/[\x00-\x08\x0e-\x1f\x7f-\x9f]/g, '').trim();
      console.log('Text-based parse length:', extractedText.length);
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

    const genModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    
    console.log(`🤖 Summarizing with Gemini SDK (v1): ${filename}...`);
    
    // Safety check: ensure truncatedText is defined and valid
    const finalSafeText = (textToSummarize || "No content found").substring(0, 30000);
    
    const prompt = `Please provide a professional, comprehensive summary of the following document content. 
    Highlight the key objectives, main points, and actionable details. 
    Use clear headers and bullet points.
    
    Document Content:
    ${finalSafeText}`;

    try {
      const result = await genModel.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      if (!summary) throw new Error('Empty response from AI');
      res.json({ success: true, summary });
    } catch (apiErr) {
      console.warn('⚠️ Gemini API failed, falling back to simulated summary:', apiErr.message);
      
      // FALLBACK: Use simulated logic if API fails
      const cleanText = (textToSummarize || '').trim();
      let highlights = '';
      if (cleanText.length > 30) {
        const sentences = cleanText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 400);
        highlights = sentences.slice(0, 5).map(p => `* ${p}`).join('\n') || `* ${cleanText.substring(0, 300)}...`;
      } else {
        highlights = `* No extractable text found in this document.`;
      }

      const displayName = originalName || filename;
      const fallbackSummary = `### 📝 Document Insights (Smart Fallback)
**Document:** ${displayName}
**Location:** ${folder} folder

**Key Highlights extracted from document:**
${highlights}

---
*💡 Note: The AI service is currently experiencing high demand. The above summary was generated using our local backup analyzer.*`;
      
      res.json({ success: true, summary: fallbackSummary });
    }

  } catch (err) {
    console.error('Summarization fatal error:', err);
    res.status(500).json({ error: 'Failed to generate summary: ' + err.message });
  }
});

// ─── Weekly Connect API ─────────────────────────────────────────────────────

// GET /api/weekly-sessions — Fetch all sessions
app.get('/api/weekly-sessions', async (req, res) => {
  try {
    let sessions = [];

    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('weekly_sessions')
        .select('*')
        .order('id', { ascending: false });
      if (!error && data && data.length > 0) {
        sessions = data.map(s => ({
          ...s,
          winners: typeof s.winners === 'string' ? JSON.parse(s.winners) : s.winners
        }));
      }
    }

    // Fallback to SQLite
    if (sessions.length === 0) {
      const rows = db.prepare('SELECT * FROM weekly_sessions ORDER BY id DESC').all();
      sessions = rows.map(s => ({
        ...s,
        winners: typeof s.winners === 'string' ? JSON.parse(s.winners) : s.winners
      }));
    }

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Weekly sessions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly sessions' });
  }
});

// POST /api/weekly-sessions — Create a new session
app.post('/api/weekly-sessions', async (req, res) => {
  try {
    const { id, week, name, topic, link, filename, updates, fun, winners } = req.body;
    if (!week || !name || !topic || !fun) {
      return res.status(400).json({ error: 'week, name, topic, and fun are required' });
    }

    const sessionId = id || Date.now();
    const winnersJson = JSON.stringify(winners || []);

    // Save to SQLite
    db.prepare(`INSERT OR REPLACE INTO weekly_sessions (id, week, name, topic, link, filename, updates, fun, winners)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(sessionId, week, name, topic, link || '#', filename || '', updates || '', fun, winnersJson);

    // Sync to Supabase
    if (supabase) {
      try {
        await supabase.from('weekly_sessions').upsert([{
          id: sessionId,
          week, name, topic,
          link: link || '#',
          filename: filename || '',
          updates: updates || '',
          fun,
          winners: winners || []
        }], { onConflict: 'id' });
      } catch (e) { console.warn('⚠️ Supabase weekly session sync error:', e.message); }
    }

    res.json({ success: true, session: { id: sessionId, week, name, topic, link, filename, updates, fun, winners } });
  } catch (err) {
    console.error('Weekly session create error:', err);
    res.status(500).json({ error: 'Failed to create weekly session' });
  }
});

// PUT /api/weekly-sessions/:id — Update a session
app.put('/api/weekly-sessions/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { week, name, topic, link, filename, updates, fun, winners } = req.body;

    const winnersJson = JSON.stringify(winners || []);

    // Update SQLite
    db.prepare(`UPDATE weekly_sessions SET week=?, name=?, topic=?, link=?, filename=?, updates=?, fun=?, winners=?
      WHERE id=?`)
      .run(week, name, topic, link || '#', filename || '', updates || '', fun, winnersJson, sessionId);

    // Update Supabase
    if (supabase) {
      try {
        await supabase.from('weekly_sessions').update({
          week, name, topic,
          link: link || '#',
          filename: filename || '',
          updates: updates || '',
          fun,
          winners: winners || []
        }).eq('id', sessionId);
      } catch (e) { console.warn('⚠️ Supabase weekly session update error:', e.message); }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Weekly session update error:', err);
    res.status(500).json({ error: 'Failed to update weekly session' });
  }
});

// DELETE /api/weekly-sessions/:id — Delete a session
app.delete('/api/weekly-sessions/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    // Delete from SQLite
    db.prepare('DELETE FROM weekly_sessions WHERE id = ?').run(sessionId);

    // Delete from Supabase
    if (supabase && !process.env.SOFT_DELETE) {
      try {
        await supabase.from('weekly_sessions').delete().eq('id', sessionId);
      } catch (e) { console.warn('⚠️ Supabase weekly session delete error:', e.message); }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Weekly session delete error:', err);
    res.status(500).json({ error: 'Failed to delete weekly session' });
  }
});

// ─── Holidays API ───────────────────────────────────────────────────────────

app.get('/api/holidays', async (req, res) => {
  try {
    let holidays = [];
    if (supabase) {
      const { data, error } = await supabase.from('holidays').select('*').order('date', { ascending: true });
      if (!error && data && data.length > 0) holidays = data;
    }
    if (holidays.length === 0) {
      holidays = db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
    }
    res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});



// ─── Leave Settings API (Dynamic Link) ──────────────────────────────────────

app.get('/api/leave/settings', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    let settings = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('power_apps_link')
        .eq('user_email', email)
        .single();
      if (!error && data) settings = data;
    }
    
    if (!settings) {
      settings = db.prepare('SELECT power_apps_link FROM leave_balances WHERE user_email = ?').get(email);
    }

    res.json({ success: true, power_apps_link: settings ? settings.power_apps_link : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave settings' });
  }
});

// ─── CERTIFICATIONS API ───────────────────────────────────────────────────────

app.get('/api/certifications', async (req, res) => {
  try {
    // Try Supabase first (table: certificate_leaders)
    if (supabase) {
      const { data, error } = await supabase
        .from('certificate_leaders')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        // Normalize: support both old schema (name) and new schema (certificate_name)
        const normalized = data.map(c => ({
          id: c.id,
          certificate_name: c.certificate_name || c.name || '',
          certificate_owner: c.certificate_owner || '',
          expiry_date: c.expiry_date || null,
          provider: c.provider || '',
          notes: c.notes || '',
          created_at: c.created_at
        }));
        return res.json({ success: true, certifications: normalized });
      }
    }
    // SQLite fallback (table: certificate_leaders)
    const rows = db.prepare('SELECT * FROM certificate_leaders ORDER BY created_at ASC').all();
    res.json({ success: true, certifications: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/certifications', async (req, res) => {
  try {
    const { certificate_name, expiry_date, certificate_owner, provider, notes } = req.body;
    if (!certificate_name) return res.status(400).json({ error: 'Certificate name is required' });

    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('certificate_leaders')
        .insert([{ certificate_name, expiry_date, certificate_owner, provider, notes }])
        .select()
        .single();
      if (!error && data) {
        return res.json({ success: true, certification: data });
      }
      console.warn('Supabase cert insert failed, falling back to SQLite:', error?.message);
    }
    // SQLite fallback
    const stmt = db.prepare(
      'INSERT INTO certificate_leaders (certificate_name, expiry_date, certificate_owner, provider, notes) VALUES (?, ?, ?, ?, ?)'
    );
    const info = stmt.run(certificate_name, expiry_date || null, certificate_owner || null, provider || null, notes || null);
    const row = db.prepare('SELECT * FROM certificate_leaders WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, certification: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/certifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (supabase) {
      const { error } = await supabase.from('certificate_leaders').delete().eq('id', id);
      if (!error) return res.json({ success: true });
    }
    db.prepare('DELETE FROM certificate_leaders WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/certifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { certificate_name, expiry_date, certificate_owner, provider, notes } = req.body;
    if (supabase) {
      const { data, error } = await supabase
        .from('certificate_leaders')
        .update({ certificate_name, expiry_date, certificate_owner, provider, notes })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return res.json({ success: true, certification: data });
    }
    db.prepare(
      'UPDATE certificate_leaders SET certificate_name=?, expiry_date=?, certificate_owner=?, provider=?, notes=? WHERE id=?'
    ).run(certificate_name, expiry_date, certificate_owner, provider, notes, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/feedback/data', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailLower = email.toLowerCase();

  try {
    // Self-healing backend sanitizer (strip numeric character keys)
    const cleanObj = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!/^\d+$/.test(key)) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    };

    // Helper: parse and clean a selections/remarks value from either DB source
    const parseAndClean = (val) => {
      if (val === null || val === undefined) return {};
      // If it's already a plain object (from Supabase JSONB), clean it directly
      if (typeof val === 'object' && !Array.isArray(val)) return cleanObj(val);
      // If it's a string (from SQLite or mis-stored JSONB), parse first
      if (typeof val === 'string') {
        try { return cleanObj(JSON.parse(val)); } catch (e) { return {}; }
      }
      return {};
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('monthly_feedback')
        .select('*')
        .eq('user_email', emailLower)
        .order('period', { ascending: false });

      if (error) {
        console.error('[Feedback] Supabase error, falling back to SQLite:', error.message);
      } else {
        const parsedData = (data || []).map(row => ({
          ...row,
          selections: parseAndClean(row.selections),
          remarks: parseAndClean(row.remarks),
          is_submitted: row.is_submitted === true || row.is_submitted === 1
        }));
        return res.json({ success: true, feedback: parsedData });
      }
    }

    // SQLite fallback
    const rows = db.prepare('SELECT * FROM monthly_feedback WHERE LOWER(user_email) = LOWER(?) ORDER BY period DESC').all(emailLower);
    const parsedRows = rows.map(row => ({
      ...row,
      selections: parseAndClean(row.selections),
      remarks: parseAndClean(row.remarks),
      is_submitted: row.is_submitted === 1 || row.is_submitted === true
    }));
    return res.json({ success: true, feedback: parsedRows });
  } catch (err) {
    console.error('[DEBUG] Failed to fetch feedback data:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback: ' + err.message });
  }
});

app.post('/api/feedback/save', async (req, res) => {
  const { user_email, role, period, selections, remarks, is_submitted } = req.body;

  if (!user_email || !role || !period) {
    return res.status(400).json({ error: 'Missing required feedback fields' });
  }

  const emailLower = user_email.toLowerCase();

  // Clean selections
  let cleanSelections = selections || {};
  if (typeof cleanSelections === 'string') {
    try { cleanSelections = JSON.parse(cleanSelections); } catch (e) { cleanSelections = {}; }
  }
  // Remove legacy bundled remarks if present
  if (cleanSelections._remarks) delete cleanSelections._remarks;

  // Clean remarks
  let cleanRemarks = remarks || {};
  if (typeof cleanRemarks === 'string') {
    try { cleanRemarks = JSON.parse(cleanRemarks); } catch (e) { cleanRemarks = {}; }
  }

  // Self-healing backend sanitizer (strip numeric character keys)
  const sanitizeJSONField = (obj) => {
    if (!obj || typeof obj !== 'object') return {};
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!/^\d+$/.test(key)) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  cleanSelections = sanitizeJSONField(cleanSelections);
  cleanRemarks = sanitizeJSONField(cleanRemarks);

  // Ensure selections and remarks are always plain objects (never strings) before saving
  if (typeof cleanSelections !== 'object' || Array.isArray(cleanSelections)) cleanSelections = {};
  if (typeof cleanRemarks !== 'object' || Array.isArray(cleanRemarks)) cleanRemarks = {};

  const now = new Date();
  const isSubmittedBool = !!is_submitted;   // true/false for Supabase BOOLEAN
  const isSubmittedInt  = isSubmittedBool ? 1 : 0; // 0/1 for SQLite INTEGER

  // Supabase payload — selections/remarks must be plain objects (JSONB), is_submitted must be boolean
  const supabasePayload = {
    user_email: emailLower,
    role,
    period,
    selections: cleanSelections,
    remarks: cleanRemarks,
    is_submitted: isSubmittedBool,
    updated_at: now.toISOString()
  };

  try {
    if (supabase) {
      // Upsert in Supabase (case-insensitive check by lowercasing)
      const { data: existing } = await supabase
        .from('monthly_feedback')
        .select('id')
        .eq('user_email', emailLower)
        .eq('role', role)
        .eq('period', period)
        .maybeSingle();

      if (existing && existing.id) {
        const { error } = await supabase.from('monthly_feedback').update(supabasePayload).eq('id', existing.id);
        if (error) console.error('Supabase feedback update error:', error.message);
        else console.log('✅ Supabase feedback updated for', emailLower, period, role);
      } else {
        const { error } = await supabase.from('monthly_feedback').insert(supabasePayload);
        if (error) console.error('Supabase feedback insert error:', error.message);
        else console.log('✅ Supabase feedback inserted for', emailLower, period, role);
      }
    }

    // SQLite upsert (ON CONFLICT) - selections/remarks stored as JSON strings, is_submitted as 0/1
    const insertStmt = `
      INSERT INTO monthly_feedback (user_email, role, period, selections, remarks, is_submitted, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_email, role, period) DO UPDATE SET
        selections = excluded.selections,
        remarks = excluded.remarks,
        is_submitted = excluded.is_submitted,
        updated_at = excluded.updated_at`;
    db.prepare(insertStmt).run(
      emailLower,
      role,
      period,
      JSON.stringify(cleanSelections),
      JSON.stringify(cleanRemarks),
      isSubmittedInt,
      now.toISOString()
    );

    // Return response with saved data
    res.json({ success: true, message: 'Feedback synced successfully', feedback: supabasePayload });
  } catch (err) {
    console.error('Feedback sync error:', err.message);
    res.status(500).json({ error: 'Sync Failed: ' + err.message });
  }
});

app.get('/api/sub-mails', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const emailToPeriod = {};
    if (supabase) {
      const { data, error } = await supabase
        .from('main_sub_mails')
        .select('sub_email, period')
        .eq('main_email', email.toLowerCase());
      
      if (!error && data) {
        data.forEach(item => {
          if (item.sub_email) {
            const key = item.sub_email.toLowerCase();
            const existingMonths = emailToPeriod[key] ? emailToPeriod[key].split(',').map(m => m.trim()) : [];
            const newMonths = item.period ? item.period.split(',').map(m => m.trim()) : [];
            const merged = [...new Set([...existingMonths, ...newMonths])].filter(m => m);
            emailToPeriod[key] = merged.join(',') || null;
          }
        });
      } else if (error) {
        console.warn('Supabase fetch sub-mails failed, falling back to SQLite:', error.message);
      }
    }
    
    // SQLite fallback / merge
    const rows = db.prepare('SELECT sub_email, period FROM main_sub_mails WHERE main_email = ?').all(email.toLowerCase());
    rows.forEach(r => {
      if (r.sub_email) {
        const key = r.sub_email.toLowerCase();
        // Merge periods from both sources (comma-separated, no duplicates)
        const existingMonths = emailToPeriod[key] ? emailToPeriod[key].split(',').map(m => m.trim()) : [];
        const newMonths = r.period ? r.period.split(',').map(m => m.trim()) : [];
        const merged = [...new Set([...existingMonths, ...newMonths])].filter(m => m);
        emailToPeriod[key] = merged.join(',') || null;
      }
    });
    
    // Combine unique sub_emails
    const allSubs = Object.keys(emailToPeriod);

    // Fetch profile name and profile image for each sub-email to support actual profile pictures!
    const subsData = [];
    for (const subEmail of allSubs) {
      let fullname = '';
      let profile_image = '';
      
      // Check local SQLite first
      try {
        const userRow = db.prepare('SELECT fullname, profile_image FROM users WHERE LOWER(email) = LOWER(?)').get(subEmail);
        if (userRow) {
          fullname = userRow.fullname;
          profile_image = userRow.profile_image;
        }
      } catch (e) {}

      // Check Supabase if not found or if we want latest
      if (supabase && (!fullname || !profile_image)) {
        try {
          const { data, error } = await supabase.from('users').select('fullname, profile_image').ilike('email', subEmail).single();
          if (!error && data) {
            fullname = data.fullname || fullname;
            profile_image = data.profile_image || profile_image;
          }
        } catch (e) {}
      }

      // Fallbacks if user doesn't exist yet in users table
      if (!fullname) {
        fullname = subEmail.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      }

      subsData.push({
        email: subEmail,
        fullname,
        profile_image: profile_image || null,
        period: emailToPeriod[subEmail] || null
      });
    }

    res.json({ success: true, subMails: subsData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sub-mails', async (req, res) => {
  const { main_email, sub_email, period, month } = req.body;
  if (!main_email || !sub_email) {
    return res.status(400).json({ error: 'main_email and sub_email are required' });
  }

  const targetPeriod = period || month || null;
  const created_at = new Date();

  try {
    // Check if this main_email + sub_email combo already exists
    const existing = db.prepare('SELECT id, period FROM main_sub_mails WHERE LOWER(main_email) = LOWER(?) AND LOWER(sub_email) = LOWER(?)').get(main_email, sub_email);

    if (existing) {
      // Append new month to existing period (comma-separated, no duplicates)
      const existingMonths = existing.period ? existing.period.split(',').map(m => m.trim()) : [];
      if (targetPeriod && !existingMonths.includes(targetPeriod)) {
        existingMonths.push(targetPeriod);
      }
      const updatedPeriod = existingMonths.join(',');
      db.prepare('UPDATE main_sub_mails SET period = ? WHERE id = ?').run(updatedPeriod, existing.id);
      if (supabase) {
        try { await supabase.from('main_sub_mails').update({ period: updatedPeriod }).eq('id', existing.id); } catch (e) { console.warn('Supabase period update failed:', e.message); }
      }
      return res.json({ success: true, message: targetPeriod ? `Month "${targetPeriod}" added for ${sub_email}` : 'Reportee already linked' });
    }

    // New entry
    const id = uuidv4();

    if (supabase) {
      const { error } = await supabase
        .from('main_sub_mails')
        .insert([{ id, main_email: main_email.toLowerCase(), sub_email: sub_email.toLowerCase(), period: targetPeriod || null, created_at }]);
      if (error) {
        console.warn('Supabase main_sub_mails insert failed, trying locally:', error.message);
      }
    }

    db.prepare(
      'INSERT INTO main_sub_mails (id, main_email, sub_email, period, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, main_email.toLowerCase(), sub_email.toLowerCase(), targetPeriod || null, created_at.toISOString());

    // Sync / ensure sub-user exists in the users table so their profile is active
    let userExists = false;
    try {
      const localCheck = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(sub_email);
      if (localCheck) userExists = true;
    } catch (e) {}

    if (!userExists && supabase) {
      try {
        const { data } = await supabase.from('users').select('id').ilike('email', sub_email);
        if (data && data.length > 0) userExists = true;
      } catch (e) {}
    }

    // If user profile record doesn't exist, create a stub profile so they have points, profile picture, etc.
    if (!userExists) {
      const stubId = uuidv4();
      const stubName = sub_email.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      const stubUser = {
        id: stubId,
        fullname: stubName,
        email: sub_email.toLowerCase(),
        password: '', // passwordless stub
        role: 'employee',
        points: 0,
        profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(stubName)}&background=1d3461&color=fff&size=256&rounded=true`
      };

      // Insert into SQLite
      try {
        db.prepare(
          'INSERT INTO users (id, fullname, email, password, role, points, profile_image) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(stubUser.id, stubUser.fullname, stubUser.email, stubUser.password, stubUser.role, stubUser.points, stubUser.profile_image);
      } catch (e) {
        console.warn('Local SQLite stub insert failed:', e.message);
      }

      // Insert into Supabase
      if (supabase) {
        try {
          await supabase.from('users').insert([stubUser]);
        } catch (e) {
          console.warn('Supabase stub insert failed:', e.message);
        }
      }
    }

    // Insert Notification
    try {
      const recentNotif = db.prepare(`
        SELECT id FROM manager_notifications 
        WHERE LOWER(manager_email) = LOWER(?) AND LOWER(reportee_email) = LOWER(?) AND is_read = 0
      `).get(main_email.toLowerCase(), sub_email.toLowerCase());

      const notifMsg = targetPeriod
        ? `A new reportee (${sub_email}) has been assigned to you for ${targetPeriod}.`
        : `A new reportee (${sub_email}) has been assigned to you.`;

      if (!recentNotif) {
        db.prepare(`
          INSERT INTO manager_notifications (manager_email, reportee_email, message) 
          VALUES (?, ?, ?)
        `).run(main_email.toLowerCase(), sub_email.toLowerCase(), notifMsg);
      }

      // Sync notification to Supabase reportee_notifications table
      if (supabase) {
        try {
          let managerId = null;
          let reporteeId = null;
          let reporteeName = sub_email.split('@')[0];

          const managerRow = await getUserByEmail(main_email);
          if (managerRow) {
            managerId = managerRow.id;
          }

          const reporteeRow = await getUserByEmail(sub_email);
          if (reporteeRow) {
            reporteeId = reporteeRow.id;
            if (reporteeRow.fullname) reporteeName = reporteeRow.fullname;
          }

          if (managerId && reporteeId) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

            await supabase.from('reportee_notifications').insert([{
              user_id: managerId,
              reportee_id: reporteeId,
              reportee_name: reporteeName,
              assigned_by: managerId,
              notification_message: notifMsg,
              notification_type: 'assign_reportee',
              is_read: false,
              expires_at: expiresAt.toISOString()
            }]);
            console.log(`✅ Supabase reportee notification created successfully!`);
          }
        } catch (sbNotifErr) {
          console.warn('Supabase reportee notification insert failed:', sbNotifErr.message);
        }
      }
    } catch (e) {
      console.warn('Failed to insert manager notification:', e.message);
    }

    res.json({ success: true, message: 'Sub mail added and profile synced successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sub-mails', async (req, res) => {
  const { main_email, sub_email } = req.body;
  if (!main_email || !sub_email) {
    return res.status(400).json({ error: 'main_email and sub_email are required' });
  }

  try {
    if (supabase) {
      const { error } = await supabase
        .from('main_sub_mails')
        .delete()
        .eq('main_email', main_email.toLowerCase())
        .eq('sub_email', sub_email.toLowerCase());
      if (error) {
        console.warn('Supabase main_sub_mails delete failed:', error.message);
      }
    }

    db.prepare(
      'DELETE FROM main_sub_mails WHERE LOWER(main_email) = ? AND LOWER(sub_email) = ?'
    ).run(main_email.toLowerCase(), sub_email.toLowerCase());

    res.json({ success: true, message: 'Sub mail deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    let notifications = [];
    let unreadCount = 0;

    if (supabase) {
      try {
        const managerRow = await getUserByEmail(email);
        if (managerRow) {
          const { data, error } = await supabase
            .from('reportee_notifications')
            .select('*')
            .eq('user_id', managerRow.id)
            .eq('notification_type', 'assign_reportee')
            .order('created_at', { ascending: false });

          if (!error && data) {
            notifications = data.map(n => ({
              id: n.id,
              message: n.notification_message,
              created_at: n.created_at,
              is_read: n.is_read ? 1 : 0
            }));
            unreadCount = notifications.filter(n => !n.is_read).length;
          }
        }
      } catch (sbErr) {
        console.warn('Supabase notifications fetch failed, falling back to SQLite:', sbErr.message);
      }
    }

    if (notifications.length === 0) {
      notifications = db.prepare(`
        SELECT id, message, created_at, is_read FROM manager_notifications
        WHERE LOWER(manager_email) = LOWER(?) AND type = 'assign_reportee'
        ORDER BY created_at DESC
      `).all(email.toLowerCase());
      unreadCount = notifications.filter(n => !n.is_read).length;
    }

    res.json({ success: true, count: unreadCount, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/notifications/read', async (req, res) => {
  const { email, id } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    if (id) {
      if (isUuid) {
        if (supabase) {
          try {
            await supabase.from('reportee_notifications')
              .update({ is_read: true })
              .eq('id', id);
          } catch (sbErr) {
            console.warn('Failed to mark Supabase notification as read:', sbErr.message);
          }
        }
      } else {
        db.prepare(`
          UPDATE manager_notifications 
          SET is_read = 1 
          WHERE LOWER(manager_email) = LOWER(?) AND id = ? AND type = 'assign_reportee'
        `).run(email.toLowerCase(), id);
      }
    } else {
      // Mark all as read
      db.prepare(`
        UPDATE manager_notifications 
        SET is_read = 1 
        WHERE LOWER(manager_email) = LOWER(?) AND is_read = 0 AND type = 'assign_reportee'
      `).run(email.toLowerCase());

      if (supabase) {
        try {
          const managerRow = await getUserByEmail(email);
          if (managerRow) {
            await supabase.from('reportee_notifications')
              .update({ is_read: true })
              .eq('user_id', managerRow.id)
              .eq('is_read', false);
          }
        } catch (sbErr) {
          console.warn('Failed to mark all Supabase notifications as read:', sbErr.message);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/social/notifications', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const notifications = db.prepare(`
      SELECT n.id, n.message, n.created_at, n.is_read, n.type, n.reportee_email,
             u.fullname as sender_name, u.profile_image as sender_image
      FROM manager_notifications n
      LEFT JOIN users u ON LOWER(n.reportee_email) = LOWER(u.email)
      WHERE LOWER(n.manager_email) = LOWER(?) AND n.type IN ('mention', 'comment', 'message', 'like') AND n.is_read = 0
      ORDER BY n.created_at DESC
    `).all(email.toLowerCase());

    const unreadCount = notifications.length;

    res.json({ success: true, count: unreadCount, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/social/notifications/read', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    db.prepare(`
      UPDATE manager_notifications 
      SET is_read = 1 
      WHERE LOWER(manager_email) = LOWER(?) AND type IN ('mention', 'comment', 'message', 'like') AND is_read = 0
    `).run(email.toLowerCase());

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/social/notifications/read-single', (req, res) => {
  const { email, id } = req.body;
  if (!email || !id) {
    return res.status(400).json({ error: 'email and id are required' });
  }

  try {
    db.prepare(`
      UPDATE manager_notifications 
      SET is_read = 1 
      WHERE LOWER(manager_email) = LOWER(?) AND id = ? AND type IN ('mention', 'comment', 'message', 'like')
    `).run(email.toLowerCase(), id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Gantec Social API ────────────────────────────────────────────────────────
app.get('/api/social/users/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, users: [] });
  try {
    const query = `%${q}%`;
    const users = db.prepare(`
      SELECT fullname, email, profile_image 
      FROM users 
      WHERE fullname LIKE ? OR email LIKE ?
      LIMIT 10
    `).all(query, query);
    
    // Map to return just the prefix as username
    const formattedUsers = users.map(u => ({
      username: u.email.split('@')[0],
      fullname: u.fullname,
      email: u.email,
      profile_image: u.profile_image
    }));
    
    res.json({ success: true, users: formattedUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/social/feed', async (req, res) => {
  try {
    let posts = [];
    
    // Always use SQLite as primary source for posts (most reliable for comments/likes)
    posts = db.prepare(`
      SELECT p.*, u.fullname, u.profile_image 
      FROM social_posts p 
      LEFT JOIN users u ON LOWER(p.user_email) = LOWER(u.email)
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
    
    for (let post of posts) {
      post.comments = db.prepare(`
        SELECT c.*, u.fullname as user_name 
        FROM social_comments c 
        LEFT JOIN users u ON LOWER(c.user_email) = LOWER(u.email)
        WHERE c.post_id = ? 
        ORDER BY c.created_at ASC
      `).all(post.id);
      
      const likes = db.prepare('SELECT user_email FROM social_likes WHERE post_id = ?').all(post.id);
      post.likedBy = likes.map(l => l.user_email.toLowerCase());
      post.likesCount = post.likedBy.length;
    }
    
    const stories = db.prepare(`
      SELECT s.*, u.fullname as user_name, u.profile_image 
      FROM social_stories s 
      LEFT JOIN users u ON LOWER(s.user_email) = LOWER(u.email)
      WHERE s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
    `).all();
    
    res.json({ success: true, posts, stories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/social/posts', async (req, res) => {
  try {
    const { user_email, image_url, caption } = req.body;
    if (!user_email) return res.status(400).json({ error: 'Email required' });
    
    // Prevent duplicate posts: check if same user posted same caption within last 30 seconds
    const recentDupe = db.prepare(`
      SELECT id FROM social_posts 
      WHERE LOWER(user_email) = LOWER(?) AND caption = ? AND created_at > datetime('now', '-30 seconds')
    `).get(user_email, caption || '');
    if (recentDupe) {
      return res.json({ success: true, post_id: recentDupe.id });
    }
    
    const id = uuidv4();
    
    db.prepare('INSERT INTO social_posts (id, user_email, image_url, caption) VALUES (?, ?, ?, ?)')
      .run(id, user_email, image_url || '', caption || '');
      
    if (supabase) {
      try {
        let userId = null;
        let username = user_email.split('@')[0];
        const userRow = await getUserByEmail(user_email);
        if (userRow) {
          userId = userRow.id;
          if (userRow.fullname) username = userRow.fullname;
        }
        
        const taggedList = extractMentions(caption);
        
        await supabase.from('gantec_idea_hub_posts').insert([{
          id,
          user_id: userId,
          username,
          user_email: user_email.toLowerCase(),
          post_content: caption || '',
          image_url: image_url || null,
          tagged_users: taggedList,
          likes_count: 0,
          comments_count: 0,
          post_visibility: 'public',
          is_deleted: false,
          attachments: [],
          edited: false
        }]);
        console.log(`✅ Idea Hub post synced to Supabase: ${id}`);
      } catch (sbErr) {
        console.warn('Supabase post sync failed:', sbErr.message);
      }
    }
    
    if (caption) {
      const mentionedEmails = extractMentions(caption);
      for (const mentionedEmail of mentionedEmails) {
        if (mentionedEmail !== user_email.toLowerCase()) {
          try {
            const recent = db.prepare(`
              SELECT id FROM manager_notifications
              WHERE LOWER(manager_email) = LOWER(?) AND LOWER(reportee_email) = LOWER(?) AND type = 'mention' AND is_read = 0
            `).get(mentionedEmail, user_email);
            
            if (!recent) {
              const taggerName = user_email.split('@')[0];
              const msg = `${taggerName} tagged you in a post.`;
              db.prepare('INSERT INTO manager_notifications (manager_email, reportee_email, message, type) VALUES (?, ?, ?, ?)')
                .run(mentionedEmail, user_email, msg, 'mention');
                
              if (supabase) {
                try {
                  const managerRow = await getUserByEmail(mentionedEmail);
                  const reporteeRow = await getUserByEmail(user_email);
                  if (managerRow && reporteeRow) {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    
                    await supabase.from('reportee_notifications').insert([{
                      user_id: managerRow.id,
                      reportee_id: reporteeRow.id,
                      reportee_name: reporteeRow.fullname || user_email.split('@')[0],
                      assigned_by: reporteeRow.id,
                      notification_message: msg,
                      notification_type: 'mention',
                      is_read: false,
                      expires_at: expiresAt
                    }]);
                  }
                } catch (sbNotifErr) {
                  console.warn('Supabase mention notification sync failed:', sbNotifErr.message);
                }
              }
            }
          } catch (e) { console.warn('Mention notification error:', e.message); }
        }
      }
    }
    
    res.json({ success: true, post_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/social/comments', async (req, res) => {
  try {
    const { post_id, user_email, comment_text } = req.body;
    if (!post_id || !user_email || !comment_text) return res.status(400).json({ error: 'Missing data' });
    
    const id = uuidv4();
    db.prepare('INSERT INTO social_comments (id, post_id, user_email, comment_text) VALUES (?, ?, ?, ?)')
      .run(id, post_id, user_email, comment_text);
      
    if (supabase) {
      try {
        const commentCount = db.prepare('SELECT COUNT(*) as count FROM social_comments WHERE post_id = ?').get(post_id).count;
        await supabase.from('gantec_idea_hub_posts')
          .update({ comments_count: commentCount })
          .eq('id', post_id);
      } catch (sbErr) {
        console.warn('Failed to sync comment count to Supabase:', sbErr.message);
      }
    }
    
    try {
      const post = db.prepare('SELECT user_email FROM social_posts WHERE id = ?').get(post_id);
      if (post && post.user_email.toLowerCase() !== user_email.toLowerCase()) {
        const commenterName = user_email.split('@')[0];
        const commentMsg = `${commenterName} commented on your post.`;
        const recentComment = db.prepare(`
          SELECT id FROM manager_notifications
          WHERE LOWER(manager_email) = LOWER(?) AND LOWER(reportee_email) = LOWER(?)
            AND type = 'comment' AND is_read = 0
        `).get(post.user_email.toLowerCase(), user_email.toLowerCase());
        if (!recentComment) {
          db.prepare('INSERT INTO manager_notifications (manager_email, reportee_email, message, type) VALUES (?, ?, ?, ?)')
            .run(post.user_email.toLowerCase(), user_email.toLowerCase(), commentMsg, 'comment');
          
          if (supabase) {
          try {
            const managerRow = await getUserByEmail(post.user_email);
            const reporteeRow = await getUserByEmail(user_email);
            if (managerRow && reporteeRow) {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              
              await supabase.from('reportee_notifications').insert([{
                user_id: managerRow.id,
                reportee_id: reporteeRow.id,
                reportee_name: reporteeRow.fullname || user_email.split('@')[0],
                assigned_by: reporteeRow.id,
                notification_message: commentMsg,
                notification_type: 'comment',
                is_read: false,
                expires_at: expiresAt
              }]);
            }
          } catch (sbNotifErr) {
            console.warn('Supabase comment notification sync failed:', sbNotifErr.message);
          }
        }
        }
      }
    } catch (e) {
      console.warn('Comment notification error:', e.message);
    }
    
    if (comment_text) {
      const mentionedEmails = extractMentions(comment_text);
      for (const mentionedEmail of mentionedEmails) {
        // Skip if mentioned person is the commenter themselves OR the post owner (they already got a comment notification)
        const postOwner = db.prepare('SELECT user_email FROM social_posts WHERE id = ?').get(post_id);
        const postOwnerEmail = postOwner ? postOwner.user_email.toLowerCase() : '';
        if (mentionedEmail !== user_email.toLowerCase() && mentionedEmail !== postOwnerEmail) {
          try {
            const recent = db.prepare(`
              SELECT id FROM manager_notifications
              WHERE LOWER(manager_email) = LOWER(?) AND LOWER(reportee_email) = LOWER(?) AND type = 'mention' AND is_read = 0
            `).get(mentionedEmail, user_email);
            
            if (!recent) {
              const mentionerName = user_email.split('@')[0];
              const msg = `${mentionerName} tagged you in a comment.`;
              db.prepare('INSERT INTO manager_notifications (manager_email, reportee_email, message, type) VALUES (?, ?, ?, ?)')
                .run(mentionedEmail, user_email, msg, 'mention');
                
              if (supabase) {
                try {
                  const managerRow = await getUserByEmail(mentionedEmail);
                  const reporteeRow = await getUserByEmail(user_email);
                  if (managerRow && reporteeRow) {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    
                    await supabase.from('reportee_notifications').insert([{
                      user_id: managerRow.id,
                      reportee_id: reporteeRow.id,
                      reportee_name: reporteeRow.fullname || user_email.split('@')[0],
                      assigned_by: reporteeRow.id,
                      notification_message: msg,
                      notification_type: 'mention',
                      is_read: false,
                      expires_at: expiresAt
                    }]);
                  }
                } catch (sbNotifErr) {
                  console.warn('Supabase comment mention notification sync failed:', sbNotifErr.message);
                }
              }
            }
          } catch (e) { console.warn('Mention notification error (comment):', e.message); }
        }
      }
    }
    
    res.json({ success: true, comment_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/social/likes', async (req, res) => {
  try {
    const { post_id, user_email } = req.body;
    if (!post_id || !user_email) return res.status(400).json({ error: 'Missing data' });
    
    const emailLower = user_email.toLowerCase();
    const existing = db.prepare('SELECT * FROM social_likes WHERE post_id = ? AND LOWER(user_email) = ?').get(post_id, emailLower);
    let action = 'liked';
    
    if (existing) {
      db.prepare('DELETE FROM social_likes WHERE post_id = ? AND LOWER(user_email) = ?').run(post_id, emailLower);
      action = 'unliked';
    } else {
      db.prepare('INSERT INTO social_likes (post_id, user_email) VALUES (?, ?)').run(post_id, emailLower);
      
      try {
        const post = db.prepare('SELECT user_email FROM social_posts WHERE id = ?').get(post_id);
        if (post && post.user_email.toLowerCase() !== emailLower) {
          const recentLike = db.prepare(`
            SELECT id FROM manager_notifications
            WHERE LOWER(manager_email) = LOWER(?) AND LOWER(reportee_email) = LOWER(?)
              AND type = 'like' AND is_read = 0
          `).get(post.user_email.toLowerCase(), emailLower);
          
          if (!recentLike) {
            const likerName = emailLower.split('@')[0];
            const likeMsg = `${likerName} liked your post.`;
            db.prepare('INSERT INTO manager_notifications (manager_email, reportee_email, message, type) VALUES (?, ?, ?, ?)')
              .run(post.user_email.toLowerCase(), emailLower, likeMsg, 'like');
              
            if (supabase) {
              try {
                const managerRow = await getUserByEmail(post.user_email);
                const reporteeRow = await getUserByEmail(user_email);
                if (managerRow && reporteeRow) {
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + 30);
                  
                  await supabase.from('reportee_notifications').insert([{
                    user_id: managerRow.id,
                    reportee_id: reporteeRow.id,
                    reportee_name: reporteeRow.fullname || user_email.split('@')[0],
                    assigned_by: reporteeRow.id,
                    notification_message: likeMsg,
                    notification_type: 'like',
                    is_read: false,
                    expires_at: expiresAt
                  }]);
                }
              } catch (sbNotifErr) {
                console.warn('Supabase like notification sync failed:', sbNotifErr.message);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Like notification error:', e.message);
      }
    }
    
    if (supabase) {
      try {
        const likeCount = db.prepare('SELECT COUNT(*) as count FROM social_likes WHERE post_id = ?').get(post_id).count;
        await supabase.from('gantec_idea_hub_posts')
          .update({ likes_count: likeCount })
          .eq('id', post_id);
      } catch (sbErr) {
        console.warn('Failed to sync like count to Supabase:', sbErr.message);
      }
    }
    
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/social/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email } = req.body;
    if (!id || !user_email) return res.status(400).json({ error: 'Missing data' });

    const post = db.prepare('SELECT * FROM social_posts WHERE id = ?').get(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_email.toLowerCase() !== user_email.toLowerCase()) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    db.prepare('DELETE FROM social_comments WHERE post_id = ?').run(id);
    db.prepare('DELETE FROM social_likes WHERE post_id = ?').run(id);
    db.prepare('DELETE FROM social_posts WHERE id = ?').run(id);

    if (supabase) {
      try {
        await supabase.from('gantec_idea_hub_posts')
          .update({ is_deleted: true })
          .eq('id', id);
        console.log(`Post soft-deleted in Supabase: ${id}`);
      } catch (sbErr) {
        console.warn('Supabase post delete sync failed:', sbErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/social/stories', (req, res) => {
  try {
    const { user_email, image_url, story_text } = req.body;
    if (!user_email) return res.status(400).json({ error: 'Missing user email' });
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO social_stories (id, user_email, image_url, story_text, expires_at) 
      VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
    `).run(id, user_email, image_url || '', story_text || '');
    
    res.json({ success: true, story_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // ── Ensure Supabase Storage Buckets exist ────────────────────────────────────
  if (supabase) {
    const bucketsNeeded = ['resource-uploads', 'user-uploads'];
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const existingNames = (buckets || []).map(b => b.name);
      for (const bucket of bucketsNeeded) {
        if (!existingNames.includes(bucket)) {
          const { error: cErr } = await supabase.storage.createBucket(bucket, { public: false });
          if (cErr) console.warn(`⚠️ Could not create bucket ${bucket}:`, cErr.message);
          else console.log(`✅ Created storage bucket: ${bucket}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Bucket verification failed:', e.message);
      for (const bucket of bucketsNeeded) {
        try { await supabase.storage.createBucket(bucket, { public: false }); } catch (_) {}
      }
    }
  }

  // ── Create missing leave_balances table in Supabase ───────────────────────────
  if (supabase) {
    try {
      const { error: lbErr } = await supabase.from('leave_balances').select('user_email', { count: 'exact', head: true });
      if (lbErr && lbErr.message && lbErr.message.includes('does not exist')) {
        console.log('⚠️ leave_balances missing in Supabase — please run Supabase/migrations/20260701_create_leave_balances.sql in SQL Editor');
      } else if (!lbErr) {
        console.log('✅ leave_balances table verified in Supabase');
      }
    } catch (e) { console.warn('leave_balances check failed:', e.message); }
  }

  // ── Repair corrupt monthly_feedback selections in Supabase ────────────────────
  // Rows where selections is stored as a character-spread string (numeric keys) get cleaned.
  if (supabase) {
    try {
      const { data: fbRows, error: fbErr } = await supabase
        .from('monthly_feedback').select('id, selections, remarks');
      if (!fbErr && fbRows) {
        const toRepair = fbRows.filter(row => {
          const s = row.selections;
          if (!s || typeof s !== 'object') return false;
          const keys = Object.keys(s);
          return keys.length > 0 && keys.some(k => /^\d+$/.test(k));
        });
        if (toRepair.length > 0) {
          console.log(`🔧 Repairing ${toRepair.length} corrupt feedback rows in Supabase...`);
          for (const row of toRepair) {
            // Reconstruct the original JSON string from the character keys, then re-parse
            const charKeys = Object.keys(row.selections).filter(k => /^\d+$/.test(k)).sort((a, b) => +a - +b);
            const reconstructed = charKeys.map(k => row.selections[k]).join('');
            let cleanSel = {};
            try { cleanSel = JSON.parse(reconstructed); } catch (_) { cleanSel = {}; }
            // Merge any valid named keys that were already correct
            const namedKeys = Object.keys(row.selections).filter(k => !/^\d+$/.test(k));
            namedKeys.forEach(k => { if (typeof row.selections[k] === 'number') cleanSel[k] = row.selections[k]; });
            // Also clean remarks if needed
            let cleanRem = row.remarks || {};
            if (typeof cleanRem === 'string') { try { cleanRem = JSON.parse(cleanRem); } catch (_) { cleanRem = {}; } }
            const { error: repairErr } = await supabase.from('monthly_feedback')
              .update({ selections: cleanSel, remarks: cleanRem }).eq('id', row.id);
            if (repairErr) console.warn(`⚠️ Repair failed for row ${row.id}:`, repairErr.message);
          }
          console.log('✅ Feedback data repair complete.');
        } else {
          console.log('✅ All monthly_feedback selections are clean.');
        }
      }
    } catch (repairE) {
      console.warn('⚠️ Feedback repair skipped:', repairE.message);
    }
  }
  
  // Trigger initial scan to sync local folders with Supabase
  try {
    // Auto-cleanup: Remove ghost records (DB entries with no file on disk)
    const allDocs = db.prepare('SELECT id, folder, filename FROM public_documents').all();
    let ghostsRemoved = 0;
    for (const d of allDocs) {
      const filePath = path.join(UPLOADS_DIR, d.folder, d.filename);
      if (!fs.existsSync(filePath)) {
        db.prepare('DELETE FROM public_documents WHERE id = ?').run(d.id);
        ghostsRemoved++;
      }
    }
    if (ghostsRemoved > 0) console.log(`🧹 Cleaned ${ghostsRemoved} ghost record(s) from public_documents.`);

    const folders = await getFoldersRecursive(UPLOADS_DIR, UPLOADS_DIR);
    console.log(`✅ Startup Sync Complete: Found ${folders.length} folders.`);
  } catch (err) {
    console.error('⚠️ Startup Sync Failed:', err.message);
  }

  // Admin Sync
  await syncAdminEmails();
});

// ─── Hourly Supabase Keep-Alive ──────────────────────────────────────────────
// Pings Supabase with a lightweight query to prevent free-tier project pausing
setInterval(async () => {
  if (supabase) {
    try {
      await supabase.from('users').select('id', { count: 'exact', head: true });
      console.log('✅ Supabase keep-alive ping successful.');
    } catch (e) { console.warn('Supabase keep-alive ping failed:', e.message); }
  }
}, 60 * 60 * 1000); // every 1 hour

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
