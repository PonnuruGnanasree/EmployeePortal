import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Fix Home Centering
content = content.replace('.home-main {\n  height: calc(100vh - 70px);\n  padding: 0;', '.home-main {\n  height: calc(100vh - 70px);\n  padding: 0;\n  padding-bottom: 0; /* Removed push-up offset */')
content = content.replace('padding-bottom: 60px;', 'padding-bottom: 0;')

# 2. Fix Sidebar/Content Top Gaps
content = content.replace('padding: 16px;\\n  overflow-y: auto;', 'padding: 0 16px 16px;\\n  overflow-y: auto;') # folder-sidebar
content = content.replace('.viewer-content {\n  flex: 1;\n  padding: 20px 32px 32px;', '.viewer-content {\n  flex: 1;\n  padding: 0 32px 32px;')
content = content.replace('.upload-main {\n  position: relative;\n  z-index: 1;\n  padding: 20px 32px 40px;', '.upload-main {\n  position: relative;\n  z-index: 1;\n  padding: 0 32px 40px;')

# 3. Prevent Global Scroll
content = content.replace('height: 100vh;\n  overflow: hidden;', 'height: 100vh;\n  overflow: hidden;\n  position: fixed;\n  width: 100%;')

# 4. Global Sidebar top padding
content = content.replace('.app-sidebar {\n  width: 280px;\n  background: var(--surface);\n  border-right: 1px solid var(--border);\n  display: flex;\n  flex-direction: column;\n  position: fixed;\n  top: 70px;\n  left: 0;\n  bottom: 0;\n  z-index: 1000;\n  padding: 24px 16px;', '.app-sidebar {\n  width: 280px;\n  background: var(--surface);\n  border-right: 1px solid var(--border);\n  display: flex;\n  flex-direction: column;\n  position: fixed;\n  top: 70px;\n  left: 0;\n  bottom: 0;\n  z-index: 1000;\n  padding: 0 16px 16px;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
