/**
 * DrawerRegistry
 *
 * Central routing component for the Drawer system.
 * Maps drawer type strings to their corresponding view components.
 * Used by BottomDrawer to render the appropriate content.
 *
 * To add a new drawer:
 * 1. Create a view component in ./views/
 * 2. Import it here
 * 3. Add a case to the switch statement
 */

import { CreateNodeView } from './views/CreateNodeView';
import { ConfirmDeleteView } from './views/ConfirmDeleteView';
import { AddFieldView } from './views/AddFieldView';
import { CloneDefinitionView } from './views/CloneDefinitionView';
import { CreateLinkView } from './views/CreateLinkView';
import { CreateProjectView } from './views/CreateProjectView';
import { CloneProjectView } from './views/CloneProjectView';
import { ViewRecordDrawer } from './views/ViewRecordDrawer';
import { ViewDefinitionDrawer } from './views/ViewDefinitionDrawer';
import { ProjectLibraryDrawer } from './views/ProjectLibraryDrawer';
import { CreateRecordView } from './views/CreateRecordView';
import { CreateDefinitionView } from './views/CreateDefinitionView';
import { ClassifyRecordsView } from './views/ClassifyRecordsView';
import { ActionInspectorDrawer } from './views/ActionInspectorDrawer';

interface DrawerRegistryProps {
  type: string;
  props: Record<string, unknown>;
}

export function DrawerRegistry({ type, props }: DrawerRegistryProps) {
  switch (type) {
    case 'create-node':
      return <CreateNodeView {...(props as any)} />;
    case 'confirm-delete':
      return <ConfirmDeleteView {...(props as any)} />;
    case 'add-field':
      return <AddFieldView {...(props as any)} />;
    case 'clone-definition':
      return <CloneDefinitionView {...(props as any)} />;
    case 'create-link':
      return <CreateLinkView {...(props as any)} />;
    case 'create-project':
      return <CreateProjectView />;
    case 'clone-project':
      return <CloneProjectView {...(props as any)} />;
    case 'view-record':
      return <ViewRecordDrawer {...(props as { recordId: string })} />;
    case 'view-definition':
      return <ViewDefinitionDrawer {...(props as { recordId?: string; definitionId?: string })} />;
    case 'project-library':
      return <ProjectLibraryDrawer {...(props as { projectId?: string; projectTitle?: string })} />;
    case 'create-record':
      return <CreateRecordView {...(props as { definitionId: string; classificationNodeId?: string })} />;
    case 'create-definition':
      return <CreateDefinitionView />;
    case 'classify-records':
      return <ClassifyRecordsView {...(props as { recordIds: string[]; onSuccess?: () => void })} />;
    case 'view-action':
      return <ActionInspectorDrawer {...(props as { actionId: string })} />;
    default:
      return (
        <div className="p-4 text-slate-500">
          Unknown drawer type: {type}
        </div>
      );
  }
}
