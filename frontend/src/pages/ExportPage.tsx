/**
 * ExportPage - Page wrapper for Export Workbench
 *
 * Layout: ExportWorkbenchSidebar | ExportWorkbenchContent
 *
 * Follows the same pattern as ProjectPage and RecordsPage.
 */
import { Header } from '../ui/layout/Header';
import { ExportContent } from '../ui/workspace/content/ExportContent';

export function ExportPage() {
    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex-1 overflow-hidden">
                <ExportContent />
            </div>
        </div>
    );
}

export default ExportPage;
