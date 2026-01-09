/**
 * Import Workbench Surface
 *
 * Projection-driven import interface using Mantine components.
 * - Session configuration panel
 * - Projection selector (hierarchy vs stage views)
 * - Import preview with selected projection
 * - Record inspector for inspecting planned actions
 * - Execution controls
 */

import { useState, useCallback, useMemo } from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import {
    Paper, Group, Text, ActionIcon, Badge, Box, Stack
} from '@mantine/core';
import { useActiveProjection, AVAILABLE_PROJECTIONS } from '../../stores/projectionStore';
import { ProjectionSelector } from './ProjectionSelector';
import { ImportPreview } from './ImportPreview';
import { ImportRecordInspector } from './ImportRecordInspector';
import { SessionConfigPanel } from './SessionConfigPanel';
import { ExecutionControls } from './ExecutionControls';
import { ClassificationPanel } from './ClassificationPanel';
import type { ImportPlan, ImportSession } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportWorkbenchProps {
    /** Callback when import completes successfully */
    onImportComplete?: () => void;
    /** Callback to close the workbench */
    onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportWorkbench({ onImportComplete, onClose }: ImportWorkbenchProps) {
    // Session state
    const [session, setSession] = useState<ImportSession | null>(null);
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    // Projection preference
    const [activeProjection, setActiveProjection] = useActiveProjection(
        'import-workbench',
        'hierarchy-projection'
    );

    // Handle session creation
    const handleSessionCreated = useCallback((newSession: ImportSession, newPlan: ImportPlan) => {
        setSession(newSession);
        setPlan(newPlan);
        setSelectedRecordId(null);
    }, []);

    // Handle record selection
    const handleRecordSelect = useCallback((recordId: string) => {
        setSelectedRecordId(recordId);
    }, []);

    // Handle execution start
    const handleExecuteStart = useCallback(() => {
        setIsExecuting(true);
    }, []);

    // Handle execution complete
    const handleExecuteComplete = useCallback((success: boolean) => {
        setIsExecuting(false);
        if (success) {
            onImportComplete?.();
        }
    }, [onImportComplete]);

    // Reset state
    const handleReset = useCallback(() => {
        setSession(null);
        setPlan(null);
        setSelectedRecordId(null);
    }, []);

    // Handle resolutions saved
    const handleResolutionsSaved = useCallback((updatedPlan: ImportPlan) => {
        setPlan(updatedPlan);
    }, []);

    // Check if there are unresolved classifications
    const hasUnresolvedClassifications = useMemo(() => {
        if (!plan?.classifications) return false;
        return plan.classifications.some(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    return (
        <Stack gap={0} className="h-full bg-slate-50">
            {/* Header */}
            <Paper shadow="none" radius={0} className="border-b border-slate-200">
                <Group justify="space-between" h={56} px="md">
                    <Group gap="sm">
                        <FileSpreadsheet size={20} className="text-blue-600" />
                        <Text size="lg" fw={700}>Import Workbench</Text>
                        {session && (
                            <Badge size="sm" variant="light" color="gray" tt="none" className="font-mono">
                                {session.parser_name}
                            </Badge>
                        )}
                    </Group>
                    {onClose && (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={onClose}
                            size="lg"
                        >
                            <X size={20} />
                        </ActionIcon>
                    )}
                </Group>
            </Paper>

            {/* Main Content */}
            <Group gap={0} className="flex-1 overflow-hidden" align="stretch" wrap="nowrap">
                {/* Left Panel: Session Config / Validation */}
                <Box w={288} className="bg-white border-r border-slate-200 flex flex-col">
                    <SessionConfigPanel
                        session={session}
                        plan={plan}
                        onSessionCreated={handleSessionCreated}
                        onReset={handleReset}
                    />
                </Box>

                {/* Center Panel: Preview */}
                <Stack gap={0} className="flex-1 overflow-hidden">
                    {/* Projection Selector */}
                    <ProjectionSelector
                        activeProjectionId={activeProjection}
                        availableProjections={AVAILABLE_PROJECTIONS}
                        onChange={setActiveProjection}
                        disabled={!plan}
                    />

                    {/* Preview */}
                    <Box className="flex-1 overflow-auto">
                        <ImportPreview
                            plan={plan}
                            projectionId={activeProjection}
                            selectedRecordId={selectedRecordId}
                            onRecordSelect={handleRecordSelect}
                        />
                    </Box>
                </Stack>

                {/* Right Panel: Record Inspector */}
                {selectedRecordId && plan && (
                    <Box w={320} className="bg-white border-l border-slate-200 overflow-auto">
                        <ImportRecordInspector
                            recordId={selectedRecordId}
                            plan={plan}
                            onClose={() => setSelectedRecordId(null)}
                        />
                    </Box>
                )}
            </Group>

            {/* Classification Panel: shows when there are unresolved items */}
            {hasUnresolvedClassifications && session && (
                <ClassificationPanel
                    sessionId={session.id}
                    plan={plan}
                    onResolutionsSaved={handleResolutionsSaved}
                />
            )}

            {/* Footer: Execution Controls */}
            <ExecutionControls
                session={session}
                plan={plan}
                isExecuting={isExecuting}
                onExecuteStart={handleExecuteStart}
                onExecuteComplete={handleExecuteComplete}
                onReset={handleReset}
            />
        </Stack>
    );
}

export default ImportWorkbench;
