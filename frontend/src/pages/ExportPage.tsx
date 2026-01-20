/**
 * ExportPage - Page wrapper for Export Workbench
 *
 * Layout: ExportSidebar | ExportWorkbenchView | ExportInspector + BottomDrawer
 *
 * Follows the same pattern as ProjectPage and RecordsPage.
 */
import { Header } from '../ui/layout/Header';
import { ExportWorkbench } from '../surfaces/export/ExportWorkbench';
export function ExportPage() {
    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex-1 overflow-hidden">
                <ExportWorkbench />
            </div>
        </div>
    );
}

export default ExportPage;
