import re
import os

files = [
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\home.html',
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\viewer.html',
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\document-locker.html'
]

for fn in files:
    with open(fn, 'r', encoding='utf-8') as f:
        c = f.read()

    # Avoid double span wrapping
    if '<span class="link-text">Home</span>' not in c:
        c = re.sub(r'</svg>(\s*)Home', r'</svg>\1<span class="link-text">Home</span>', c)
    if '<span class="link-text">Training Resources</span>' not in c:
        c = re.sub(r'</svg>(\s*)Training Resources', r'</svg>\1<span class="link-text">Training Resources</span>', c)
    if '<span class="link-text">Document Locker</span>' not in c:
        c = re.sub(r'</svg>(\s*)Document Locker', r'</svg>\1<span class="link-text">Document Locker</span>', c)

    with open(fn, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Wrapped link-text in {fn}")
