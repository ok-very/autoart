/**
 * Panel Registry
 *
 * Defines all available panels that can be opened in Dockview panel groups.
 * Each panel has an ID, title, icon, and target area (right or bottom).
 */


import {
    Eye,
    FileText,
    Layers,
    Search,
    type LucideIcon,
} from 'lucide-react';

// Panel IDs for right sidebar panels
export type RightPanelId =
    | 'selection-inspector'
    | 'record-properties';

// Panel IDs for bottom panel area
export type BottomPanelId =
    | 'classification'
    | 'search-results';

// All panel IDs
export type PanelId = RightPanelId | BottomPanelId;

// Panel definition with metadata
export interface PanelDefinition {
    id: PanelId;
    title: string;
    icon: LucideIcon;
    area: 'right' | 'bottom';
    // Lazy-loaded component will be added during registration
}

// Panel definitions registry
export const PANEL_DEFINITIONS: Record<PanelId, PanelDefinition> = {
    // Right panels
    'selection-inspector': {
        id: 'selection-inspector',
        title: 'Inspector',
        icon: Eye,
        area: 'right',
    },
    'record-properties': {
        id: 'record-properties',
        title: 'Properties',
        icon: FileText,
        area: 'right',
    },

    // Bottom panels
    'classification': {
        id: 'classification',
        title: 'Classification',
        icon: Layers,
        area: 'bottom',
    },
    'search-results': {
        id: 'search-results',
        title: 'Search Results',
        icon: Search,
        area: 'bottom',
    },
};

// Get panels by area
export function getPanelsByArea(area: 'right' | 'bottom'): PanelDefinition[] {
    return Object.values(PANEL_DEFINITIONS).filter((p) => p.area === area);
}

// Check if a panel ID is valid
export function isValidPanelId(id: string): id is PanelId {
    return id in PANEL_DEFINITIONS;
}
