const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

console.log("Searching for 'getUserByEmail' in server.js...");
lines.forEach((line, idx) => {
  if (line.includes('getUserByEmail')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});

console.log("\nSearching for '/api/notifications' in server.js...");
lines.forEach((line, idx) => {
  if (line.includes('/api/notifications')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
