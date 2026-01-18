import os
import re

FRONTEND_DIR = f"c:\\Users\\silen\\Documents\\automatiq\\autoart\\frontend\\src"

# Regular expressions to match relative imports of UI components
PATTERNS = [
    # Match imports from atoms, molecules, etc. with varying depths of ../
    # e.g., import { Button } from "../ui/atoms/Button";
    # e.g., import { Badge } from "../../ui/atoms/Badge";
    (r'from ["\'](?:\.\./)+ui/(?:atoms|molecules|common|layout)/(\w+)["\']', r"from '@autoart/ui'"),
    (r'from ["\'](?:\.\./)+atoms/(\w+)["\']', r"from '@autoart/ui'"), # Match direct relative folder access inside UI folder
     # Specific imports like "from '../ui/atoms/Button'" -> "from '@autoart/ui'"
     # But we need to be careful not to break other imports.
     # Let's target the exact structure:
     # src/ui/atoms/* -> @autoart/ui
     # src/ui/molecules/* -> @autoart/ui
]

def refactor_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Replace relative paths to atoms/molecules with @autoart/ui
        # We need a robust regex.
        
        # Strategy:
        # 1. Look for imports ending in /ui/atoms/X, /ui/molecules/X, /atoms/X (if inside ui), etc.
        # 2. Check if the component is actually in @autoart/ui (we assume atoms/molecules are).
        
        # Regex to capture: import { ... } from "..."
        # We'll just target the 'from "..."' part for now.
        
        # Pattern 1: ../ui/atoms/X (arbitrary depth)
        # Use [\.\/]+ to match any combination of . and /, handling ../../ etc.
        content = re.sub(r'from\s+[\'"][\.\/]+/ui/atoms/[^"\']+[\'"]', "from '@autoart/ui'", content)
        # Pattern 2: ../ui/molecules/X
        content = re.sub(r'from\s+[\'"][\.\/]+/ui/molecules/[^"\']+[\'"]', "from '@autoart/ui'", content)
        # Pattern 3: ../atoms/X (when inside ui/layout or similar)
        content = re.sub(r'from\s+[\'"][\.\/]+/atoms/[^"\']+[\'"]', "from '@autoart/ui'", content)
        # Pattern 4: ../molecules/X
        content = re.sub(r'from\s+[\'"][\.\/]+/molecules/[^"\']+[\'"]', "from '@autoart/ui'", content)
        # Pattern 5: Deep relative path directly to atom/molecule folder (e.g. ../../../../ui/atoms/Button)
         
        # Additional cleanup for specific components if needed

        
        # Remove direct imports of files which are now just types or index re-exports if needed, 
        # but the above just changes the source.
        
        # IMPORTANT: Merge generic imports?
        # If we have:
        # import { Button } from '@autoart/ui';
        # import { Badge } from '@autoart/ui';
        # We should ideally merge them, but for now getting the build to work is priority.
        # JS/TS allows multiple imports from same module.

        if content != original_content:
            print(f"Refactoring {filepath}")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    count = 0
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                if refactor_file(os.path.join(root, file)):
                    count += 1
    print(f"Refactored {count} files.")

if __name__ == "__main__":
    main()
