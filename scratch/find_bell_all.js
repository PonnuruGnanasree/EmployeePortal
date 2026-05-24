const fs = require('fs');
const path = require('path');

const publicDir = 'public';
const files = fs.readdirSync(publicDir);

console.log("Searching for 'reportee-bell' in all HTML files...");
files.forEach(file => {
  if (file.endsWith('.html')) {
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
    if (content.includes('reportee-bell')) {
      console.log(`Found in: ${file}`);
    }
  }
});
