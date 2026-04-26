import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Force strict vertical centering in home
if '.home-main {\n  height: 100%;' in content:
    content = content.replace('.home-main {\n  height: 100%;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;', '.home-main {\n  height: calc(100vh - 70px);\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;')
if '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);' in content:
    content = content.replace('.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  display: flex;\n  flex-direction: column;')

# 2. Fix Document Locker Sidebar Gap (h2 in sidebar has margin)
content = content.replace('h2.sidebar-title {', 'h2.sidebar-title {\n  margin: 0;')
content = content.replace('.sidebar-header {\n  margin: 0 0 16px;\n  padding: 16px 12px 0;\n}', '.sidebar-header {\n  margin: 0 0 16px;\n  padding: 0 12px 0;\n}')

# 3. Force completely hidden overflow on app-main to remove the scrollbars
content = content.replace('.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  display: flex;\n  flex-direction: column;\n  /* Fixed height */\n  overflow-y: auto;', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  display: flex;\n  flex-direction: column;\n  /* Fixed height */\n  overflow-y: hidden;')
content = content.replace('.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow: hidden;')

content += "\n::-webkit-scrollbar {\n  width: 0px;\n}\n"

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
