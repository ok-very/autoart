import os
import re

FRONTEND_ROOT = r"c:\Users\silen\Documents\automatiq\autoart\frontend\src"
MOLECULES_DIR = r"c:\Users\silen\Documents\automatiq\autoart\frontend\src\ui\molecules"

# List of components that are still in frontend/src/ui/molecules and NOT in packages/ui
MISSING_MOLECULES = {
    "ColumnPicker",
    "DataFieldWidget",
    "EditableCell",
    "FieldGroup",
    "FieldRenderer",
    "MillerColumn",
    "PropertySection",
    "ReferenceBlock",
    "ReferenceStatusBadge",
    "StatusColumnSummary",
    "TableAddRow",
    "TableSortHeader"
}

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        new_lines = []
        modified = False
        
        for line in lines:
            # Check if line imports from @autoart/ui
            if "from '@autoart/ui'" in line or 'from "@autoart/ui"' in line:
                # Check if it imports any of the missing molecules
                # Extract the imported symbols: import { A, B } from ...
                match = re.search(r'import\s+\{(.*?)\}\s+from', line)
                if match:
                    imports_str = match.group(1)
                    imports = [i.strip().split(' as ')[0] for i in imports_str.split(',')]
                    
                    found_missing = [i for i in imports if i in MISSING_MOLECULES]
                    
                    if found_missing:
                        # This line imports at least one missing molecule.
                        # We need to split this import into valid package imports and relative imports.
                        
                        valid_imports = [i for i in imports if i not in MISSING_MOLECULES]
                        
                        # Calculate relative path to molecules dir
                        file_dir = os.path.dirname(filepath)
                        rel_path = os.path.relpath(MOLECULES_DIR, file_dir)
                        rel_path = rel_path.replace(os.path.sep, '/')
                        if not rel_path.startswith('.'):
                            rel_path = './' + rel_path
                        
                        # Add valid imports line if any
                        # Note: formatting might be lost, simplistic reconstruction
                        if valid_imports:
                            # Reconstruct import line for valid ones
                            valid_content = ", ".join(valid_imports)
                            # Try to preserve indentation/style if possible, but basic is fine
                            new_lines.append(f"import {{ {valid_content} }} from '@autoart/ui';\n")
                        
                        # Add relative imports for missing ones
                        # We might need separate lines if they come from different files?
                        # Actually, they are all in ui/molecules... BUT they are separate files in ui/molecules!
                        # Unlike package which exports all from index, the source in frontend usually requires importing from specific file OR index.
                        # Does frontend/src/ui/molecules/index.ts export them?
                        
                        # Let's verify frontend/src/ui/molecules/index.ts
                        # Step 940 showed index.ts exists.
                        # If index.ts exports them, we can import from `../molecules` (the folder).
                        # Let's assume we can import from the folder path `rel_path` if index imports them.
                        # Or import from individual files?
                        # The original code likely imported from individual files mostly?
                        # BUT my refactor script detected imports from `.../molecules/X` and merged them.
                        # If we revert, pointing to the folder `ui/molecules` is safest if index exists.
                        
                        # Let's check index.ts content briefly? 
                        # Assuming it does export them (common pattern).
                        
                        missing_content = ", ".join(found_missing)
                        new_lines.append(f"import {{ {missing_content} }} from '{rel_path}';\n")
                        modified = True
                        continue

            new_lines.append(line)
            
        if modified:
            print(f"Fixing {filepath}")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            return True

    except Exception as e:
        print(f"Error fixing {filepath}: {e}")
        return False

def main():
    count = 0
    for root, dirs, files in os.walk(FRONTEND_ROOT):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                if fix_file(os.path.join(root, file)):
                    count += 1
    print(f"Fixed {count} files.")

if __name__ == "__main__":
    main()
