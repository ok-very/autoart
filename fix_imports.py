#!/usr/bin/env python3
"""
Fix incorrect @autoart/ui imports by restoring local imports for components
that exist in frontend/src/ui/* but NOT in packages/ui/
"""

import os
import re

FRONTEND_DIR = r"c:\Users\silen\Documents\automatiq\autoart\frontend\src"

# Components that should remain as LOCAL imports (NOT from @autoart/ui)
# These exist in frontend/src/ui/* but not in packages/ui/
LOCAL_COMPONENTS = {
    # From frontend/src/ui/molecules/
    'DataFieldWidget': 'ui/molecules/DataFieldWidget',
    'FieldRenderer': 'ui/molecules/FieldRenderer', 
    'FieldRendererCallbacks': 'ui/molecules/FieldRenderer',
    'EditableCell': 'ui/molecules/EditableCell',
    'ColumnPicker': 'ui/molecules/ColumnPicker',
    'FieldGroup': 'ui/molecules/FieldGroup',
    'MillerColumn': 'ui/molecules/MillerColumn',
    'PropertySection': 'ui/molecules/PropertySection',
    'ReferenceBlock': 'ui/molecules/ReferenceBlock',
    'ReferenceStatusBadge': 'ui/molecules/ReferenceStatusBadge',
    'StatusColumnSummary': 'ui/molecules/StatusColumnSummary',
    'TableAddRow': 'ui/molecules/TableAddRow',
    'TableSortHeader': 'ui/molecules/TableSortHeader',
    
    # Types from frontend/src/ui/molecules/
    'DataFieldKind': 'ui/molecules/DataFieldWidget',
}

def get_relative_path(from_file, to_module):
    """Calculate relative import path from one file to another module."""
    from_dir = os.path.dirname(from_file)
    from_parts = from_dir.replace(FRONTEND_DIR + os.sep, '').split(os.sep)
    to_parts = to_module.split('/')
    
    # Calculate how many levels up we need to go
    up_levels = len(from_parts)
    
    # Build relative path
    if up_levels == 0:
        rel_path = './' + '/'.join(to_parts)
    else:
        rel_path = '../' * up_levels + '/'.join(to_parts)
    
    return rel_path

def fix_file(filepath):
    """Fix imports in a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        modified = False
        
        # Find all imports from @autoart/ui
        # Pattern: import { X, Y, type Z } from '@autoart/ui';
        import_pattern = r"import\s*\{([^}]+)\}\s*from\s*['\"]@autoart/ui['\"];"
        
        matches = list(re.finditer(import_pattern, content))
        
        for match in reversed(matches):  # Process in reverse to preserve positions
            full_match = match.group(0)
            imports_str = match.group(1)
            
            # Parse individual imports
            imports = [i.strip() for i in imports_str.split(',')]
            
            local_imports = {}  # target_module -> [imports]
            pkg_imports = []     # stay in @autoart/ui
            
            for imp in imports:
                if not imp:
                    continue
                    
                # Handle 'type X' syntax
                is_type = imp.startswith('type ')
                name = imp.replace('type ', '').strip()
                
                if name in LOCAL_COMPONENTS:
                    target = LOCAL_COMPONENTS[name]
                    if target not in local_imports:
                        local_imports[target] = []
                    local_imports[target].append(imp)
                else:
                    pkg_imports.append(imp)
            
            if local_imports:
                modified = True
                new_imports = []
                
                # Keep @autoart/ui imports if any remain
                if pkg_imports:
                    new_imports.append(f"import {{ {', '.join(pkg_imports)} }} from '@autoart/ui';")
                
                # Add local imports
                for target_module, imps in local_imports.items():
                    rel_path = get_relative_path(filepath, target_module)
                    new_imports.append(f"import {{ {', '.join(imps)} }} from '{rel_path}';")
                
                # Replace the original import
                content = content[:match.start()] + '\n'.join(new_imports) + content[match.end():]
        
        if modified:
            print(f"Fixed: {filepath}")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
            
        return False
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    count = 0
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                filepath = os.path.join(root, file)
                if fix_file(filepath):
                    count += 1
    
    print(f"\nFixed {count} files.")

if __name__ == "__main__":
    main()
