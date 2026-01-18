#Todo

##Feature list

Workflow view" 
    - crtl - click or similar to select multiple subprocesses and compile tables in viewport in selection order.
    - allow reordering, copying and deletion of subprocesses in left drawer with semantically mapped UI icon-buttons


Record Inspector
    @Assignee chip should support multiple users

User Accounts
    Create sign out option, account settings

Email Ingestion (Large feature)
    Add API features that can create per-record UUID addresses available to e-mail.
    Create communications tab in record inspector to track and log incoming and internal communications
    
Email Notices
    Create API endpoints for sending messages to user emails such as an email draft or daily digest. Should be integrated to templating engine.

Templating (Large Feature)

    Create an output engine to compile fields. Will work like a highlighter view, where you are able to activate a special state and then go through the project views and flag every field that will be compiled. It will have an output module that will determine the output formatting (injection into a spreadsheet or document). These output modules can use the interface to map or upload js/py scripts.

Board Sync Settings Panel (Medium Feature)
    Per-board settings drawer for Monday.com connector sync:
    - Toggle sync on/off for imported templates
    - View linked template records and their sync status
    - Manual sync trigger to pull updates from Monday
    - Unsync option to detach local templates from external source
    Context: Template singleton records imported from Monday need lifecycle management.
    See: implementation_plan.md for template singleton architecture.

Floating Search / Command Palette (Medium Feature)
    A headless, context-aware search component that can be invoked globally:

    Phase 1: Floating Project Selector
    - Trigger via hotkey (Cmd+K or Cmd+P)
    - Shows searchable list of projects
    - Selecting a project sets activeProjectId and loads it
    - Dismisses on Escape or click-outside
    - Can use existing RecordSearchCombobox patterns

    Phase 2: Universal Search
    - Search across projects, records, definitions, actions
    - Return results grouped by type
    - Each result type has its own action (navigate, select, open panel)
    - Similar to VSCode command palette or Spotlight

    Phase 3: Command Palette
    - Add command actions (not just search results)
    - "Create new project", "Open settings", "Switch view mode"
    - Keyboard navigation through results
    - Extensible command registry

    Context: No global search UI exists currently. RecordSearchCombobox shows
    the pattern but is scoped to record selection only. The infrastructure for
    search exists in backend (search.ts module) but frontend needs a floating
    invokable component.

    Related: useSearch() hook in api/hooks/search.ts

