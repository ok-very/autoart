import { ExportWorkbench } from '../../surfaces/export/ExportWorkbench';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export function ExportPanel() {
    const { closePanel } = useWorkspaceStore();

    return (
        <ExportWorkbench
            onClose={() => closePanel('export-workbench')}
        />
    );
}
