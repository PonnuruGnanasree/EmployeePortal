const fs = require('fs');
const content = fs.readFileSync('public/home.html', 'utf8');
const lines = content.split('\n');

console.log("Searching for 'reportee-bell' or 'reportee-count' in insights.html...");
lines.forEach((line, idx) => {
  if (line.includes('reportee-bell') || line.includes('reportee-count')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
