/**
 * Panel Registry
 *
 * Defines all available panels for the unified Dockview workspace.
 * Each panel declares:
 * - ID, title, icon
 * - Default placement (hint, not constraint)
 * - Context requirements via Zod schema
 * - Visibility predicate
 */

import { z } from 'zod';
import {
    Eye,
    Layers,
    Search,
    Layout,
    LayoutGrid,
    Database,
    TableProperties,
    Zap,
    Activity,
    FolderOpen,
    Hammer,
    Wand2,
    Mail,
    Image,
    type LucideIcon,
} from 'lucide-react';

// ============================================================================
// PANEL IDS
// ============================================================================

// ============================================================================
// PANEL IDS
// ============================================================================

export type CorePanelId = 'center-workspace';
export type ToolPanelId = 'selection-inspector' | 'classification' | 'search-results' | 'mail-panel';
export type RegistryPanelId = 'records-list' | 'fields-list' | 'actions-list' | 'events-list';
export type WorkbenchPanelId = 'import-workbench' | 'export-workbench' | 'composer-workbench' | 'intake-workbench' | 'artcollector-workbench';
export type ProjectPanelId = 'project-panel';
export type PanelId = CorePanelId | ToolPanelId | RegistryPanelId | WorkbenchPanelId | ProjectPanelId;

// Permanent panels cannot be closed by user
export const PERMANENT_PANELS: readonly PanelId[] = ['center-workspace'] as const;

// ============================================================================
// CONTEXT SCHEMAS (Zod)
// ============================================================================

// Selection context - what the user has selected
export const SelectionContextSchema = z.object({
    type: z.enum(['record', 'definition', 'action', 'node']).nullable(),
    id: z.string().nullable(),
});

// Import session context - active import workflow
export const ImportSessionContextSchema = z.object({
    sessionId: z.string().nullable(),
    planExists: z.boolean(),
});

// Search context - global search state
export const SearchContextSchema = z.object({
    query: z.string(),
    hasResults: z.boolean(),
});

// Master app context - all contexts combined
export const AppContextSchema = z.object({
    selection: SelectionContextSchema,
    importSession: ImportSessionContextSchema,
    search: SearchContextSchema,
});

export type AppContext = z.infer<typeof AppContextSchema>;
export type SelectionContext = z.infer<typeof SelectionContextSchema>;
export type ImportSessionContext = z.infer<typeof ImportSessionContextSchema>;
export type SearchContext = z.infer<typeof SearchContextSchema>;

// Default empty context
export const DEFAULT_CONTEXT: AppContext = {
    selection: { type: null, id: null },
    importSession: { sessionId: null, planExists: false },
    search: { query: '', hasResults: false },
};

// ============================================================================
// PANEL DEFINITION
// ============================================================================

export type DefaultPlacement = {
    area: 'center' | 'right' | 'bottom' | 'left';
    size?: number; // percentage or pixels depending on area
};

export interface PanelDefinition {
    id: PanelId;
    title: string;
    icon: LucideIcon;
    permanent: boolean;
    defaultPlacement: DefaultPlacement;
    // Visibility predicate - should this panel auto-show given context?
    shouldShow: (ctx: AppContext) => boolean;
    // Action predicate - can this panel act on current context?
    canActOn: (ctx: AppContext) => boolean;
}

// ============================================================================
// PANEL DEFINITIONS
// ============================================================================

export const PANEL_DEFINITIONS: Record<PanelId, PanelDefinition> = {
    // Core - always open
    'center-workspace': {
        id: 'center-workspace',
        title: 'Projects',
        icon: Layout,
        permanent: true,
        defaultPlacement: { area: 'center', size: 70 },
        shouldShow: () => true, // Always visible
        canActOn: () => true,   // Always active
    },

    // ... (rest)

    // Tools - on-demand, context-aware
    'selection-inspector': {
        id: 'selection-inspector',
        title: 'Inspector',
        icon: Eye,
        permanent: false,
        defaultPlacement: { area: 'right', size: 30 },
        shouldShow: () => true, // Always show (renders empty state if nothing selected)
        canActOn: (ctx) => ctx.selection.type !== null,
    },

    'classification': {
        id: 'classification',
        title: 'Classification',
        icon: Layers,
        permanent: false,
        defaultPlacement: { area: 'bottom', size: 300 },
        shouldShow: (ctx) => ctx.importSession.sessionId !== null && ctx.importSession.planExists,
        canActOn: (ctx) => ctx.importSession.planExists,
    },

    'search-results': {
        id: 'search-results',
        title: 'Search Results',
        icon: Search,
        permanent: false,
        defaultPlacement: { area: 'bottom', size: 300 },
        shouldShow: (ctx) => ctx.search.query.length > 0 && ctx.search.hasResults,
        canActOn: (ctx) => ctx.search.hasResults,
    },

    'mail-panel': {
        id: 'mail-panel',
        title: 'Mail',
        icon: Mail,
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },

    // Registry Panels - Managed by Header
    'records-list': {
        id: 'records-list',
        title: 'Records',
        icon: Database, // Will need import
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },
    'fields-list': {
        id: 'fields-list',
        title: 'Fields',
        icon: TableProperties, // Will need import
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },
    'actions-list': {
        id: 'actions-list',
        title: 'Actions',
        icon: Zap, // Will need import
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },
    'events-list': {
        id: 'events-list',
        title: 'Events',
        icon: Activity, // Will need import
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },

    // Workbench Panels
    'import-workbench': {
        id: 'import-workbench',
        title: 'Import',
        icon: FolderOpen, // Will need import
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: (ctx) => ctx.importSession.sessionId !== null,
        canActOn: () => true,
    },
    'export-workbench': {
        id: 'export-workbench',
        title: 'Export',
        icon: Hammer, // Will need import, or default to Hammer/Database
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false,
        canActOn: () => true,
    },
    'composer-workbench': {
        id: 'composer-workbench',
        title: 'Composer',
        icon: Wand2,
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false,
        canActOn: () => true,
    },
    'intake-workbench': {
        id: 'intake-workbench',
        title: 'Intake',
        icon: FolderOpen, // Will use ClipboardList if imported
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false,
        canActOn: () => true,
    },
    'artcollector-workbench': {
        id: 'artcollector-workbench',
        title: 'Art Collector',
        icon: Image,
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand
        canActOn: () => true,
    },

    // Project Panel - Bound to workspace project
    'project-panel': {
        id: 'project-panel',
        title: 'Project',
        icon: LayoutGrid,
        permanent: false,
        defaultPlacement: { area: 'center' },
        shouldShow: () => false, // On-demand via workspace presets
        canActOn: () => true,
    },
};

// ============================================================================
// UTILITIES
// ============================================================================

/** Get all panels that should be visible given current context */
export function getVisiblePanels(ctx: AppContext): PanelId[] {
    return Object.values(PANEL_DEFINITIONS)
        .filter((p) => p.shouldShow(ctx))
        .map((p) => p.id);
}

/** Get panels by default placement area */
export function getPanelsByDefaultArea(area: DefaultPlacement['area']): PanelDefinition[] {
    return Object.values(PANEL_DEFINITIONS).filter((p) => p.defaultPlacement.area === area);
}

/** Check if a panel ID is valid */
export function isValidPanelId(id: string): id is PanelId {
    return id in PANEL_DEFINITIONS;
}

/** Check if a panel is permanent (cannot be closed) */
export function isPermanentPanel(id: PanelId): boolean {
    return PERMANENT_PANELS.includes(id);
}

// Legacy exports for compatibility during migration
export type RightPanelId = 'selection-inspector';
export type BottomPanelId = 'classification' | 'search-results';
