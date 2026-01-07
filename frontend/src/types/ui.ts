export type Selection =
  | { type: 'node'; id: string }
  | { type: 'record'; id: string }
  | { type: 'definition'; id: string }
  | { type: 'project'; id: string }
  | { type: 'action'; id: string }
  | null;

/** Valid inspector tab IDs */
export type InspectorTabId =
  // Node/Record tabs
  | 'record' | 'interpretation' | 'references' | 'links' | 'schema'
  // Action tabs
  | 'details' | 'execution_log' | 'declare';

/** Default inspector tab */
export const DEFAULT_INSPECTOR_TAB: InspectorTabId = 'record';

/** Validate and normalize inspector tab ID (handles stale persisted values) */
export function normalizeInspectorTabId(value: string | undefined): InspectorTabId {
  const validTabs: InspectorTabId[] = ['record', 'interpretation', 'references', 'links', 'schema', 'details', 'execution_log', 'declare'];
  return validTabs.includes(value as InspectorTabId) ? (value as InspectorTabId) : DEFAULT_INSPECTOR_TAB;
}

export type InspectorMode =
  | { view: 'record'; id: string; tab?: string }
  | { view: 'schema'; id: string; tab?: string }
  | { view: 'references'; id: string }
  | null;

export type DrawerConfig = {
  type: string;
  props: Record<string, unknown>;
};

export type UIPanels = {
  sidebar: 'projectTree' | 'recordsNav' | null;
  workspace: 'grid' | 'millerColumns' | 'details' | 'projectWorkflow' | 'projectLog' | 'calendar' | null;
  inspector: InspectorMode;
  drawer: DrawerConfig | null;
};
