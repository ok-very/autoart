export type Selection =
  | { type: 'node'; id: string }
  | { type: 'record'; id: string }
  | { type: 'definition'; id: string }
  | { type: 'project'; id: string }
  | { type: 'action'; id: string }
  | { type: 'email'; id: string }
  | { type: 'import_item'; id: string }
  | null;

/** Valid inspector tab IDs */
export type InspectorTabId =
  // Node/Record tabs
  | 'record' | 'interpretation' | 'references' | 'links' | 'schema'
  // Action tabs
  | 'details' | 'execution_log' | 'declare' | 'narrative_thread' | 'mappings'
  // Email tabs
  | 'email_details' | 'email_mappings'
  // Import item tabs
  | 'import_details' | 'import_classification' | 'import_fields';

/** Default inspector tab */
export const DEFAULT_INSPECTOR_TAB: InspectorTabId = 'record';

/** Validate and normalize inspector tab ID (handles stale persisted values) */
export function normalizeInspectorTabId(value: string | undefined): InspectorTabId {
  const validTabs: InspectorTabId[] = [
    'record', 'interpretation', 'references', 'links', 'schema',
    'details', 'execution_log', 'declare', 'narrative_thread', 'mappings',
    'email_details', 'email_mappings',
    'import_details', 'import_classification', 'import_fields'
  ];
  return validTabs.includes(value as InspectorTabId) ? (value as InspectorTabId) : DEFAULT_INSPECTOR_TAB;
}

export type InspectorMode =
  | { view: 'record'; id: string; tab?: string }
  | { view: 'schema'; id: string; tab?: string }
  | { view: 'references'; id: string }
  | null;

export type OverlayConfig = {
  type: string;
  props: Record<string, unknown>;
};

export type UIPanels = {
  sidebar: 'projectTree' | 'recordsNav' | null;
  workspace: 'list' | 'cards' | 'millerColumns' | 'details' | 'projectWorkflow' | 'projectLog' | null;
  inspector: InspectorMode;
  overlay: OverlayConfig | null;
};
