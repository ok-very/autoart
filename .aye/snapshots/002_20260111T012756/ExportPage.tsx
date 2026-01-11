/**
 * ExportPage
 *
 * Full-page interface for the Export Workbench.
 * Provides a dedicated route for BFA To-Do export operations.
 */

import { useNavigate } from 'react-router-dom';
import { Header } from '../ui/layout/Header';
import { ExportWorkbench } from '../surfaces/export/ExportWorkbench';

export function ExportPage() {
    const navigate = useNavigate();

    const handleExportComplete = () => {
        // Navigate back after successful export
        navigate('/');
    };

    const handleClose = () => {
        // Go back to previous page or home
        navigate(-1);
    };

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex-1 overflow-hidden">
                <ExportWorkbench
                    onExportComplete={handleExportComplete}
                    onClose={handleClose}
                />
            </div>
        </div>
    );
}
