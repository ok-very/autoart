/**
 * WorkbenchPage
 *
 * Full-page interface for the Import Workbench.
 * Provides a dedicated route for data import operations.
 *
 * Replaces the deprecated IngestionView and 'ingest' view mode.
 */

import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { ImportWorkbench } from '../surfaces/import/ImportWorkbench';

export function WorkbenchPage() {
    const navigate = useNavigate();

    const handleImportComplete = () => {
        // Navigate to records after successful import
        navigate('/records');
    };

    const handleClose = () => {
        // Go back to previous page or home
        navigate(-1);
    };

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex-1 overflow-hidden">
                <ImportWorkbench
                    onImportComplete={handleImportComplete}
                    onClose={handleClose}
                />
            </div>
        </div>
    );
}
