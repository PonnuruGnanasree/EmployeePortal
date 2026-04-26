import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace sidebar
old_sidebar = """.app-sidebar {
  width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1200;
  padding: 32px 16px 24px;
}"""

new_sidebar = """.app-sidebar {
  width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 70px;
  left: 0;
  bottom: 0;
  z-index: 1000;
  padding: 24px 16px;
}"""

# Replace header
old_header = """.app-header {
  position: fixed;
  top: 0;
  left: 280px;
  right: 0;
  height: 70px;
  background: #ffffff; /* Solid white */
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); /* Subtle shadow */
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 40px;
  z-index: 1100;
}"""

new_header = """.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 1100;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.header-logo {
  font-size: 1.5rem;
}

.header-title {
  font-weight: 800;
  color: var(--primary);
  font-size: 1.1rem;
}"""

# Normalize line endings for replacement
content = content.replace('\r\n', '\n')
old_sidebar = old_sidebar.replace('\r\n', '\n')
new_sidebar = new_sidebar.replace('\r\n', '\n')
old_header = old_header.replace('\r\n', '\n')
new_header = new_header.replace('\r\n', '\n')

if old_sidebar in content:
    content = content.replace(old_sidebar, new_sidebar)
    print("Sidebar replaced")
else:
    print("Sidebar not found")

if old_header in content:
    content = content.replace(old_header, new_header)
    print("Header replaced")
else:
    print("Header not found")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
