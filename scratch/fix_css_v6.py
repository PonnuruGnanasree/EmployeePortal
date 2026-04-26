import sys
import os

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'

with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# Fix app-layout
content = content.replace('.app-layout {\n  display: flex;\n  height: 100vh;\n  padding-top: 70px;\n  box-sizing: border-box;\n}', '.app-layout {\n  display: block;\n  height: 100vh;\n  padding-top: 70px;\n  box-sizing: border-box;\n}')

# Fix app-main margin-top and flex
content = content.replace('.app-main {\n  flex: 1;\n  margin-left: 280px;\n  margin-top: 71px;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}')
content = content.replace('.app-main {\n  flex: 1;\n  margin-left: 280px;\n  margin-top: 70px;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}')
content = content.replace('.app-main {\n  flex: 1;\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}', '.app-main {\n  margin-left: 280px;\n  margin-top: 0;\n  height: calc(100vh - 70px);\n  /* Fixed height */\n  overflow-y: auto;\n  /* Scrollable area */\n  position: relative;\n  z-index: 1;\n}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
