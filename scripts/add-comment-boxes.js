const fs = require('fs');
const path = require('path');

// Path to the HTML file
const htmlPath = path.join(__dirname, '..', 'public', 'monthly-feedback.html');
let content = fs.readFileSync(htmlPath, 'utf8');

// Remove any existing comment box markers or comment-box divs
content = content
  .replace(/<!--\s*Comment Box Start\s*-->/g, '')
  .replace(/<!--\s*Comment Box End\s*-->/g, '')
  .replace(/<div class="comment-box">.*?<\/div>/gs, '');

// Split into lines for processing
const lines = content.split(/\r?\n/);
let result = [];
let inTable = false;

lines.forEach((line, idx) => {
  const trimmed = line.trim();
  // Track table entry and exit
  if (/^<table\b/i.test(trimmed)) {
    inTable = true;
  }
  if (/^<\/table>/i.test(trimmed)) {
    inTable = false;
  }

  result.push(line);

  // If this line is a closing </tr> and we are inside a table,
  // and the next non‑empty line is a closing </table>, insert comment after this </tr>
  if (inTable && /^<\/tr>/i.test(trimmed)) {
    // Find next non‑empty line
    let nextIdx = idx + 1;
    while (nextIdx < lines.length && lines[nextIdx].trim() === '') {
      nextIdx++;
    }
    if (nextIdx < lines.length && /^<\/table>/i.test(lines[nextIdx].trim())) {
      const indent = line.match(/^\s*/)[0] + '  ';
      result.push(`${indent}<!-- Comment Box -->`);
    }
  }
});

// Write the cleaned content back to the file
fs.writeFileSync(htmlPath, result.join('\n'), 'utf8');
console.log('Added comment boxes below last row of each table in', htmlPath);
