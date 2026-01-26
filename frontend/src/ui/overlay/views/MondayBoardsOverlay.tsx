/**
 * MondayBoardsOverlay
 *
 * Overlay wrapper for MondayBoardSelector.
 * Opens as a right-side overlay for selecting Monday boards to import.
 */

import { MondayBoardSelector } from '../../../workflows/import/components/MondayBoardSelector';

// ============================================================================
// TYPES
// ============================================================================

export interface MondayBoardsContext {
    onBoardImport: (boardIds: string[]) => Promise<void>;
    isImporting?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MondayBoardsOverlay({ onBoardImport, isImporting }: MondayBoardsContext) {
    return (
        <div className="h-full">
            <MondayBoardSelector
                onImport={onBoardImport}
                isImporting={isImporting}
            />
        </div>
    );
}

export default MondayBoardsOverlay;

