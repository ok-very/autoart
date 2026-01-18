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
import { QuickDeclareModal } from '../drawer/views/QuickDeclareModal';

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
    'quick-declare': QuickDeclareModal,
    'template-library': ProjectLibraryDrawer, // Alias for template library
};

export function OverlayRegistry() {
    const { activeDrawer, closeDrawer } = useUIStore();

    if (!activeDrawer) return null;

    const { type, props } = activeDrawer;
    const Component = OVERLAY_VIEWS[type];

    // Default size can be overridden per type if needed
    let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' = 'md';
    if (['create-record', 'view-definition', 'project-library'].includes(type)) size = 'xl';
    if (['create-node', 'add-field', 'clone-project'].includes(type)) size = 'lg';
    if (['confirm-delete'].includes(type)) size = 'sm';

    // Construct context props expected by Drawer views
    const componentProps = {
        // legacy support: spread props directly
        ...props,
        // new contract support
        context: props,
        onClose: closeDrawer,
        onSubmit: () => {
            closeDrawer();
        },
        uiContext: createUIContext(type),
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
