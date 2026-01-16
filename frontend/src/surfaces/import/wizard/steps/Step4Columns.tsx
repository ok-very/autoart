import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { Select } from '../../../../ui/atoms/Select';
import { Badge } from '../../../../ui/atoms/Badge';
import { Spinner } from '../../../../ui/atoms/Spinner';
import { useMondayBoardConfigs, useUpdateMondayColumnConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import type { MondayColumnSemanticRole } from '../../../../api/types/monday';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

// Role metadata with descriptions and preferred types
const ROLE_METADATA: Record<MondayColumnSemanticRole, {
    label: string;
    description: string;
    preferredTypes: string[];
    category: 'core' | 'data' | 'template' | 'link' | 'other';
}> = {
    title: {
        label: 'Title',
        description: 'Main item name shown on cards and lists',
        preferredTypes: ['name', 'text'],
        category: 'core',
    },
    description: {
        label: 'Description',
        description: 'Long-form details shown in item panel',
        preferredTypes: ['text', 'long_text'],
        category: 'core',
    },
    status: {
        label: 'Status',
        description: 'Powers status pills, filters, and dashboards',
        preferredTypes: ['status', 'color'],
        category: 'core',
    },
    due_date: {
        label: 'Due Date',
        description: 'Enables overdue highlighting and date filters',
        preferredTypes: ['date', 'timeline'],
        category: 'core',
    },
    assignee: {
        label: 'Assignee',
        description: 'Person responsible, used in workload views',
        preferredTypes: ['people', 'person'],
        category: 'core',
    },
    priority: {
        label: 'Priority',
        description: 'Priority level for sorting and filtering',
        preferredTypes: ['status', 'dropdown'],
        category: 'core',
    },
    tags: {
        label: 'Tags',
        description: 'Labels for grouping and filtering',
        preferredTypes: ['tags', 'dropdown'],
        category: 'core',
    },
    estimate: {
        label: 'Estimate',
        description: 'Effort/time estimate for planning',
        preferredTypes: ['numbers', 'hour'],
        category: 'core',
    },
    identifier: {
        label: 'Identifier',
        description: 'External ID or reference number',
        preferredTypes: ['text', 'numbers'],
        category: 'core',
    },
    fact: {
        label: 'Fact',
        description: 'Structured data for analytics (requires fact kind)',
        preferredTypes: ['text', 'numbers', 'dropdown'],
        category: 'data',
    },
    note: {
        label: 'Note',
        description: 'Free-form note attached to item',
        preferredTypes: ['text', 'long_text'],
        category: 'data',
    },
    metric: {
        label: 'Metric',
        description: 'Numeric data for charts and reports',
        preferredTypes: ['numbers', 'formula'],
        category: 'data',
    },
    template_name: {
        label: 'Template Name',
        description: 'Name of a template to create/link',
        preferredTypes: ['text', 'name'],
        category: 'template',
    },
    template_key: {
        label: 'Template Key',
        description: 'Unique key for template matching',
        preferredTypes: ['text'],
        category: 'template',
    },
    link_to_template: {
        label: 'Link to Template',
        description: 'Creates relationship to a template',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_project: {
        label: 'Link to Project',
        description: 'Creates relationship to a project',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_subprocess: {
        label: 'Link to Subprocess',
        description: 'Creates relationship to a subprocess',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_action: {
        label: 'Link to Action',
        description: 'Creates relationship to another action',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards', 'dependency'],
        category: 'link',
    },
    link_to_record: {
        label: 'Link to Record',
        description: 'Creates relationship to a record',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    dependency: {
        label: 'Dependency',
        description: 'Creates dependency link to same entity type',
        preferredTypes: ['dependency', 'board_relation'],
        category: 'link',
    },
    custom: {
        label: 'Custom',
        description: 'Stored as custom field, not used by core UI',
        preferredTypes: [],
        category: 'other',
    },
    ignore: {
        label: 'Ignore',
        description: 'Column will not be imported',
        preferredTypes: [],
        category: 'other',
    },
};

const SEMANTIC_ROLE_OPTIONS: { value: MondayColumnSemanticRole; label: string }[] = 
    Object.entries(ROLE_METADATA).map(([value, meta]) => ({
        value: value as MondayColumnSemanticRole,
        label: meta.label,
    }));

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

    return (
        <div className="flex flex-col h-full">
            {/* Header with expanded explanation */}
            <Stack gap="sm" className="shrink-0">
                <Text size="lg" weight="bold">Step 4: Map Columns to Fields</Text>
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
                                        <th className="px-4 py-2 w-[25%]">Column</th>
                                        <th className="px-4 py-2 w-[15%]">Type</th>
                                        <th className="px-4 py-2 w-[35%]">Maps To</th>
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
        </div>
    );
}
