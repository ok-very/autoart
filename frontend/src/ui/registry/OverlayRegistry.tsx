import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Modal } from '@autoart/ui';
import { createUIContext } from '../../drawer/types';

// Import Views
import { CreateNodeView } from '../drawer/views/CreateNodeView';
import { CreateRecordView } from '../drawer/views/CreateRecordView';
import { CreateProjectView } from '../drawer/views/CreateProjectView';
import { CreateDefinitionView } from '../drawer/views/CreateDefinitionView';
import { CreateLinkView } from '../drawer/views/CreateLinkView';
import { AddFieldView } from '../drawer/views/AddFieldView';
import { AssignRecordsView } from '../drawer/views/AssignRecordsView';
import { CloneDefinitionView } from '../drawer/views/CloneDefinitionView';
import { CloneProjectView } from '../drawer/views/CloneProjectView';
import { ConfirmDeleteView } from '../drawer/views/ConfirmDeleteView';
import { ViewDefinitionDrawer } from '../drawer/views/ViewDefinitionDrawer';
import { ProjectLibraryDrawer } from '../drawer/views/ProjectLibraryDrawer';
import { MondayBoardsDrawer } from '../drawer/views/MondayBoardsDrawer';
import { StartCollectionModal } from '../drawer/views/StartCollectionModal';
import { IntegrationsSection } from '../../pages/settings/IntegrationsSection';
import { ClassificationPanel } from '../../workflows/import/panels/ClassificationPanel';
import type { ImportPlan } from '../../api/hooks/imports';

// Wrapper to adapt drawer props to ClassificationPanel props
const ClassificationDrawerView = ({
    sessionId,
    plan,
    onResolutionsSaved,
    onClose,
    keepOpenAfterSave = false
}: {
    sessionId: string;
    plan: ImportPlan;
    onResolutionsSaved?: (updated: ImportPlan) => void;
    onClose?: () => void;
    keepOpenAfterSave?: boolean;
}) => (
    <ClassificationPanel
        sessionId={sessionId}
        plan={plan}
        onResolutionsSaved={(updated) => {
            if (typeof onResolutionsSaved === 'function') {
                onResolutionsSaved(updated);
            }
            // Only close if not explicitly configured to keep open
            if (!keepOpenAfterSave && typeof onClose === 'function') {
                onClose();
            }
        }}
    />
);

// Map types to components
export const OVERLAY_VIEWS: Record<string, React.ComponentType<any>> = {
    'create-node': CreateNodeView,
    'create-record': CreateRecordView,
    'create-project': CreateProjectView,
    'create-definition': CreateDefinitionView,
    'create-link': CreateLinkView,
    'add-field': AddFieldView,
    'assign-records': AssignRecordsView,
    'classify-records': AssignRecordsView, // legacy alias
    'clone-definition': CloneDefinitionView,
    'clone-project': CloneProjectView,
    'confirm-delete': ConfirmDeleteView,
    'view-definition': ViewDefinitionDrawer,
    'project-library': ProjectLibraryDrawer,
    'monday-boards': MondayBoardsDrawer,
    'template-library': ProjectLibraryDrawer, // Alias for template library
    'integrations': IntegrationsSection, // Integrations settings modal
    'start-collection': StartCollectionModal, // Export collection start modal
    'classification': ClassificationDrawerView, // Import classification review panel
};


export function OverlayRegistry() {
    const { activeDrawer, closeDrawer, setActiveProject } = useUIStore();

    // Stabilize uiContext so it doesn't change on every render while drawer is open
    // Recreate when activeDrawer changes (new drawer session opened, even of same type)
    // Using activeDrawer reference ensures new sessions get fresh openedAt timestamps
    const uiContext = useMemo(
        () => activeDrawer ? createUIContext(activeDrawer.type) : null,
        [activeDrawer]
    );

    if (!activeDrawer || !uiContext) return null;

    const { type, props } = activeDrawer;
    const Component = OVERLAY_VIEWS[type];

    // Default size can be overridden per type if needed
    let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' = 'md';
    if (['create-record', 'view-definition', 'project-library', 'classification'].includes(type)) size = 'xl';
    if (['create-node', 'add-field', 'clone-project'].includes(type)) size = 'lg';
    if (['confirm-delete'].includes(type)) size = 'sm';

    // Construct context props expected by Drawer views
    const componentProps = {
        // legacy support: spread props directly
        ...props,
        // new contract support
        context: props,
        onClose: closeDrawer,
        onSubmit: (result?: any) => {
            // Handle create-project success: set new project as active
            if (type === 'create-project' && result?.success && result?.data?.projectId) {
                setActiveProject(result.data.projectId);
            }
            closeDrawer();
        },
        uiContext,
    };

    return (
        <Modal
            open={!!activeDrawer}
            onOpenChange={(open) => !open && closeDrawer()}
            size={size}
        >
            {Component ? (
                <Component {...componentProps} />
            ) : (
                <div className="p-4 text-red-500">
                    Unknown overlay type: {type}
                </div>
            )}
        </Modal>
    );
}
