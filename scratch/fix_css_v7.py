import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

content = content.replace('.sidebar-title {\n  font-size: 1.1rem;', '.sidebar-title {\n  margin: 0;\n  font-size: 1.1rem;')
content = content.replace('.sidebar-header {\n  margin-bottom: 16px;\n  padding: 0 12px;\n}', '.sidebar-header {\n  margin: 0 0 16px;\n  padding: 16px 12px 0;\n}')

# Fix viewer heading margin
content = content.replace('.viewer-heading {\n  font-size: 1.4rem;', '.viewer-heading {\n  margin: 0;\n  font-size: 1.4rem;')

# Fix gap on the left of viewer content:
content = content.replace('.viewer-content {\n  flex: 1;\n  padding: 0 32px 32px;\n}', '.viewer-content {\n  flex: 1;\n  padding: 16px 32px 32px;\n}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
