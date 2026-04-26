import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Reduce viewer-main padding
content = content.replace('.viewer-main {\n  flex: 1;\n  overflow-y: auto;\n  padding: 28px 32px;', '.viewer-main {\n  flex: 1;\n  overflow-y: auto;\n  padding: 16px 24px;')

# 2. Reduce viewer-toolbar margin
content = content.replace('.viewer-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 24px;', '.viewer-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 12px;')

# 3. Sidebar header margin
content = content.replace('.sidebar-header {\n  margin-bottom: 32px;', '.sidebar-header {\n  margin-bottom: 16px;')

# 4. Global body scroll prevention
content = content.replace('body {\n  font-family: var(--font);\n  background: var(--bg);\n  color: var(--text-primary);\n  min-height: 100vh;\n  overflow-x: hidden;', 'body {\n  font-family: var(--font);\n  background: var(--bg);\n  color: var(--text-primary);\n  height: 100vh;\n  overflow: hidden;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
