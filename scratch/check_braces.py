import sys

filepath = r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\css\styles.css'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
open_braces = 0
for i, line in enumerate(lines):
    open_braces += line.count('{')
    open_braces -= line.count('}')
    if open_braces < 0:
        print(f"Error: unmatched closing brace at line {i+1}: {line}")
        open_braces = 0

print(f"Remaining open braces: {open_braces}")
