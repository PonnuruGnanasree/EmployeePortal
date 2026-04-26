const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\HP\\Downloads\\Antigravtiy_updated_v2 (1)\\ant_fix\\public\\css\\styles.css';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error and adjust spacing
const oldSection = /\.search-icon \{[\s\S]*?pointer-events: none;[\s\S]*?\}/;
const newSection = `.search-icon {
  display: flex;
  position: absolute;
  left: 16px;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}`;

content = content.replace(oldSection, newSection);

// Update search input spacing
const oldInput = /\.search-input \{[\s\S]*?padding: 9px 14px 9px 38px;/;
const newInput = `.search-input {
  padding: 10px 16px 10px 48px;`;

content = content.replace(oldInput, newInput);

fs.writeFileSync(filePath, content);
console.log('Successfully updated styles.css');
