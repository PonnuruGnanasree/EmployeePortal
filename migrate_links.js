const fs = require('fs-extra');
const path = require('path');
const db = require('better-sqlite3')('data/database.sqlite');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function migrateLinks() {
  console.log('Fetching YouTube links from database...');
  const links = db.prepare("SELECT * FROM public_documents WHERE original_name LIKE '%.ytlink'").all();
  console.log(`Found ${links.length} links.`);

  for (const link of links) {
    const filePath = path.join(UPLOADS_DIR, link.folder, link.filename);
    console.log(`Checking: ${filePath}`);
    if (fs.existsSync(filePath)) {
      try {
        // Read the JSON content of the .ytlink (even if it's named .bin now)
        const content = await fs.readJson(filePath);
        console.log(`Syncing link: ${content.title}...`);
        
        await supabase.from('resource_links').upsert({
          title: content.title,
          url: content.url,
          folder: link.folder
        }, { onConflict: 'url' }); // Assuming URL is unique for links
        
        console.log('Success.');
      } catch (e) {
        console.error(`Failed to sync link ${link.original_name}:`, e.message);
      }
    }
  }
  console.log('Link Migration Complete.');
}

migrateLinks().catch(console.error);
