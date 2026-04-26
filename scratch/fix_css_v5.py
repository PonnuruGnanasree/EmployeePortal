import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Fixing the double-offset gap in sidebars
# Remove margin-top from app-main, put it on app-layout
content = content.replace('.app-layout {\n  display: flex;\n  min-height: 100vh;\n}', '.app-layout {\n  display: flex;\n  height: 100vh;\n  padding-top: 70px;\n  box-sizing: border-box;\n}')
content = content.replace('.app-main {\n  flex: 1;\n  margin-left: 280px;\n  margin-top: 70px;', '.app-main {\n  flex: 1;\n  margin-left: 280px;\n  margin-top: 0;')

# 2. Fix sticky sidebar top position after layout change
content = content.replace('.folder-sidebar {\n  width: 300px;\n  border-right: 1px solid var(--border);\n  height: calc(100vh - 70px);\n  position: sticky;\n  top: 70px;', '.folder-sidebar {\n  width: 300px;\n  border-right: 1px solid var(--border);\n  height: 100%;\n  position: relative;\n  top: 0;')

# 3. Ensure no padding gaps on top of sidebar labels
content = content.replace('padding: 16px;', 'padding: 0 16px 16px;')

# 4. Correcting home-main height
content = content.replace('.home-main {\n  height: calc(100vh - 70px);', '.home-main {\n  height: 100%;')

# 5. Fix Body Scroll
content = content.replace('height: 100vh;\n  overflow: hidden;\n  position: fixed;\n  width: 100%;', 'height: 100vh;\n  overflow: hidden;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
