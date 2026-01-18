import os
import re

ROOT_DIR = r"c:\Users\silen\Documents\automatiq\autoart\frontend\src"

# Regex patterns to find and replace
PATTERNS = [
    # Match imports from atoms (e.g., ../atoms/Button, ../../ui/atoms/Button, ./atoms)
    (r"from\s+['\"](\.|/)+/atoms/?[a-zA-Z0-9_]*['\"]", "from '@autoart/ui'"),
    (r"from\s+['\"](\.|/)+/ui/atoms/?[a-zA-Z0-9_]*['\"]", "from '@autoart/ui'"),
    
    # Match imports from extracted molecules (Menu, SegmentedControl, TagsInput)
    (r"from\s+['\"](\.|/)+/molecules/Menu['\"]", "from '@autoart/ui'"),
    (r"from\s+['\"](\.|/)+/molecules/SegmentedControl['\"]", "from '@autoart/ui'"),
    (r"from\s+['\"](\.|/)+/molecules/TagsInput['\"]", "from '@autoart/ui'"),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pattern, replacement in PATTERNS:
        new_content = re.sub(pattern, replacement, new_content)

    if new_content != content:
        print(f"Updating {filepath}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
