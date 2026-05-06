const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// ── Fix 1: Supabase link deletion using original_name (the title) ──
const old1 = `    // 3. Sync with Supabase
    if (supabase) {
      await supabase.from('resource_uploads').delete().eq('folder', folder).eq('filename', targetHashedName);
      
      // Also check if it's a link and delete from resource_links
      const originalName = docByOrig ? docByOrig.original_name : file;
      if (originalName.endsWith('.ytlink')) {
        const title = originalName.replace('.ytlink', '');
        await supabase.from('resource_links').delete().eq('folder', folder).eq('title', title);
      }
    }`;

const new1 = `    // 3. Sync with Supabase
    if (supabase) {
      await supabase.from('resource_uploads').delete().eq('folder', folder).eq('filename', targetHashedName);
      // If it's a link: original_name stores the actual title
      if (targetHashedName.endsWith('.ytlink') && docByOrig && docByOrig.original_name) {
        await supabase.from('resource_links').delete().eq('folder', folder).eq('title', docByOrig.original_name);
      }
    }`;

// ── Fix 2: Folder delete – add ownership check ──
const old2 = `app.delete('/api/delete-folder', async (req, res) => {
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

    if (supabase) {
      // Supabase table for shared folders is not explicitly tracked, 
      // but we should delete all associated documents
      await supabase.from('resource_uploads').delete().ilike('folder', \`\${folder}%\`);
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const new2 = `app.delete('/api/delete-folder', async (req, res) => {
  try {
    const { folder, email } = req.body;
    if (!folder) return res.status(400).json({ error: 'Folder path required' });
    if (!email) return res.status(400).json({ error: 'Email required for authorization' });

    // Security: prevent deleting root
    if (folder === '.' || folder === './' || folder === '') {
      return res.status(403).json({ error: 'Cannot delete the root directory' });
    }

    // Ownership check: only allow if user owns at least one file in this folder
    const ownedDoc = db.prepare(
      "SELECT id FROM public_documents WHERE folder LIKE ? AND uploader_email = ? LIMIT 1"
    ).get(folder + '%', email);
    if (!ownedDoc) {
      return res.status(403).json({ error: 'Access Denied: You do not own any resources in this folder.' });
    }

    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!await fs.pathExists(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await fs.remove(folderPath);

    if (supabase) {
      await supabase.from('resource_uploads').delete().ilike('folder', \`\${folder}%\`);
      await supabase.from('resource_links').delete().ilike('folder', \`\${folder}%\`);
    }

    db.prepare("DELETE FROM public_documents WHERE folder LIKE ?").run(folder + '%');

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

let changed = 0;

if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('✅ Fix 1 applied: Supabase link deletion updated');
  changed++;
} else {
  console.error('❌ Fix 1 NOT found — pattern mismatch');
}

if (content.includes(old2)) {
  content = content.replace(old2, new2);
  console.log('✅ Fix 2 applied: Folder delete ownership check added');
  changed++;
} else {
  console.error('❌ Fix 2 NOT found — pattern mismatch');
}

if (changed > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n✅ server.js updated with ${changed} fix(es).`);
} else {
  console.log('\n⚠️ No changes were applied.');
}
