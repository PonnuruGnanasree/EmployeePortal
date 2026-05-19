const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const oldSnippet = `<a href="company-culture.html" class="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="link-text">Company Culture</span>
        </a>`;

const oldSnippetActive = `<a href="company-culture.html" class="sidebar-link active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="link-text">Company Culture</span>
        </a>`;

const newSnippet = `<div class="sidebar-dropdown">
          <a href="#" class="sidebar-link sidebar-dropdown-trigger" id="nav-culture">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="link-text">Company Culture</span>
          </a>
          <div class="sidebar-submenu">
            <a href="company-culture.html" class="submenu-link">Culture Overview</a>
            <a href="employee-support.html" class="submenu-link">Employee Support</a>
          </div>
        </div>`;

const newSnippetActive = `<div class="sidebar-dropdown open">
          <a href="#" class="sidebar-link sidebar-dropdown-trigger active" id="nav-culture">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="link-text">Company Culture</span>
          </a>
          <div class="sidebar-submenu">
            <a href="company-culture.html" class="submenu-link active">Culture Overview</a>
            <a href="employee-support.html" class="submenu-link">Employee Support</a>
          </div>
        </div>`;

let updatedCount = 0;

for (const file of htmlFiles) {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Normalize newlines in case there are mixed \r\n and \n
  content = content.replace(/\r\n/g, '\n');
  let search1 = oldSnippet.replace(/\r\n/g, '\n');
  let search2 = oldSnippetActive.replace(/\r\n/g, '\n');
  
  if (content.includes(search1)) {
    content = content.replace(search1, newSnippet);
  } else if (content.includes(search2)) {
    content = content.replace(search2, newSnippetActive);
  }
  
  // Also try with flexible whitespace if exact match fails
  if (content === originalContent.replace(/\r\n/g, '\n')) {
     const regexActive = /<a\s+href="company-culture\.html"\s+class="sidebar-link active">[\s\S]*?<\/a>/g;
     const regexInactive = /<a\s+href="company-culture\.html"\s+class="sidebar-link">[\s\S]*?<\/a>/g;
     if (regexActive.test(content)) {
         content = content.replace(regexActive, newSnippetActive);
     } else if (regexInactive.test(content)) {
         content = content.replace(regexInactive, newSnippet);
     }
  }

  if (content !== originalContent.replace(/\r\n/g, '\n')) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
    console.log('Updated', file);
  }
}

console.log('Done updating sidebars. Total updated:', updatedCount);
