export type Selection =
  | { type: 'node'; id: string }
  | { type: 'record'; id: string }
  | { type: 'definition'; id: string }
  | { type: 'project'; id: string }
  | { type: 'action'; id: string }
  | null;

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
