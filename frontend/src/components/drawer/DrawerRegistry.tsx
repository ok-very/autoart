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
import { IngestionDrawer } from './views/IngestionDrawer';
import { CreateRecordView } from './views/CreateRecordView';
import { CreateDefinitionView } from './views/CreateDefinitionView';
import { ClassifyRecordsView } from './views/ClassifyRecordsView';

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
    case 'ingestion':
      return <IngestionDrawer />;
    case 'create-record':
      return <CreateRecordView {...(props as { definitionId: string; classificationNodeId?: string })} />;
    case 'create-definition':
      return <CreateDefinitionView />;
    case 'classify-records':
      return <ClassifyRecordsView {...(props as { recordIds: string[]; onSuccess?: () => void })} />;
    default:
      return (
        <div className="p-4 text-slate-500">
          Unknown drawer type: {type}
        </div>
      );
  }
}
