import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Normalize
content = content.replace('\r\n', '\n')

# 1. Home centering (partially done by tool, but I'll ensure completeness)
content = content.replace('.home-main {\n  height: 100%;\n  padding: 0;', '.home-main {\n  height: calc(100vh - 70px);\n  padding: 0;')

# 2. Folder sidebar padding
content = content.replace('padding: 24px 16px;\n  overflow-y: auto;', 'padding: 16px;\n  overflow-y: auto;')

# 3. Viewer content padding
content = content.replace('.viewer-content {\n  flex: 1;\n  padding: 40px;', '.viewer-content {\n  flex: 1;\n  padding: 20px 32px 32px;')

# 4. Hero items
content = content.replace('margin-bottom: 28px;', 'margin-bottom: 20px;')

# 5. Uploader layout gaps
content = content.replace('.upload-layout {\n  display: grid;\n  grid-template-columns: 280px 1fr;\n  gap: 20px;', '.upload-layout {\n  display: grid;\n  grid-template-columns: 280px 1fr;\n  gap: 16px;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
