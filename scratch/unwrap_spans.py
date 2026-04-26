import os
import re

def unwrap_text_in_spans(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the sidebar-nav section
    nav_match = re.search(r'(<nav class="sidebar-nav">)(.*?)(</nav>)', content, re.DOTALL)
    if not nav_match:
        return

    nav_body = nav_match.group(2)
    
    # We want to turn <a ...><svg>.../svg>\n          <span>Home</span>\n        </a>
    # back into <a ...><svg>.../svg>\n          Home\n        </a>
    
    def repl(m):
        attr = m.group(1)
        svg = m.group(2)
        text = m.group(3)
        
        # Remove <span> and </span>
        clean_text = text.replace('<span>', '').replace('</span>', '')
            
        return f'<a {attr}>{svg}          {clean_text.strip()}\n        </a>'

    # pattern to match the span wrappers
    pattern = re.compile(r'<a\s+([^>]*href="[^"]*")[^>]*>(.*?svg>)\s*<span>(.*?)</span>\s*</a>', re.DOTALL)
    new_nav_body = pattern.sub(repl, nav_body)
    
    new_nav_body = re.sub(r'(<a\s+[^>]*class="[^"]*sidebar-dropdown-trigger[^"]*"[^>]*>)(.*?svg>)\s*<span>(.*?)</span>\s*</a>', repl, new_nav_body, flags=re.DOTALL)

    content = content.replace(nav_body, new_nav_body)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {filepath}")

files = [
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\home.html',
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\viewer.html',
    r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\document-locker.html'
]

for f in files:
    if os.path.exists(f):
        unwrap_text_in_spans(f)
