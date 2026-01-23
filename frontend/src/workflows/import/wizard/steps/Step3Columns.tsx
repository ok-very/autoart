import { useState, useMemo } from 'react';
import { ChevronDown, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';
import {
    Stack,
    Text,
    Button,
    Inline,
    Select,
    Badge,
    Spinner,
    CollapsibleRoot,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@autoart/ui';
import { useMondayBoardConfigs, useUpdateMondayColumnConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import { MondayColumnConfig, MondayColumnSemanticRole } from '../../../../api/types/monday';
import { ImportPreviewDrawer } from '../components/ImportPreviewDrawer';
import { ROLE_METADATA, SEMANTIC_ROLE_OPTIONS } from '../constants/monday-roles';

// Valid semantic roles for type safety
const VALID_SEMANTIC_ROLES = new Set<string>(Object.keys(ROLE_METADATA));

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

type RoleCategory = 'core' | 'data' | 'link' | 'template' | 'other';

const ROLE_CATEGORIES: { id: RoleCategory; label: string; description: string }[] = [
    { id: 'core', label: 'Core Fields', description: 'Essential item properties' },
    { id: 'data', label: 'Data Fields', description: 'Notes, facts, and metrics' },
    { id: 'link', label: 'Link Fields', description: 'Relationships to other entities' },
    { id: 'template', label: 'Template Fields', description: 'Template configuration' },
    { id: 'other', label: 'Other/Ignored', description: 'Custom fields or skipped' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupColumnsByCategory(columns: MondayColumnConfig[]): Record<RoleCategory, MondayColumnConfig[]> {
    const result: Record<RoleCategory, MondayColumnConfig[]> = {
        core: [],
        data: [],
        link: [],
        template: [],
        other: [],
    };

    for (const col of columns) {
        const category = ROLE_METADATA[col.semanticRole]?.category || 'other';
        result[category].push(col);
    }

    return result;
}

function getConfidenceVariant(confidence: number | undefined): 'success' | 'warning' | 'neutral' {
    if (!confidence) return 'neutral';
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'neutral';
}

// ============================================================================
// COLUMN CARD COMPONENT - Shows sample values prominently
// ============================================================================

interface ColumnCardProps {
    column: MondayColumnConfig;
    boardConfigId: string;
    workspaceId: string;
    onUpdate: (boardConfigId: string, workspaceId: string, columnId: string, update: Record<string, unknown>) => void;
}

function formatSampleValue(val: unknown): string {
    if (val === null) return '(null)';
    if (val === undefined) return '(undefined)';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function ColumnCard({ column, boardConfigId, workspaceId, onUpdate }: ColumnCardProps) {
    const hasSamples = Array.isArray(column.sampleValues) && column.sampleValues.length > 0;

    // Handle invalid semantic roles by providing a fallback value
    // If the current role is not in the valid options, fall back to 'custom'
    const isValidRole = VALID_SEMANTIC_ROLES.has(column.semanticRole);
    const effectiveRole = isValidRole ? column.semanticRole : 'custom';

    // Use effectiveRole for metadata lookup to ensure we always get valid metadata
    const roleMeta = ROLE_METADATA[effectiveRole];

    // If current role is invalid, add it to options temporarily so user can see and change it
    const selectOptions = isValidRole
        ? SEMANTIC_ROLE_OPTIONS
        : [
            { value: column.semanticRole, label: `Unknown: ${column.semanticRole}` },
            ...SEMANTIC_ROLE_OPTIONS,
        ];

    return (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
            {/* Sample values - PROMINENT */}
            <div className="px-4 py-3 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
                {hasSamples ? (
                    <div className="flex flex-wrap gap-2">
                        {column.sampleValues!.slice(0, 5).map((val, i) => {
                            const displayVal = formatSampleValue(val);
                            return (
                                <span
                                    key={i}
                                    className="text-sm text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm truncate max-w-[200px]"
                                    title={displayVal}
                                >
                                    "{displayVal}"
                                </span>
                            );
                        })}
                        {column.sampleValues!.length > 5 && (
                            <span className="text-xs text-slate-400 self-center">
                                +{column.sampleValues!.length - 5} more
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-sm text-slate-400 italic">No sample values available</span>
                )}
            </div>

            {/* Column info + role selector */}
            <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Text weight="medium" className="truncate" title={column.columnTitle}>
                        {column.columnTitle}
                    </Text>
                    <Badge variant="light" size="xs">
                        {column.columnType}
                    </Badge>
                    {!isValidRole && (
                        <Badge variant="warning" size="xs" title="Unknown role from backend">
                            ⚠
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-300">→</span>
                    <Select
                        value={column.semanticRole}
                        onChange={(val) => {
                            // Allow changing from invalid role to any valid role
                            if (val && (VALID_SEMANTIC_ROLES.has(val) || val === column.semanticRole)) {
                                onUpdate(boardConfigId, workspaceId, column.columnId, { semanticRole: val as MondayColumnSemanticRole });
                            }
                        }}
                        data={selectOptions}
                        size="sm"
                    />
                </div>
            </div>

            {/* Footer: description + confidence */}
            <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500 truncate" title={roleMeta?.description}>
                    {!isValidRole ? 'Unknown role - please reassign' : (roleMeta?.description || 'No description')}
                </span>
                {column.inferenceSource !== 'manual' && column.inferenceConfidence !== undefined && (
                    <Badge variant={getConfidenceVariant(column.inferenceConfidence)} size="xs">
                        {Math.round(column.inferenceConfidence * 100)}% match
                    </Badge>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// IGNORED COLUMN CHIP - Compact display for ignored columns
// ============================================================================

interface IgnoredColumnChipProps {
    column: MondayColumnConfig;
    boardConfigId: string;
    workspaceId: string;
    onUpdate: (boardConfigId: string, workspaceId: string, columnId: string, update: Record<string, unknown>) => void;
}

function IgnoredColumnChip({ column, boardConfigId, workspaceId, onUpdate }: IgnoredColumnChipProps) {
    return (
        <button
            onClick={() => {
                // Un-ignore: set to 'custom' so user can reassign
                onUpdate(boardConfigId, workspaceId, column.columnId, { semanticRole: 'custom' });
            }}
            className="group inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md hover:border-slate-300 hover:bg-slate-50 transition-colors"
            title={`Click to un-ignore "${column.columnTitle}"`}
        >
            <span className="text-slate-600 truncate max-w-[150px]">{column.columnTitle}</span>
            <X size={12} className="text-slate-400 group-hover:text-slate-600" />
        </button>
    );
}

// ============================================================================
// CATEGORY SECTION COMPONENT - Collapsible section per category
// ============================================================================

interface CategorySectionProps {
    category: { id: RoleCategory; label: string; description: string };
    columns: MondayColumnConfig[];
    boardConfigId: string;
    workspaceId: string;
    onColumnUpdate: (boardConfigId: string, workspaceId: string, columnId: string, update: Record<string, unknown>) => void;
}

function CategorySection({ category, columns, boardConfigId, workspaceId, onColumnUpdate }: CategorySectionProps) {
    const [expanded, setExpanded] = useState(true);

    // Check if this is a section of only ignored columns
    const allIgnored = columns.every(c => c.semanticRole === 'ignore');

    // For "other" category with only ignored columns, show compact chip layout
    if (category.id === 'other' && allIgnored && columns.length > 0) {
        return (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                    <Text weight="semibold" size="sm" color="muted">{category.label}</Text>
                    <Badge variant="neutral" size="xs">{columns.length} columns</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                    {columns.map(col => (
                        <IgnoredColumnChip
                            key={col.columnId}
                            column={col}
                            boardConfigId={boardConfigId}
                            workspaceId={workspaceId}
                            onUpdate={onColumnUpdate}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <CollapsibleRoot open={expanded} onOpenChange={setExpanded}>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <CollapsibleTrigger asChild>
                    <button className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-2">
                            <ChevronDown
                                size={16}
                                className={clsx(
                                    'text-slate-400 transition-transform',
                                    !expanded && '-rotate-90'
                                )}
                            />
                            <Text weight="semibold" size="sm">{category.label}</Text>
                            <Text size="xs" color="muted">{category.description}</Text>
                        </div>
                        <Badge variant="light" size="xs">{columns.length}</Badge>
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <Stack gap="sm" className="p-3">
                        {columns.map(col => (
                            <ColumnCard
                                key={col.columnId}
                                column={col}
                                boardConfigId={boardConfigId}
                                workspaceId={workspaceId}
                                onUpdate={onColumnUpdate}
                            />
                        ))}
                    </Stack>
                </CollapsibleContent>
            </div>
        </CollapsibleRoot>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Step3Columns({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Extract board IDs
    const boardIds = useMemo(() => {
        if (!session?.parser_config) return [];
        const config = session.parser_config;
        if (config.boardIds && Array.isArray(config.boardIds)) return config.boardIds;
        if (config.boardId) return [config.boardId];
        return [];
    }, [session]);

    // Fetch configs
    const { data: boardConfigs, isLoading } = useMondayBoardConfigs(boardIds);

    // Mutations
    const updateColumns = useUpdateMondayColumnConfigs();
    const generatePlan = useGenerateImportPlan();

    // Check for missing critical mappings
    const warnings = useMemo(() => {
        if (!boardConfigs) return [];
        const issues: string[] = [];

        for (const board of boardConfigs) {
            const hasTitle = board.columns.some(c => c.semanticRole === 'title');
            if (!hasTitle) {
                issues.push(`${board.boardName}: No Title column mapped`);
            }
        }
        return issues;
    }, [boardConfigs]);

    const handleColumnUpdate = async (boardConfigId: string, workspaceId: string, columnId: string, update: Record<string, unknown>) => {
        const board = boardConfigs?.find(b => b.id === boardConfigId);
        if (!board) return;

        const currentColumns = board.columns || [];
        const updatedColumns = currentColumns.map(c => {
            if (c.columnId === columnId) {
                return { ...c, ...update };
            }
            return c;
        });

        await updateColumns.mutateAsync({
            workspaceId,
            boardConfigId,
            columns: updatedColumns
        });
    };

    const handleNext = async () => {
        if (!session) return;

        try {
            setIsRefreshing(true);
            const newPlan = await generatePlan.mutateAsync(session.id);
            onSessionCreated(session, newPlan);
            onNext();
        } catch (err) {
            console.error('Failed to refresh plan:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!boardConfigs || boardConfigs.length === 0) {
        return (
            <Stack className="h-full">
                <Text size="lg" weight="bold">Step 3: Map Columns</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    // NOTE: Currently only single-board import is supported.
    // If multi-board sessions are added, this component will need updates.
    if (boardConfigs.length > 1) {
        console.warn(
            `[Step3Columns] Multiple boards detected (${boardConfigs.length}), but only first board will be configured. ` +
            'Multi-board support not yet implemented.'
        );
    }

    // Derived state for the current board's columns
    const currentBoard = boardConfigs[0];
    const columns = currentBoard?.columns || [];

    const sampleItem = columns.reduce((acc, col) => {
        if (col.sampleValues && col.sampleValues.length > 0) {
            acc[col.columnId] = col.sampleValues[0];
        }
        return acc;
    }, {} as Record<string, any>);

    const itemTitle = columns.find(c => c.semanticRole === 'title')?.sampleValues?.[0] || 'Sample Item';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <Stack gap="sm" className="shrink-0">
                <div className="flex items-center justify-between">
                    <Text size="lg" weight="bold">Step 3: Map Columns to Fields</Text>
                    <Button variant="secondary" onClick={() => setIsPreviewOpen(true)}>
                        Preview Mapping
                    </Button>
                </div>
                <Text size="sm" color="muted">
                    Tell AutoArt what each Monday column represents. Sample values help you identify the right mapping.
                </Text>
            </Stack>

            {/* Warnings for missing critical mappings */}
            {warnings.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <strong>Attention:</strong> {warnings.join('. ')}. Items without titles are harder to identify.
                    </div>
                </div>
            )}

            {/* Column categories */}
            <div className="flex-1 overflow-auto mt-4 min-h-0">
                {boardConfigs.map((board) => {
                    const groupedColumns = groupColumnsByCategory(board.columns);

                    return (
                        <div key={board.boardId} className="space-y-4">
                            {/* Board header */}
                            <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                                <Text weight="medium">{board.boardName}</Text>
                                <Badge variant="light" size="xs">
                                    {board.columns.length} columns
                                </Badge>
                            </div>

                            {/* Category sections */}
                            <Stack gap="md">
                                {ROLE_CATEGORIES.map(category => {
                                    const categoryColumns = groupedColumns[category.id];
                                    if (categoryColumns.length === 0) return null;

                                    return (
                                        <CategorySection
                                            key={category.id}
                                            category={category}
                                            columns={categoryColumns}
                                            boardConfigId={board.id || ''}
                                            workspaceId={board.workspaceId || ''}
                                            onColumnUpdate={handleColumnUpdate}
                                        />
                                    );
                                })}
                            </Stack>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
                <Button onClick={onBack} variant="secondary" disabled={isRefreshing}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="primary"
                    disabled={isRefreshing || updateColumns.isPending}
                >
                    {isRefreshing ? 'Regenerating Plan...' : 'Next: Templates'}
                </Button>
            </Inline>

            {currentBoard && (
                <ImportPreviewDrawer
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    columns={columns}
                    boardName={currentBoard.boardName}
                    sampleItem={sampleItem}
                    itemTitle={itemTitle}
                />
            )}
        </div>
    );
}
