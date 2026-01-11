/**
 * DrawerRegistry - Typed drawer component registry
 *
 * This registry maps drawer type IDs to their view components and definitions.
 * All drawers are validated against their contracts before rendering.
 */

import { lazy, Suspense } from 'react';
import type {
    DrawerDefinition,
    DrawerContextMap,
    DrawerResult,
} from './types';
import { createUIContext } from './types';

// ==================== DRAWER DEFINITIONS ====================

/**
 * All drawer definitions with their metadata.
 * This is the single source of truth for drawer configuration.
 */
export const DRAWER_DEFINITIONS: Record<keyof DrawerContextMap, DrawerDefinition> = {
    'create-record': {
        id: 'create-record',
        title: 'Create Record',
        size: 'md',
        sideEffects: [{ type: 'create', entityType: 'record' }],
        dismissible: true,
        showClose: true,
    },
    'create-node': {
        id: 'create-node',
        title: 'Create Node',
        size: 'md',
        sideEffects: [{ type: 'create', entityType: 'node' }],
        dismissible: true,
        showClose: true,
    },
    'create-project': {
        id: 'create-project',
        title: 'New Project',
        size: 'lg',
        sideEffects: [{ type: 'create', entityType: 'project' }],
        dismissible: true,
        showClose: true,
    },
    'create-definition': {
        id: 'create-definition',
        title: 'New Definition',
        size: 'lg',
        sideEffects: [{ type: 'create', entityType: 'definition' }],
        dismissible: true,
        showClose: true,
    },
    'create-link': {
        id: 'create-link',
        title: 'Create Link',
        size: 'md',
        sideEffects: [{ type: 'create', entityType: 'link' }],
        dismissible: true,
        showClose: true,
    },
    'add-field': {
        id: 'add-field',
        title: 'Add Field',
        size: 'md',
        sideEffects: [{ type: 'update', entityType: 'definition' }],
        dismissible: true,
        showClose: true,
    },
    'assign-records': {
        id: 'assign-records',
        title: 'Assign Records',
        size: 'md',
        sideEffects: [{ type: 'assign', entityType: 'record' }],
        dismissible: true,
        showClose: true,
    },
    /** @deprecated Use 'assign-records' instead */
    'classify-records': {
        id: 'classify-records',
        title: 'Assign Records',
        size: 'md',
        sideEffects: [{ type: 'assign', entityType: 'record' }],
        dismissible: true,
        showClose: true,
    },
    'clone-definition': {
        id: 'clone-definition',
        title: 'Clone Definition',
        size: 'md',
        sideEffects: [{ type: 'clone', entityType: 'definition' }],
        dismissible: true,
        showClose: true,
    },
    'clone-project': {
        id: 'clone-project',
        title: 'Clone Project',
        size: 'md',
        sideEffects: [{ type: 'clone', entityType: 'project' }],
        dismissible: true,
        showClose: true,
    },
    'confirm-delete': {
        id: 'confirm-delete',
        title: 'Confirm Delete',
        size: 'sm',
        sideEffects: [{ type: 'delete', entityType: 'record' }], // Generic - actual entity varies
        dismissible: true,
        showClose: true,
    },
    'view-record': {
        id: 'view-record',
        title: 'View Record',
        size: 'lg',
        sideEffects: [],
        dismissible: true,
        showClose: true,
    },
    'view-definition': {
        id: 'view-definition',
        title: 'View Definition',
        size: 'lg',
        sideEffects: [],
        dismissible: true,
        showClose: true,
    },
    'project-library': {
        id: 'project-library',
        title: 'Project Library',
        size: 'xl',
        sideEffects: [],
        dismissible: true,
        showClose: true,
    },
    'ingestion': {
        id: 'ingestion',
        title: 'Import Data',
        size: 'xl',
        sideEffects: [{ type: 'create', entityType: 'record' }],
        dismissible: true,
        showClose: true,
    },
    'integrations': {
        id: 'integrations',
        title: 'Integrations',
        size: 'md',
        sideEffects: [{ type: 'update', entityType: 'connection' }],
        dismissible: true,
        showClose: true,
    },
    'monday-boards': {
        id: 'monday-boards',
        title: 'Select Monday Boards',
        size: 'lg',
        sideEffects: [],
        dismissible: true,
        showClose: true,
    },
};

// ==================== LAZY LOADED VIEWS ====================

// Lazy load drawer views for code splitting
const CreateRecordView = lazy(() =>
    import('../ui/drawer/views/CreateRecordView').then((m) => ({ default: m.CreateRecordView }))
);
const CreateNodeView = lazy(() =>
    import('../ui/drawer/views/CreateNodeView').then((m) => ({ default: m.CreateNodeView }))
);
const CreateProjectView = lazy(() =>
    import('../ui/drawer/views/CreateProjectView').then((m) => ({ default: m.CreateProjectView }))
);
const CreateDefinitionView = lazy(() =>
    import('../ui/drawer/views/CreateDefinitionView').then((m) => ({ default: m.CreateDefinitionView }))
);
const CreateLinkView = lazy(() =>
    import('../ui/drawer/views/CreateLinkView').then((m) => ({ default: m.CreateLinkView }))
);
const AddFieldView = lazy(() =>
    import('../ui/drawer/views/AddFieldView').then((m) => ({ default: m.AddFieldView }))
);
const AssignRecordsView = lazy(() =>
    import('../ui/drawer/views/AssignRecordsView').then((m) => ({ default: m.AssignRecordsView }))
);
const CloneDefinitionView = lazy(() =>
    import('../ui/drawer/views/CloneDefinitionView').then((m) => ({ default: m.CloneDefinitionView }))
);
const CloneProjectView = lazy(() =>
    import('../ui/drawer/views/CloneProjectView').then((m) => ({ default: m.CloneProjectView }))
);
const ConfirmDeleteView = lazy(() =>
    import('../ui/drawer/views/ConfirmDeleteView').then((m) => ({ default: m.ConfirmDeleteView }))
);
const ViewRecordDrawer = lazy(() =>
    import('../ui/drawer/views/ViewRecordDrawer').then((m) => ({ default: m.ViewRecordDrawer }))
);
const ViewDefinitionDrawer = lazy(() =>
    import('../ui/drawer/views/ViewDefinitionDrawer').then((m) => ({ default: m.ViewDefinitionDrawer }))
);
const ProjectLibraryDrawer = lazy(() =>
    import('../ui/drawer/views/ProjectLibraryDrawer').then((m) => ({ default: m.ProjectLibraryDrawer }))
);
const MondayBoardsDrawer = lazy(() =>
    import('../ui/drawer/views/MondayBoardsDrawer').then((m) => ({ default: m.MondayBoardsDrawer }))
);

// ==================== LOADING FALLBACK ====================

function DrawerLoadingFallback() {
    return (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
        </div>
    );
}

// ==================== REGISTRY COMPONENT ====================

interface DrawerRegistryProps {
    type: keyof DrawerContextMap | string;
    context: unknown;
    onClose: () => void;
    onResult?: (result: DrawerResult) => void;
}

/**
 * DrawerRegistry - Renders the appropriate drawer view based on type.
 *
 * This component:
 * 1. Validates the drawer type exists
 * 2. Creates the UI context for traceability
 * 3. Renders the correct view with typed props
 * 4. Handles result callbacks
 */
export function DrawerRegistry({ type, context, onClose, onResult }: DrawerRegistryProps) {
    const definition = DRAWER_DEFINITIONS[type as keyof DrawerContextMap];

    if (!definition) {
        console.warn(`[DrawerRegistry] Unknown drawer type: ${type}`);
        return (
            <div className="p-4 text-slate-500">
                Unknown drawer type: {type}
            </div>
        );
    }

    // Create UI context for this drawer instance
    const uiContext = createUIContext(type);

    // Check if we're in development mode
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

    // Log drawer open in development
    if (isDev) {
        console.debug(`[Drawer] Opening: ${type}`, { context, uiContext });
    }

    // Handle result submission - will be used when views are migrated to new contract
    const _handleSubmit = (result: DrawerResult) => {
        if (isDev) {
            console.debug(`[Drawer] Result: ${type}`, result);
        }
        onResult?.(result);
        if (result.success) {
            onClose();
        }
    };

    // Suppress unused variable warning - will be used after migration
    void _handleSubmit;
    void uiContext;

    // Render the appropriate view
    // Note: Legacy views still use old prop pattern; will be migrated in 3.2
    const renderView = () => {
        switch (type) {
            case 'create-record':
                return <CreateRecordView {...(context as any)} />;
            case 'create-node':
                return <CreateNodeView {...(context as any)} />;
            case 'create-project':
                return <CreateProjectView />;
            case 'create-definition':
                return <CreateDefinitionView />;
            case 'create-link':
                return <CreateLinkView {...(context as any)} />;
            case 'add-field':
                return <AddFieldView {...(context as any)} />;
            case 'assign-records':
            case 'classify-records':
                return <AssignRecordsView {...(context as any)} />;
            case 'clone-definition':
                return <CloneDefinitionView {...(context as any)} />;
            case 'clone-project':
                return <CloneProjectView {...(context as any)} />;
            case 'confirm-delete':
                return <ConfirmDeleteView {...(context as any)} />;
            case 'view-record':
                return <ViewRecordDrawer {...(context as any)} />;
            case 'view-definition':
                return <ViewDefinitionDrawer {...(context as any)} />;
            case 'project-library':
                return <ProjectLibraryDrawer {...(context as any)} />;
            case 'monday-boards':
                return <MondayBoardsDrawer {...(context as any)} />;
            default:
                return (
                    <div className="p-4 text-slate-500">
                        Unknown drawer type: {type}
                    </div>
                );
        }
    };

    return (
        <Suspense fallback={<DrawerLoadingFallback />}>
            {renderView()}
        </Suspense>
    );
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get drawer definition by type.
 */
export function getDrawerDefinition(type: keyof DrawerContextMap): DrawerDefinition | undefined {
    return DRAWER_DEFINITIONS[type];
}

/**
 * Get drawer size in pixels.
 */
export function getDrawerHeight(type: keyof DrawerContextMap): number {
    const def = DRAWER_DEFINITIONS[type];
    if (!def) return 400;

    const sizes = { sm: 320, md: 400, lg: 520, xl: 640, full: 800 };
    return sizes[def.size];
}
