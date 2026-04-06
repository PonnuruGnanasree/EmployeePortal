const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
fs.ensureDirSync(UPLOADS_DIR);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
    cb(null, `${base}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// GET /api/folders – Return folder tree with files
app.get('/api/folders', async (req, res) => {
  try {
    await fs.ensureDir(UPLOADS_DIR);
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    const folders = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(UPLOADS_DIR, entry.name);
        const files = await fs.readdir(folderPath);
        const pdfFiles = [];

        for (const file of files) {
          if (file.toLowerCase().endsWith('.pdf')) {
            const filePath = path.join(folderPath, file);
            const stat = await fs.stat(filePath);
            pdfFiles.push({
              name: file,
              size: stat.size,
              uploadedAt: stat.mtime
            });
          }
        }

        folders.push({
          name: entry.name,
          files: pdfFiles
        });
      }
    }

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

    const safe = name.trim().replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
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
  });
});

// GET /api/files/:folder/:filename – Serve PDF inline
app.get('/api/files/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, folder, filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:folder/:filename – Delete a file
app.delete('/api/files/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, folder, filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    await fs.remove(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Gantec Document Finder running at http://localhost:${PORT}\n`);
});
