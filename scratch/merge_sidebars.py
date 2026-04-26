import sys
import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the folder sidebar content
    sidebar_match = re.search(r'(<aside class="folder-sidebar" id="sidebar">)(.*?)(</aside>)', content, re.DOTALL)
    if not sidebar_match:
        print(f"folder-sidebar not found in {filepath}")
        return

    folder_content = sidebar_match.group(2)
    
    # Remove it from the original place
    content = content.replace(sidebar_match.group(0), '')

    # Also remove "has-folder-sidebar" from app-main
    content = content.replace('class="app-main has-folder-sidebar"', 'class="app-main"')

    # Inject it into app-sidebar
    inject_target = '</nav>\n    </aside>'
    if inject_target not in content:
        # try without strict newline
        inject_target_match = re.search(r'</nav>\s*</aside>', content)
        if inject_target_match:
            inject_target = inject_target_match.group(0)
    
    if inject_target in content:
        wrapped_folders = f'</nav>\n      <div id="sidebar" class="merged-folder-section">\n{folder_content}      </div>\n    </aside>'
        content = content.replace(inject_target, wrapped_folders, 1)
    else:
        print(f"sidebar-nav NOT FOUND in {filepath}")
        return

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Successfully processed {filepath}")

process_file(r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\viewer.html')
process_file(r'c:\Users\HP\Downloads\Antigravtiy_updated_v2 (1)\ant_fix\public\document-locker.html')
