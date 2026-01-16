import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { Select } from '../../../../ui/atoms/Select';
import { Badge } from '../../../../ui/atoms/Badge';
import { Spinner } from '../../../../ui/atoms/Spinner';
import { useMondayBoardConfigs, useUpdateMondayColumnConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import { MondayColumnSemanticRole } from '../../../../api/types/monday';
import { ImportPreviewDrawer } from '../components/ImportPreviewDrawer';
import { ROLE_METADATA, SEMANTIC_ROLE_OPTIONS } from '../constants/monday-roles';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

// Role metadata and options imported from constants

// Check if column type is compatible with selected role
function getTypeWarning(columnType: string, role: MondayColumnSemanticRole): string | null {
    const meta = ROLE_METADATA[role];
    if (!meta || meta.preferredTypes.length === 0) return null;

    const normalizedType = columnType.toLowerCase();
    const isCompatible = meta.preferredTypes.some(t =>
        normalizedType.includes(t) || t.includes(normalizedType)
    );

    if (!isCompatible && role !== 'custom' && role !== 'ignore') {
        return `Best with ${meta.preferredTypes.slice(0, 2).join(' or ')} columns`;
    }
    return null;
}

// Roles glossary component
function RolesGlossary({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const categories = [
        { key: 'core', label: 'Core Fields', description: 'Essential item properties' },
        { key: 'data', label: 'Data Fields', description: 'Structured data and notes' },
        { key: 'link', label: 'Link Fields', description: 'Relationships to other entities' },
        { key: 'template', label: 'Template Fields', description: 'Template configuration' },
        { key: 'other', label: 'Other', description: 'Custom and ignore options' },
    ];

    return (
        <div className="border border-slate-200 rounded-lg bg-slate-50 mt-4">
            <button
                onClick={onToggle}
                className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-100 rounded-lg transition-colors"
            >
                <Inline gap="sm" align="center">
                    <Info size={14} className="text-slate-400" />
                    <Text size="sm" weight="medium">Field Roles Reference</Text>
                </Inline>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                    {categories.map(cat => {
                        const roles = Object.entries(ROLE_METADATA)
                            .filter(([, m]) => m.category === cat.key);

                        if (roles.length === 0) return null;

                        return (
                            <div key={cat.key}>
                                <Text size="xs" weight="bold" color="muted" className="uppercase tracking-wide mb-2">
                                    {cat.label}
                                </Text>
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(([key, meta]) => (
                                        <div key={key} className="text-xs">
                                            <span className="font-medium text-slate-700">{meta.label}</span>
                                            <span className="text-slate-500"> — {meta.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function Step4Columns({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
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
                <Text size="lg" weight="bold">Step 4: Map Columns</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    // Derived state for the current board's columns
    const currentBoard = boardConfigs[0]; // Assuming single board for preview for now
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
            {/* Header with expanded explanation */}
            <Stack gap="sm" className="shrink-0">
                <div className="flex items-center justify-between">
                    <Text size="lg" weight="bold">Step 4: Map Columns to Fields</Text>
                    <Button variant="secondary" onClick={() => setIsPreviewOpen(true)}>
                        Preview Mapping
                    </Button>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                    <p>Tell AutoArt what each Monday column represents:</p>
                    <ul className="list-disc list-inside text-slate-500 ml-2 space-y-0.5">
                        <li><strong>Title</strong> becomes the main item name on cards</li>
                        <li><strong>Status</strong> and <strong>Due Date</strong> power status chips and overdue highlighting</li>
                        <li><strong>Link</strong> fields create relationships between entities</li>
                        <li><strong>Ignore</strong> columns that aren't needed in AutoArt</li>
                    </ul>
                </div>
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

            {/* Column mapping tables */}
            <div className="flex-1 overflow-auto space-y-6 mt-4 min-h-0">
                {boardConfigs.map((board) => (
                    <div key={board.boardId} className="border border-slate-200 rounded-lg bg-white">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <Text weight="medium">{board.boardName}</Text>
                            <Badge variant="light">
                                {board.columns.length} Columns
                            </Badge>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm table-fixed">
                                <thead className="text-slate-500 font-medium border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 w-[20%]">Column</th>
                                        <th className="px-4 py-2 w-[10%]">Type</th>
                                        <th className="px-4 py-2 w-[25%]">Maps To</th>
                                        <th className="px-4 py-2 w-[20%]">Alias</th>
                                        <th className="px-4 py-2 w-[25%]">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {board.columns.map((column) => {
                                        const warning = getTypeWarning(column.columnType, column.semanticRole);
                                        const roleMeta = ROLE_METADATA[column.semanticRole];

                                        return (
                                            <tr key={column.columnId} className="hover:bg-slate-50">
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-slate-700 truncate" title={column.columnTitle}>
                                                        {column.columnTitle}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="light" size="xs">
                                                        {column.columnType}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Select
                                                        value={column.semanticRole}
                                                        onChange={(val) => {
                                                            if (val && board.id && board.workspaceId) {
                                                                handleColumnUpdate(board.id, board.workspaceId, column.columnId, { semanticRole: val });
                                                            }
                                                        }}
                                                        data={SEMANTIC_ROLE_OPTIONS}
                                                        size="sm"
                                                    />
                                                    <Inline gap="xs" align="center" className="mt-1">
                                                        <Badge
                                                            variant={column.inferenceSource === 'manual' ? 'neutral' : 'light'}
                                                            size="xs"
                                                        >
                                                            {column.inferenceSource === 'manual' ? 'Manual' : 'Auto'}
                                                        </Badge>
                                                        {column.inferenceReasons && column.inferenceReasons.length > 0 && (
                                                            <div title={column.inferenceReasons.join('\n')}>
                                                                <HelpCircle size={12} className="text-slate-400 cursor-help" />
                                                            </div>
                                                        )}
                                                    </Inline>

                                                    {column.sampleValues && column.sampleValues.length > 0 && (
                                                        <div className="mt-2 pl-1 border-l-2 border-slate-100">
                                                            <div className="text-[10px] text-slate-400 font-medium mb-0.5">SAMPLES</div>
                                                            <Stack gap="xs">
                                                                {column.sampleValues.slice(0, 3).map((val, idx) => (
                                                                    <div key={idx} className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]" title={val}>
                                                                        {val}
                                                                    </div>
                                                                ))}
                                                            </Stack>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        className="w-full text-sm px-2 py-1 rounded border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder={column.columnTitle}
                                                        value={column.localFieldKey || ''}
                                                        onChange={(e) => {
                                                            if (board.id && board.workspaceId) {
                                                                handleColumnUpdate(board.id, board.workspaceId, column.columnId, { localFieldKey: e.target.value || undefined });
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    {warning ? (
                                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                                            <AlertTriangle size={12} />
                                                            {warning}
                                                        </span>
                                                    ) : roleMeta ? (
                                                        <span className="text-xs text-slate-400">
                                                            {roleMeta.description}
                                                        </span>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* Collapsible glossary */}
            <RolesGlossary isOpen={glossaryOpen} onToggle={() => setGlossaryOpen(!glossaryOpen)} />

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
