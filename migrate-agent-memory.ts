import { AgentMemory } from './lib/agent-memory';
import * as dotenv from 'dotenv';

// Load .env at entrypoint
dotenv.config();

/**
 * Migrate AGENT.md content into the agent memory system
 */
async function migrate() {
    const memory = new AgentMemory({ debug: true });

    console.log('=== Agent Memory Migration ===\n');

    // Step 1: Create labels
    console.log('Step 1: Creating labels...\n');
    await memory.ensureLabels();

    // Step 2: Port context from AGENT.md
    console.log('\nStep 2: Porting context notes...\n');

    // PowerShell constraint
    await memory.addContext(
        'powershell-constraint',
        'Do NOT use `&&` for command chaining in PowerShell. Use separate `run_command` calls or `;` if absolutely necessary.',
        ['workflow']
    );

    // AutoHelper module structure
    await memory.addContext(
        'autohelper-module-structure',
        'Follow the pattern `autohelper/modules/<name>/` with `router.py`, `service.py`, and `schemas.py`.',
        ['autohelper', 'architecture']
    );

    // Atomic writes pattern
    await memory.addContext(
        'atomic-writes',
        'When generating artifacts, always use the atomic write pattern: write to a temporary file in the same directory, then use `os.replace()` to rename it to the target path.',
        ['autohelper', 'workflow']
    );

    // Task boundaries
    await memory.addContext(
        'task-boundaries',
        'Respect the AutoHelper vs AutoArt boundary. AutoHelper exposes capabilities via API; AutoArt consumes them via `frontend/src/api`.',
        ['architecture']
    );

    // API clients pattern
    await memory.addContext(
        'api-clients-pattern',
        'Keep the generic HTTP client (`autohelperClient.ts`) separate from domain-specific API methods. Place domain methods in `frontend/src/api/<domain>.ts`.',
        ['autoart', 'architecture']
    );

    // State management
    await memory.logLearning(
        'NEVER trigger state updates (e.g., setOffset) directly in the component render body. Always wrap side effects or state synchronizations in useEffect to prevent render loops.',
        ['autoart', 'ui']
    );

    // Environment safety
    await memory.addContext(
        'environment-safety',
        'Utilities in `shared/` must be environment-agnostic. Guard references to browser-specific globals like `crypto.randomUUID` to ensure compatibility with Node.js/Jest environments.',
        ['autoart', 'architecture']
    );

    // UI defaults
    await memory.logLearning(
        'Do not hardcode local Windows paths (e.g., C:/Users/...) in user prompts or defaults. Use generic placeholders or empty strings.',
        ['autoart', 'ui']
    );

    // UI aesthetics - no blue
    await memory.addContext(
        'ui-color-palette',
        'Do NOT use default blue colors (e.g., bg-blue-600) for UI elements. Use Slate (neutrals), Amber (actions/attention), or Emerald (success/primary) per the design system.',
        ['autoart', 'ui']
    );

    // Icons
    await memory.addContext(
        'ui-icons',
        'Use radix-ui/react-icons or lucide-react consistently. Do not mix icon sets arbitrarily.',
        ['autoart', 'ui']
    );

    // Component naming
    await memory.addContext(
        'component-naming',
        `Component naming conventions:
- **Page**: Route-level in pages/, thin wrapper rendering a View/Surface
- **View**: Reusable visual in ui/composites/, ui/layout/, ui/drawer/views/
- **Surface**: Self-contained workbench in surfaces/
- **Panel**: Dockview-compatible wrapper in ui/panels/`,
        ['autoart', 'architecture']
    );

    // Namespaced view modes
    await memory.logLearning(
        'Never use a single shared viewMode state for multiple panels. Each surface needs its own namespaced state (projectViewMode, fieldsViewMode, recordsViewMode) to prevent cross-surface interference.',
        ['autoart', 'ui']
    );

    // Collection mode
    await memory.addContext(
        'collection-mode',
        `CollectionModeProvider enables selecting items for export:
- fieldsViewMode === 'aggregate' triggers collection mode
- Switching to Instances tab should stop collecting
- Use useCollectionModeOptional() for safe access outside the provider`,
        ['autoart', 'workflow']
    );

    // Radix-style tables
    await memory.addContext(
        'radix-table-styling',
        `For data grids:
- Sticky headers: bg-slate-50, border-b border-slate-200
- Row hover: hover:bg-slate-50, selected: bg-indigo-50
- Status badges: rounded-full with border (bg-emerald-50 text-emerald-700 border-emerald-200)
- IDs: font-mono text-xs text-slate-400
- Include toolbar with search, filter, action buttons`,
        ['autoart', 'ui']
    );

    // DataTable refactoring
    await memory.createIssue(
        'Refactor DataTable for configurable rows',
        {
            description: `Implement variable row heights and text wrapping:
1. Add rowHeight?: number | 'auto' and wrapText?: boolean props
2. Pass props to TableRow and EditableCell
3. Remove h-11/h-8 when rowHeight === 'auto'
4. Replace truncate with whitespace-normal break-words when wrapText`,
            priority: 2,
            type: 'feature',
            labels: ['autoart', 'ui'],
        }
    );

    console.log('\n=== Migration complete! ===');
    console.log('Check https://github.com/ok-very/agent-memory/issues');
}

migrate().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
