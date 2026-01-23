/**
 * Step2ConfigureMapping - Configure board and group mapping
 *
 * Drag-and-drop interface for organizing Monday groups into semantic sections.
 * Groups become subprocesses, and stages are PROJECTED by grouping subprocesses by stageKind.
 */

import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { GripVertical, ChevronDown, GitBranch, FileText, LayoutTemplate, EyeOff, Layers } from 'lucide-react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import {
    Stack,
    Text,
    Button,
    Inline,
    Spinner,
    RadixSelect,
    DebouncedInput,
    Select,
    Popover,
} from '@autoart/ui';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMondayBoardConfigs, useUpdateMondayBoardConfig, useUpdateMondayGroupConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import type { MondayGroupRole, MondayBoardRole, MondayGroupConfig, MondayBoardConfig } from '../../../../api/types/monday';
import { type StageKind, STAGE_KIND_LABELS } from '@autoart/shared';

// ============================================================================
// TYPES
// ============================================================================

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: unknown) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

type SectionId = 'workflow' | 'references' | 'templates' | 'ignored';

interface SectionConfig {
    id: SectionId;
    title: string;
    description: string;
    variant: 'blue' | 'amber' | 'green' | 'gray';
    icon: React.ReactNode;
    roles: MondayGroupRole[];
    defaultRole: MondayGroupRole;
    compact?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTIONS: SectionConfig[] = [
    {
        id: 'workflow',
        title: 'Subprocesses',
        description: 'Work containers grouped into stages by stageKind',
        icon: <GitBranch className="w-4 h-4" />,
        variant: 'blue',
        roles: ['subprocess', 'backlog', 'done', 'archive'],
        defaultRole: 'subprocess',
    },
    {
        id: 'references',
        title: 'Reference Data',
        description: 'Static records (documents, resources)',
        icon: <FileText className="w-4 h-4" />,
        variant: 'amber',
        roles: ['reference_group'],
        defaultRole: 'reference_group',
    },
    {
        id: 'templates',
        title: 'Templates',
        description: 'Reusable item templates',
        icon: <LayoutTemplate className="w-4 h-4" />,
        variant: 'green',
        roles: ['template_group'],
        defaultRole: 'template_group',
        compact: false,  // Full cards, not compact tags
    },
    {
        id: 'ignored',
        title: 'Not Imported',
        description: 'Skipped during import',
        icon: <EyeOff className="w-4 h-4" />,
        variant: 'gray',
        roles: ['ignore'],  // Removed 'stage' - groups named "Stage X:" now become subprocesses
        defaultRole: 'ignore',
        compact: true,
    },
];

const BOARD_ROLE_OPTIONS: { value: MondayBoardRole; label: string }[] = [
    { value: 'project_board', label: 'Project' },
    { value: 'action_board', label: 'Task List' },
    { value: 'template_board', label: 'Template Library' },
    { value: 'reference_board', label: 'Reference Data' },
    { value: 'overview_board', label: 'Overview' },
    { value: 'ignore', label: 'Ignore' },
];

/** Stage kind options derived from shared STAGE_KIND_LABELS */
const STAGE_KIND_OPTIONS: { value: StageKind; label: string }[] = (
    Object.entries(STAGE_KIND_LABELS) as [StageKind, string][]
).map(([value, label]) => ({ value, label }));

const REFERENCE_STRATEGY_OPTIONS = [
    { value: 'create', label: 'Always Create New' },
    { value: 'link_or_create', label: 'Link or Create' },
    { value: 'link_strict', label: 'Link Only (Skip if Missing)' },
];

// Type options for the TypeBadge dropdown - determines which section a group belongs to
const TYPE_OPTIONS: { value: MondayGroupRole; label: string; icon: string }[] = [
    { value: 'subprocess', label: 'Subprocess', icon: '⚙' },
    { value: 'template_group', label: 'Template', icon: '📋' },
    { value: 'reference_group', label: 'Reference', icon: '📄' },
    { value: 'ignore', label: 'Ignore', icon: '🚫' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infer the appropriate role for a group based on its name.
 * Groups named "Stage X:" should become subprocesses by default.
 */
function inferRoleFromGroupName(groupTitle: string, currentRole: MondayGroupRole): MondayGroupRole {
    // If already explicitly set to something other than 'stage', keep it
    if (currentRole !== 'stage') return currentRole;

    // Pattern: "Stage 1:", "Stage 2:", etc. → become subprocesses
    const stagePattern = /^Stage \d+:/i;
    if (stagePattern.test(groupTitle)) {
        return 'subprocess';
    }

    // Default fallback for other 'stage' roles → subprocess
    return 'subprocess';
}

function getSectionForRole(role: MondayGroupRole): SectionId {
    for (const section of SECTIONS) {
        if (section.roles.includes(role)) {
            return section.id;
        }
    }
    return 'ignored';
}

/**
 * Get the effective role for a group, applying name-based inference.
 */
function getEffectiveRole(group: MondayGroupConfig): MondayGroupRole {
    return inferRoleFromGroupName(group.groupTitle, group.role);
}

function groupBySection(groups: MondayGroupConfig[]): Record<SectionId, MondayGroupConfig[]> {
    const result: Record<SectionId, MondayGroupConfig[]> = {
        workflow: [],
        references: [],
        templates: [],
        ignored: [],
    };

    for (const group of groups) {
        // Use effective role (with name inference) for section placement
        const effectiveRole = getEffectiveRole(group);
        const sectionId = getSectionForRole(effectiveRole);
        result[sectionId].push(group);
    }

    return result;
}

function getStageKindLabel(stageKind: StageKind | undefined): string {
    return stageKind ? STAGE_KIND_LABELS[stageKind] : STAGE_KIND_LABELS.todo;
}

function getStageKindColor(stageKind: StageKind | undefined): string {
    switch (stageKind) {
        case 'todo': return 'text-slate-600 bg-slate-100';
        case 'in_progress': return 'text-blue-600 bg-blue-100';
        case 'blocked': return 'text-red-600 bg-red-100';
        case 'done': return 'text-green-600 bg-green-100';
        case 'archive': return 'text-gray-500 bg-gray-100';
        default: return 'text-slate-600 bg-slate-100';
    }
}

function getStageKindBorderColor(stageKind: StageKind): string {
    switch (stageKind) {
        case 'todo': return 'border-slate-300';
        case 'in_progress': return 'border-blue-300';
        case 'blocked': return 'border-red-300';
        case 'done': return 'border-green-300';
        case 'archive': return 'border-gray-300';
        default: return 'border-slate-300';
    }
}

function groupByStageKind(groups: MondayGroupConfig[]): Record<StageKind, MondayGroupConfig[]> {
    const result: Record<StageKind, MondayGroupConfig[]> = {
        todo: [],
        in_progress: [],
        blocked: [],
        done: [],
        archive: [],
    };
    for (const group of groups) {
        const kind = group.stageKind || 'todo';
        result[kind].push(group);
    }
    return result;
}

function getRoleLabel(role: MondayGroupRole): string {
    const option = TYPE_OPTIONS.find(o => o.value === role);
    return option?.label || 'Subprocess';
}

function getRoleBadgeClass(role: MondayGroupRole): string {
    switch (role) {
        case 'subprocess':
        case 'backlog':
        case 'done':
        case 'archive':
            return 'type-badge-subprocess';
        case 'template_group':
            return 'type-badge-template';
        case 'reference_group':
            return 'type-badge-reference';
        case 'ignore':
        case 'stage':
            return 'type-badge-ignore';
        default:
            return 'type-badge-subprocess';
    }
}

// ============================================================================
// TYPE BADGE COMPONENT - Clickable badge to change group role/type
// ============================================================================

interface TypeBadgeProps {
    group: MondayGroupConfig;
    onRoleChange: (newRole: MondayGroupRole) => void;
}

function TypeBadge({ group, onRoleChange }: TypeBadgeProps) {
    const effectiveRole = getEffectiveRole(group);
    const currentLabel = getRoleLabel(effectiveRole);
    const badgeClass = getRoleBadgeClass(effectiveRole);

    return (
        <Popover
            trigger={
                <button className={clsx(
                    'type-badge',
                    badgeClass
                )}>
                    {currentLabel} ▾
                </button>
            }
            contentClassName="p-1 w-40"
            align="end"
        >
            <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">Convert To</div>
            {TYPE_OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onRoleChange(opt.value)}
                    disabled={opt.value === effectiveRole}
                    className={clsx(
                        'w-full text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 transition-colors',
                        opt.value === effectiveRole
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'text-slate-700 hover:bg-indigo-50'
                    )}
                >
                    <span>{opt.icon}</span> {opt.label}
                </button>
            ))}
        </Popover>
    );
}

// ============================================================================
// STAGE DROP ZONE COMPONENT - Droppable zone for each stage within workflow
// ============================================================================

interface StageDropZoneProps {
    stageKind: StageKind;
    groups: MondayGroupConfig[];
    onGroupUpdate: (groupId: string, updates: Partial<MondayGroupConfig>) => void;
    onRoleChange: (groupId: string, newRole: MondayGroupRole) => void;
    allGroups: MondayGroupConfig[];
}

function StageDropZone({ stageKind, groups, onGroupUpdate, onRoleChange, allGroups }: StageDropZoneProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `stage-${stageKind}`,
        data: { type: 'stage', stageKind }
    });

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                'border-l-3 pl-3 py-2 transition-all rounded-r',
                getStageKindBorderColor(stageKind),
                isOver && 'bg-blue-50/50 ring-2 ring-blue-300 ring-inset'
            )}
        >
            <Text
                size="xs"
                weight="semibold"
                className={clsx(
                    'mb-1.5 px-2 py-0.5 rounded-sm inline-block',
                    getStageKindColor(stageKind)
                )}
            >
                {getStageKindLabel(stageKind)}
            </Text>

            {groups.length === 0 ? (
                <div className="py-2 px-3 text-xs text-slate-400 italic border border-dashed border-slate-300 rounded bg-white/50">
                    ↓ Drop items here
                </div>
            ) : (
                <Stack gap="xs">
                    <SortableContext
                        items={groups.map(g => g.groupId)}
                        strategy={verticalListSortingStrategy}
                    >
                        {groups.map((group) => (
                            <CollapsibleGroupCard
                                key={group.groupId}
                                group={group}
                                sectionId="workflow"
                                onUpdate={onGroupUpdate}
                                onRoleChange={onRoleChange}
                                allGroups={allGroups}
                            />
                        ))}
                    </SortableContext>
                </Stack>
            )}
        </div>
    );
}

// ============================================================================
// DROPPABLE SECTION COMPONENT
// ============================================================================

interface DroppableSectionProps {
    section: SectionConfig;
    groups: MondayGroupConfig[];
    children: React.ReactNode;
    renderGroupedByStage?: (groupedByStageKind: Record<StageKind, MondayGroupConfig[]>) => React.ReactNode;
}

function DroppableSection({ section, groups, children, renderGroupedByStage }: DroppableSectionProps) {
    const { setNodeRef, isOver } = useDroppable({ id: section.id });

    const variantStyles: Record<SectionConfig['variant'], string> = {
        blue: 'bg-blue-50/50 border-blue-200',
        amber: 'bg-amber-50/50 border-amber-200',
        green: 'bg-green-50/50 border-green-200',
        gray: 'bg-slate-50/50 border-slate-200 opacity-70',
    };

    const iconColors: Record<SectionConfig['variant'], string> = {
        blue: 'text-blue-500',
        amber: 'text-amber-500',
        green: 'text-green-500',
        gray: 'text-slate-400',
    };

    const ringColors: Record<SectionConfig['variant'], string> = {
        blue: 'ring-blue-400',
        amber: 'ring-amber-400',
        green: 'ring-green-400',
        gray: 'ring-slate-400',
    };

    // Compact sections render as inline tag rows
    if (section.compact) {
        return (
            <div
                ref={setNodeRef}
                className={clsx(
                    'rounded-lg border border-dashed px-3 py-2 transition-all',
                    section.variant === 'gray' ? 'bg-slate-50/30 border-slate-200' : variantStyles[section.variant],
                    isOver && `border-solid ring-2 ring-offset-1 ${ringColors[section.variant]}`
                )}
            >
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={clsx(iconColors[section.variant], 'opacity-70')}>{section.icon}</span>
                        <Text weight="medium" size="xs" color="muted">{section.title}:</Text>
                    </div>
                    {groups.length === 0 ? (
                        <Text size="xs" color="muted" className="italic">Drag groups here</Text>
                    ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {children}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Calculate grouped by stage for workflow section
    const groupedByStageKind = section.id === 'workflow' ? groupByStageKind(groups) : null;

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                'rounded-lg border-2 border-dashed p-3 transition-all',
                variantStyles[section.variant],
                isOver && `border-solid ring-2 ring-offset-2 ${ringColors[section.variant]}`
            )}
        >
            <div className="flex items-center gap-2 mb-2">
                <span className={iconColors[section.variant]}>{section.icon}</span>
                <Text weight="semibold" size="sm">{section.title}</Text>
                <Text color="muted" size="xs" className="ml-1">{section.description}</Text>
            </div>
            {groups.length === 0 ? (
                <div className="py-3 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded bg-white/50">
                    Drag groups here
                </div>
            ) : section.id === 'workflow' && groupedByStageKind && renderGroupedByStage ? (
                renderGroupedByStage(groupedByStageKind)
            ) : (
                <Stack gap="xs">
                    {children}
                </Stack>
            )}
        </div>
    );
}

// ============================================================================
// NESTED CHILD DROP ZONE COMPONENT
// ============================================================================

interface NestedChildDropZoneProps {
    parentGroupId: string;
    childGroups: MondayGroupConfig[];
    onRemoveChild: (childGroupId: string) => void;
}

function NestedChildDropZone({ parentGroupId, childGroups, onRemoveChild }: NestedChildDropZoneProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `nested-${parentGroupId}`,
        data: { type: 'nested', parentGroupId }
    });

    return (
        <div
            ref={setNodeRef}
            className={clsx(
                'mt-2 border-2 border-dashed rounded-md p-2 transition-all',
                isOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-300 bg-white/50',
                childGroups.length === 0 && 'min-h-[40px]'
            )}
        >
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5 flex items-center gap-1">
                <span>↳</span> Child Groups
                <span
                    className="normal-case font-normal text-slate-300 ml-1"
                    title="Children retain parent stage context while having their own workflow position"
                >
                    (inherit context)
                </span>
            </div>
            {childGroups.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-1">
                    Drop groups here to nest them under this subprocess
                </div>
            ) : (
                <Stack gap="xs">
                    {childGroups.map((child) => (
                        <div
                            key={child.groupId}
                            className="flex items-center gap-2 bg-white rounded border border-slate-200 px-2 py-1.5 text-xs"
                        >
                            <GripVertical className="w-3 h-3 text-slate-300" />
                            <span className="flex-1 truncate font-medium">{child.groupTitle}</span>
                            <button
                                onClick={() => onRemoveChild(child.groupId)}
                                className="text-slate-400 hover:text-red-500 text-[10px] px-1"
                                title="Remove from parent"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </Stack>
            )}
        </div>
    );
}

// ============================================================================
// COLLAPSIBLE GROUP CARD COMPONENT
// ============================================================================

interface CollapsibleGroupCardProps {
    group: MondayGroupConfig;
    sectionId: SectionId;
    onUpdate: (groupId: string, updates: Partial<MondayGroupConfig>) => void;
    onRoleChange?: (groupId: string, newRole: MondayGroupRole) => void;
    allGroups: MondayGroupConfig[];
}

function CollapsibleGroupCard({ group, sectionId, onUpdate, onRoleChange, allGroups }: CollapsibleGroupCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: group.groupId,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Find child groups (groups that have this group as their parent)
    const childGroups = useMemo(() => {
        return allGroups.filter(g => g.settings?.parentGroupId === group.groupId);
    }, [allGroups, group.groupId]);

    // Check if this group has a parent
    const parentGroup = useMemo(() => {
        if (!group.settings?.parentGroupId) return null;
        return allGroups.find(g => g.groupId === group.settings?.parentGroupId);
    }, [allGroups, group.settings?.parentGroupId]);

    // Calculate projection info for workflow groups
    const projectionInfo = useMemo(() => {
        if (sectionId !== 'workflow') return null;

        const stageKind = group.stageKind || 'todo';
        const label = getStageKindLabel(stageKind);

        // Count how many other groups share this stageKind (excluding children)
        const sameStageGroups = allGroups.filter(
            g => getSectionForRole(g.role) === 'workflow' &&
                 (g.stageKind || 'todo') === stageKind &&
                 !g.settings?.parentGroupId // Only count top-level groups
        );

        return {
            stageKind,
            label,
            siblingCount: sameStageGroups.length,
        };
    }, [sectionId, group.stageKind, allGroups]);

    // Reference strategy info
    const referenceInfo = useMemo(() => {
        if (sectionId !== 'references') return null;
        const strategy = (group.settings?.referenceStrategy as string) || 'create';
        const option = REFERENCE_STRATEGY_OPTIONS.find(o => o.value === strategy);
        return option?.label || 'Always Create New';
    }, [sectionId, group.settings]);

    // Handler to remove a child from this parent
    const handleRemoveChild = useCallback((childGroupId: string) => {
        onUpdate(childGroupId, { settings: { ...allGroups.find(g => g.groupId === childGroupId)?.settings, parentGroupId: undefined } });
    }, [onUpdate, allGroups]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                'bg-white rounded-lg border shadow-sm',
                isDragging && 'shadow-lg z-10 border-blue-400',
                parentGroup && 'ml-4 border-l-2 border-l-indigo-300' // Indent if this is a child
            )}
        >
            <CollapsiblePrimitive.Root>
                <div className="px-2 py-1.5 flex items-center gap-2">
                    {/* Drag handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0"
                    >
                        <GripVertical className="w-3 h-3" />
                    </button>

                    {/* Collapsible trigger with title */}
                    <CollapsiblePrimitive.Trigger asChild>
                        <button className="flex items-center gap-1 flex-1 min-w-0 text-left group">
                            <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                            <span className="font-medium text-sm truncate">{group.groupTitle}</span>
                            {childGroups.length > 0 && (
                                <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                    {childGroups.length} child{childGroups.length > 1 ? 'ren' : ''}
                                </span>
                            )}
                            {/* Parent context indicator - shows inherited stage */}
                            {parentGroup && (
                                <span
                                    className={clsx(
                                        'text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1',
                                        'bg-slate-100 text-slate-500 border border-slate-200'
                                    )}
                                    title={`Nested under "${parentGroup.groupTitle}" (${getStageKindLabel(parentGroup.stageKind)})`}
                                >
                                    <Layers size={10} className="opacity-60" />
                                    <span className="opacity-75">in</span>
                                    <span className={clsx(
                                        'font-medium',
                                        getStageKindColor(parentGroup.stageKind || 'todo').split(' ')[0]
                                    )}>
                                        {getStageKindLabel(parentGroup.stageKind)}
                                    </span>
                                </span>
                            )}
                        </button>
                    </CollapsiblePrimitive.Trigger>

                    {/* Type badge - allows changing group role */}
                    {onRoleChange && (
                        <TypeBadge
                            group={group}
                            onRoleChange={(newRole) => onRoleChange(group.groupId, newRole)}
                        />
                    )}

                    {/* Inline controls */}
                    {sectionId === 'workflow' && (
                        <RadixSelect
                            value={group.stageKind || 'todo'}
                            onChange={(val) => val && onUpdate(group.groupId, { stageKind: val as StageKind })}
                            data={STAGE_KIND_OPTIONS}
                            size="sm"
                        />
                    )}
                    {sectionId === 'references' && (
                        <RadixSelect
                            value={(group.settings?.referenceStrategy as string) || 'create'}
                            onChange={(val) => val && onUpdate(group.groupId, {
                                settings: { ...group.settings, referenceStrategy: val as 'create' | 'link_or_create' | 'link_strict' }
                            })}
                            data={REFERENCE_STRATEGY_OPTIONS}
                            size="sm"
                        />
                    )}
                </div>

                {/* Collapsible details */}
                <CollapsiblePrimitive.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    <div className="px-3 pb-2 pt-0.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
                        {sectionId === 'workflow' && projectionInfo && (
                            <div className="space-y-1.5">
                                {parentGroup ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Layers size={12} className="text-indigo-400" />
                                            <span>
                                                Nested subprocess of{' '}
                                                <span className="font-semibold text-slate-800">{parentGroup.groupTitle}</span>
                                            </span>
                                        </div>
                                        <div className="ml-5 text-slate-500 text-[11px]">
                                            Items in this group retain context from parent's{' '}
                                            <span className={clsx(
                                                'font-medium px-1 py-0.5 rounded',
                                                getStageKindColor(parentGroup.stageKind || 'todo')
                                            )}>
                                                {getStageKindLabel(parentGroup.stageKind)}
                                            </span>{' '}
                                            stage while progressing through their own workflow.
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-slate-500">
                                            This group becomes a <span className="font-semibold text-blue-600">subprocess</span> assigned to:
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', getStageKindColor(projectionInfo.stageKind))}>
                                                {projectionInfo.label}
                                            </span>
                                            <span className="text-slate-400">stage</span>
                                        </div>
                                        {projectionInfo.siblingCount > 1 && (
                                            <div className="text-slate-400 text-[11px]">
                                                + {projectionInfo.siblingCount - 1} other subprocess{projectionInfo.siblingCount > 2 ? 'es' : ''} in this stage
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Nested child drop zone - only show for top-level workflow groups */}
                                {!parentGroup && onRoleChange && (
                                    <NestedChildDropZone
                                        parentGroupId={group.groupId}
                                        childGroups={childGroups}
                                        onRemoveChild={handleRemoveChild}
                                    />
                                )}
                            </div>
                        )}
                        {sectionId === 'references' && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Import strategy:</span>
                                    <span className="font-medium">{referenceInfo}</span>
                                </div>
                                <div className="text-slate-400 italic">
                                    Reference items are stored separately and can be linked across projects
                                </div>
                            </div>
                        )}
                        {sectionId === 'templates' && (
                            <div className="text-slate-400 italic">
                                Templates can be instantiated to create new items with predefined fields
                            </div>
                        )}
                        {sectionId === 'ignored' && (
                            <div className="text-slate-400 italic">
                                This group and its items will not be imported
                            </div>
                        )}
                    </div>
                </CollapsiblePrimitive.Content>
            </CollapsiblePrimitive.Root>
        </div>
    );
}

// ============================================================================
// DRAGGABLE TAG PILL COMPONENT (for compact sections with right-click removal)
// ============================================================================

interface DraggableTagPillProps {
    group: MondayGroupConfig;
    variant: SectionConfig['variant'];
    onRemove?: () => void;
}

function DraggableTagPill({ group, variant, onRemove }: DraggableTagPillProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: group.groupId,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const tagColors: Record<SectionConfig['variant'], string> = {
        blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
        amber: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200',
        green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
        gray: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
    };

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onRemove?.();
    }, [onRemove]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            onContextMenu={handleContextMenu}
            className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-grab transition-colors',
                tagColors[variant],
                isDragging && 'shadow-lg ring-2 ring-offset-1 ring-blue-400'
            )}
            title="Drag to move, right-click to remove"
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab"
            >
                <GripVertical className="w-2.5 h-2.5 opacity-50" />
            </button>
            <span className="truncate max-w-[150px]">{group.groupTitle}</span>
        </div>
    );
}

// ============================================================================
// BOARD CONFIGURATION PANEL
// ============================================================================

interface BoardConfigPanelProps {
    config: MondayBoardConfig;
    onTitleChange: (newTitle: string) => void;
    onRoleChange: (newRole: MondayBoardRole) => void;
    onGroupUpdate: (groupId: string, updates: Partial<MondayGroupConfig>) => void;
    onGroupRoleChange: (groupId: string, newRole: MondayGroupRole) => void;
}

function BoardConfigPanel({ config, onTitleChange, onRoleChange, onGroupUpdate, onGroupRoleChange }: BoardConfigPanelProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const groupedGroups = useMemo(() => groupBySection(config.groups), [config.groups]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const groupId = active.id as string;
        const overId = over.id as string;
        const overData = over.data.current;

        // Find current group
        const group = config.groups.find(g => g.groupId === groupId);
        if (!group) return;

        // Check if dropped on a nested child zone (to set parentGroupId)
        if (overData?.type === 'nested') {
            const parentGroupId = overData.parentGroupId as string;
            // Can't nest a group under itself
            if (parentGroupId === groupId) return;

            // Check for circular references by walking up the parent chain
            const wouldBeCircular = (() => {
                const visited = new Set<string>();
                let current: string | undefined = parentGroupId;
                while (current) {
                    if (visited.has(current)) return true; // Already visited = cycle
                    if (current === groupId) return true; // Found the group we're trying to nest
                    visited.add(current);
                    const parentGroup = config.groups.find(g => g.groupId === current);
                    current = parentGroup?.settings?.parentGroupId;
                }
                return false;
            })();
            if (wouldBeCircular) return;

            // Set the parentGroupId and ensure it's in the workflow section
            onGroupUpdate(groupId, {
                role: 'subprocess',
                settings: { ...group.settings, parentGroupId }
            });
            return;
        }

        // Check if dropped on a stage zone (stage-todo, stage-in_progress, etc.)
        if (overData?.type === 'stage') {
            const targetStageKind = overData.stageKind as StageKind;
            // Update role to subprocess, set stageKind, and clear any parentGroupId
            onGroupUpdate(groupId, {
                role: 'subprocess',
                stageKind: targetStageKind,
                settings: { ...group.settings, parentGroupId: undefined }
            });
            return;
        }

        // Check if dropped on a section directly
        let targetSectionId: SectionId | null = SECTIONS.find(s => s.id === overId)?.id || null;

        // If not dropped on a section, check if dropped on another card
        if (!targetSectionId) {
            const targetGroup = config.groups.find(g => g.groupId === overId);
            if (targetGroup) {
                targetSectionId = getSectionForRole(getEffectiveRole(targetGroup));
            }
        }

        if (!targetSectionId) return;

        // Find target section config
        const targetSection = SECTIONS.find(s => s.id === targetSectionId);
        if (!targetSection) return;

        // Check if group is already in this section
        const currentSection = getSectionForRole(getEffectiveRole(group));
        if (currentSection === targetSectionId) return;

        // Update the group's role and clear parentGroupId when moving to a different section
        const newRole = targetSection.defaultRole;
        const isWorkflowRole = ['subprocess', 'backlog', 'done', 'archive'].includes(newRole);
        onGroupUpdate(groupId, {
            role: newRole,
            stageKind: isWorkflowRole ? (group.stageKind || 'todo') : undefined,
            settings: { ...group.settings, parentGroupId: undefined }
        });
    }, [config.groups, onGroupUpdate]);

    const activeGroup = activeId ? config.groups.find(g => g.groupId === activeId) : null;

    return (
        <Stack gap="md" className="h-full overflow-hidden">
            {/* Board Header */}
            <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex-1 min-w-0">
                        <Text size="xs" color="muted" className="mb-1">Project Title</Text>
                        <DebouncedInput
                            value={config.settings?.projectTitleOverride || config.boardName}
                            onCommit={onTitleChange}
                            className="text-base font-medium w-full"
                            placeholder="Project title..."
                        />
                    </div>
                    <div className="shrink-0">
                        <Text size="xs" color="muted" className="mb-1">Source</Text>
                        <Text size="sm" color="muted">{config.boardName}</Text>
                    </div>
                    <div className="shrink-0 w-32">
                        <Text size="xs" color="muted" className="mb-1">Role</Text>
                        <Select
                            value={config.role}
                            onChange={(val) => val && onRoleChange(val as MondayBoardRole)}
                            data={BOARD_ROLE_OPTIONS}
                            size="sm"
                        />
                    </div>
                </div>
            </div>

            {/* Group Sections with DnD */}
            <div className="flex-1 overflow-auto min-h-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(event) => setActiveId(event.active.id as string)}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                >
                    <Stack gap="sm">
                        {SECTIONS.map((section) => {
                            const sectionGroups = groupedGroups[section.id];
                            return (
                                <DroppableSection
                                    key={section.id}
                                    section={section}
                                    groups={sectionGroups}
                                    renderGroupedByStage={section.id === 'workflow' ? (groupedByStage) => (
                                        <Stack gap="sm">
                                            {/* Show ALL 5 stages, even when empty */}
                                            {STAGE_KIND_OPTIONS.map(stageKindOption => (
                                                <StageDropZone
                                                    key={stageKindOption.value}
                                                    stageKind={stageKindOption.value}
                                                    groups={groupedByStage[stageKindOption.value]}
                                                    onGroupUpdate={onGroupUpdate}
                                                    onRoleChange={onGroupRoleChange}
                                                    allGroups={config.groups}
                                                />
                                            ))}
                                        </Stack>
                                    ) : undefined}
                                >
                                    <SortableContext
                                        items={sectionGroups.map(g => g.groupId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {sectionGroups.map((group) => (
                                            section.compact ? (
                                                <DraggableTagPill
                                                    key={group.groupId}
                                                    group={group}
                                                    variant={section.variant}
                                                    onRemove={() => {
                                                        // Right-click removal moves to "ignored" section
                                                        onGroupRoleChange(group.groupId, 'ignore');
                                                    }}
                                                />
                                            ) : (
                                                <CollapsibleGroupCard
                                                    key={group.groupId}
                                                    group={group}
                                                    sectionId={section.id}
                                                    onUpdate={onGroupUpdate}
                                                    onRoleChange={onGroupRoleChange}
                                                    allGroups={config.groups}
                                                />
                                            )
                                        ))}
                                    </SortableContext>
                                </DroppableSection>
                            );
                        })}
                    </Stack>

                    <DragOverlay>
                        {activeGroup && (() => {
                            const activeSection = SECTIONS.find(s => s.roles.includes(activeGroup.role));
                            const isCompact = activeSection?.compact;

                            if (isCompact) {
                                return (
                                    <div className={clsx(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shadow-lg',
                                        activeSection?.variant === 'green' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-slate-100 text-slate-600 border-slate-300'
                                    )}>
                                        <GripVertical className="w-2.5 h-2.5 opacity-50" />
                                        <span className="truncate max-w-[150px]">{activeGroup.groupTitle}</span>
                                    </div>
                                );
                            }

                            return (
                                <div className="bg-white rounded-lg border border-blue-400 px-2 py-1.5 shadow-lg flex items-center gap-2 text-sm">
                                    <GripVertical className="w-3 h-3 text-slate-400" />
                                    <span className="font-medium text-sm">{activeGroup.groupTitle}</span>
                                </div>
                            );
                        })()}
                    </DragOverlay>
                </DndContext>
            </div>
        </Stack>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Step2ConfigureMapping({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Extract board IDs from session config
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
    const updateBoardConfig = useUpdateMondayBoardConfig();
    const updateGroupConfigs = useUpdateMondayGroupConfigs();
    const generatePlan = useGenerateImportPlan();

    const handleTitleChange = useCallback(async (config: MondayBoardConfig, newTitle: string) => {
        if (!config.workspaceId || !config.id) return;

        const currentSettings = config.settings || {};
        const newSettings = {
            ...currentSettings,
            projectTitleOverride: newTitle !== config.boardName ? newTitle : undefined,
        };

        await updateBoardConfig.mutateAsync({
            workspaceId: config.workspaceId,
            boardConfigId: config.id,
            update: { settings: newSettings }
        });
    }, [updateBoardConfig]);

    const handleRoleChange = useCallback(async (config: MondayBoardConfig, newRole: MondayBoardRole) => {
        if (!config.workspaceId || !config.id) return;

        await updateBoardConfig.mutateAsync({
            workspaceId: config.workspaceId,
            boardConfigId: config.id,
            update: { role: newRole }
        });
    }, [updateBoardConfig]);

    const handleGroupUpdate = useCallback(async (
        config: MondayBoardConfig,
        groupId: string,
        updates: Partial<MondayGroupConfig>
    ) => {
        if (!config.workspaceId || !config.id) return;

        const currentGroups = config.groups || [];
        const updatedGroups = currentGroups.map(g => {
            if (g.groupId === groupId) {
                return { ...g, ...updates };
            }
            return g;
        });

        await updateGroupConfigs.mutateAsync({
            workspaceId: config.workspaceId,
            boardConfigId: config.id,
            groups: updatedGroups
        });
    }, [updateGroupConfigs]);

    const handleGroupRoleChange = useCallback(async (
        config: MondayBoardConfig,
        groupId: string,
        newRole: MondayGroupRole
    ) => {
        if (!config.workspaceId || !config.id) return;

        const currentGroups = config.groups || [];
        const updatedGroups = currentGroups.map(g => {
            if (g.groupId === groupId) {
                const isWorkflowRole = ['subprocess', 'backlog', 'done', 'archive'].includes(newRole);
                return {
                    ...g,
                    role: newRole,
                    stageKind: isWorkflowRole ? (g.stageKind || 'todo' as StageKind) : undefined,
                };
            }
            return g;
        });

        await updateGroupConfigs.mutateAsync({
            workspaceId: config.workspaceId,
            boardConfigId: config.id,
            groups: updatedGroups
        });
    }, [updateGroupConfigs]);

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
            <Stack className="h-full items-center justify-center">
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack} variant="secondary">Back</Button>
            </Stack>
        );
    }

    const currentConfig = boardConfigs[0];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <Stack gap="xs" className="shrink-0 mb-4">
                <Text size="lg" weight="bold">Step 2: Configure Mapping</Text>
                <Text color="muted" size="sm">
                    Groups become subprocesses. Assign each subprocess to a stage. Drag between sections to change role.
                </Text>
            </Stack>

            {/* Configuration Panel */}
            <div className="flex-1 min-h-0">
                <BoardConfigPanel
                    config={currentConfig}
                    onTitleChange={(newTitle) => handleTitleChange(currentConfig, newTitle)}
                    onRoleChange={(newRole) => handleRoleChange(currentConfig, newRole)}
                    onGroupUpdate={(groupId, updates) => handleGroupUpdate(currentConfig, groupId, updates)}
                    onGroupRoleChange={(groupId, newRole) => handleGroupRoleChange(currentConfig, groupId, newRole)}
                />
            </div>

            {/* Footer */}
            <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
                <Button onClick={onBack} variant="secondary" disabled={isRefreshing}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="primary"
                    disabled={isRefreshing || updateBoardConfig.isPending || updateGroupConfigs.isPending}
                >
                    {isRefreshing ? 'Generating Plan...' : 'Next: Columns'}
                </Button>
            </Inline>
        </div>
    );
}
