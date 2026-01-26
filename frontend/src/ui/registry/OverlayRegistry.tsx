import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Modal } from '@autoart/ui';
import { createUIContext } from '../../overlay/types';

// Import Views
import { CreateNodeView } from '../overlay/views/CreateNodeView';
import { CreateRecordView } from '../overlay/views/CreateRecordView';
import { CreateProjectView } from '../overlay/views/CreateProjectView';
import { CreateDefinitionView } from '../overlay/views/CreateDefinitionView';
import { CreateLinkView } from '../overlay/views/CreateLinkView';
import { AddFieldView } from '../overlay/views/AddFieldView';
import { AssignRecordsView } from '../overlay/views/AssignRecordsView';
import { CloneDefinitionView } from '../overlay/views/CloneDefinitionView';
import { CloneProjectView } from '../overlay/views/CloneProjectView';
import { ConfirmDeleteView } from '../overlay/views/ConfirmDeleteView';
import { ViewDefinitionOverlay } from '../overlay/views/ViewDefinitionOverlay';
import { ProjectLibraryOverlay } from '../overlay/views/ProjectLibraryOverlay';
import { MondayBoardsOverlay } from '../overlay/views/MondayBoardsOverlay';
import { StartCollectionModal } from '../overlay/views/StartCollectionModal';
import { ActionInspectorOverlay } from '../overlay/views/ActionInspectorOverlay';
import { LinkPickerView } from '../overlay/views/LinkPickerView';
import { ConfirmUnlinkView } from '../overlay/views/ConfirmUnlinkView';
import { IntegrationsSection } from '../../pages/settings/IntegrationsSection';
import { ClassificationPanel } from '../../workflows/import/panels/ClassificationPanel';
import type { ImportPlan } from '../../api/hooks/imports';

// Wrapper to adapt overlay props to ClassificationPanel props
const ClassificationOverlayView = ({
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
    'view-definition': ViewDefinitionOverlay,
    'project-library': ProjectLibraryOverlay,
    'monday-boards': MondayBoardsOverlay,
    'template-library': ProjectLibraryOverlay, // Alias for template library
    'integrations': IntegrationsSection, // Integrations settings modal
    'start-collection': StartCollectionModal, // Export collection start modal
    'classification': ClassificationOverlayView, // Import classification review panel
    'amend-action': ActionInspectorOverlay, // Action amendment overlay
    'link-picker': LinkPickerView, // Entity link picker
    'confirm-unlink': ConfirmUnlinkView, // Confirm unlink dialog
};


export function OverlayRegistry() {
    const { activeOverlay, closeOverlay, setActiveProject } = useUIStore();

    // Stabilize uiContext so it doesn't change on every render while overlay is open
    // Recreate when activeOverlay changes (new overlay session opened, even of same type)
    // Using activeOverlay reference ensures new sessions get fresh openedAt timestamps
    const uiContext = useMemo(
        () => activeOverlay ? createUIContext(activeOverlay.type) : null,
        [activeOverlay]
    );

    if (!activeOverlay || !uiContext) return null;

    const { type, props } = activeOverlay;
    const Component = OVERLAY_VIEWS[type];

    // Default size can be overridden per type if needed
    let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' = 'md';
    if (['create-record', 'view-definition', 'project-library', 'classification'].includes(type)) size = 'xl';
    if (['create-node', 'add-field', 'clone-project', 'link-picker'].includes(type)) size = 'lg';
    if (['confirm-delete', 'confirm-unlink'].includes(type)) size = 'sm';

    // Construct context props expected by Overlay views
    const componentProps = {
        // legacy support: spread props directly
        ...props,
        // new contract support
        context: props,
        onClose: closeOverlay,
        onSubmit: (result?: any) => {
            // Handle create-project success: set new project as active
            if (type === 'create-project' && result?.success && result?.data?.projectId) {
                setActiveProject(result.data.projectId);
            }
            closeOverlay();
        },
        uiContext,
    };

    return (
        <Modal
            open={!!activeOverlay}
            onOpenChange={(open) => !open && closeOverlay()}
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
