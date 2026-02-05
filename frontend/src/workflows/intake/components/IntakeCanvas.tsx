/**
 * IntakeCanvas - Scrollable canvas for form blocks
 *
 * Supports drag-and-drop reordering via @dnd-kit/sortable
 */

import { useCallback } from 'react';
import { Trash2, GripVertical, Copy, Plus, Type, AlignLeft, AtSign, Phone, Hash, Calendar, Clock, Upload, List, CheckSquare, ChevronDown, Heading, FileText, Image } from 'lucide-react';
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownLabel,
    DropdownSeparator
} from '@autoart/ui';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormBlock } from '@autoart/shared';
import { EditorBlockRenderer } from './editor-blocks';
import { BlockRecordBindingEditor } from './BlockRecordBindingEditor';

interface IntakeCanvasProps {
    blocks: FormBlock[];
    activeBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlock: (id: string, updates: Partial<FormBlock>) => void;
    onReorderBlocks: (blocks: FormBlock[]) => void;
    onDuplicateBlock: (id: string) => void;
    onAddBlock: (type: string) => void;
}

const inputBlocks = [
    { id: 'short_answer', icon: Type, label: 'Short Answer' },
    { id: 'paragraph', icon: AlignLeft, label: 'Paragraph' },
    { id: 'email', icon: AtSign, label: 'Email' },
    { id: 'phone', icon: Phone, label: 'Phone' },
    { id: 'number', icon: Hash, label: 'Number' },
    { id: 'date', icon: Calendar, label: 'Date' },
    { id: 'time', icon: Clock, label: 'Time' },
    { id: 'file_upload', icon: Upload, label: 'File Upload' },
];

const choiceBlocks = [
    { id: 'multiple_choice', icon: List, label: 'Multiple Choice' },
    { id: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
    { id: 'dropdown', icon: ChevronDown, label: 'Dropdown' },
];

const layoutBlocks = [
    { id: 'section_header', icon: Heading, label: 'Section Header' },
    { id: 'description', icon: FileText, label: 'Description' },
    { id: 'image', icon: Image, label: 'Image' },
];

interface SortableBlockProps {
    block: FormBlock;
    isActive: boolean;
    allBlocks: FormBlock[];
    onSelectBlock: (id: string) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlock: (id: string, updates: Partial<FormBlock>) => void;
    onDuplicateBlock: (id: string) => void;
}

function SortableBlock({
    block,
    isActive,
    allBlocks,
    onSelectBlock,
    onDeleteBlock,
    onUpdateBlock,
    onDuplicateBlock,
}: SortableBlockProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelectBlock(block.id)}
            className={`bg-ws-panel-bg rounded-xl border p-6 transition-all cursor-pointer ${isActive
                ? 'border-[var(--ws-accent)]/30 shadow-md border-l-4 border-l-[var(--ws-accent)]'
                : 'border-ws-panel-border hover:border-slate-300'
                } ${isDragging ? 'shadow-lg z-10' : ''}`}
        >
            {/* Edit View (when active) */}
            {isActive ? (
                <div>
                    <div className="flex gap-4 items-start mb-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={block.kind === 'module' ? block.label : ''}
                                onChange={(e) => {
                                    if (block.kind === 'module') {
                                        onUpdateBlock(block.id, { label: e.target.value });
                                    }
                                }}
                                placeholder="Question title"
                                className="w-full bg-ws-bg p-3 text-base font-medium border-b-2 border-[var(--ws-accent)] focus:outline-none rounded-t"
                            />
                        </div>
                        <div className="px-3 py-2 bg-ws-bg border border-ws-panel-border rounded text-sm text-ws-text-secondary">
                            {block.kind === 'module' && typeof block.type === 'string' ? block.type.replace('_', ' ') : 'Record'}
                        </div>
                    </div>

                    {/* Block-specific preview */}
                    <div className="mb-4">
                        <EditorBlockRenderer block={block} isActive={true} onUpdate={onUpdateBlock} />
                    </div>

                    {/* Inline Record Binding Editor */}
                    <BlockRecordBindingEditor
                        blockId={block.id}
                        binding={block.recordBinding}
                        allBlocks={allBlocks}
                        onUpdate={(binding) => onUpdateBlock(block.id, { recordBinding: binding })}
                    />

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4 border-t border-ws-panel-border">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateBlock(block.id);
                            }}
                            className="text-ws-muted hover:text-[var(--ws-accent)]"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteBlock(block.id);
                            }}
                            className="text-ws-muted hover:text-red-500"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-slate-200" />
                        <label className="flex items-center gap-2 text-sm">
                            <span className="text-ws-text-secondary">Required</span>
                            <input
                                type="checkbox"
                                checked={block.kind === 'module' ? block.required : false}
                                onChange={(e) =>
                                    onUpdateBlock(block.id, { required: e.target.checked })
                                }
                                className="rounded border-slate-300 text-[var(--ws-accent)]"
                            />
                        </label>
                        <button
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                            className="text-ws-muted hover:text-ws-text-secondary cursor-grab active:cursor-grabbing"
                        >
                            <GripVertical className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                /* Preview View (when inactive) */
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-ws-muted hover:text-ws-text-secondary cursor-grab active:cursor-grabbing shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-ws-fg mb-2">
                            {block.kind === 'module' ? block.label : 'Record Block'}
                            {block.kind === 'module' && block.required && (
                                <span className="text-red-500 ml-1">*</span>
                            )}
                        </label>
                        <EditorBlockRenderer block={block} isActive={false} />
                    </div>
                </div>
            )}
        </div>
    );
}

export function IntakeCanvas({
    blocks,
    activeBlockId,
    onSelectBlock,
    onDeleteBlock,
    onUpdateBlock,
    onReorderBlocks,
    onDuplicateBlock,
    onAddBlock,
}: IntakeCanvasProps) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (over && active.id !== over.id) {
                const oldIndex = blocks.findIndex((b) => b.id === active.id);
                const newIndex = blocks.findIndex((b) => b.id === over.id);
                const newBlocks = arrayMove(blocks, oldIndex, newIndex);
                onReorderBlocks(newBlocks);
            }
        },
        [blocks, onReorderBlocks]
    );

    if (blocks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-ws-h2 font-semibold text-ws-text-secondary">No blocks yet</h3>
                <p className="text-sm text-ws-text-secondary mt-1 mb-6">
                    Add your first question or content block
                </p>
                <Dropdown>
                    <DropdownTrigger className="px-4 py-2 bg-[var(--ws-accent)] text-[var(--ws-accent-fg)] rounded-lg hover:opacity-90 flex items-center gap-2 transition-opacity">
                        <Plus size={16} />
                        Add First Block
                    </DropdownTrigger>
                    <DropdownContent className="w-56">
                        <DropdownLabel>Text & Input</DropdownLabel>
                        {inputBlocks.map((b) => (
                            <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                <b.icon size={14} className="mr-2" />
                                {b.label}
                            </DropdownItem>
                        ))}
                        <DropdownSeparator />
                        <DropdownLabel>Selection</DropdownLabel>
                        {choiceBlocks.map((b) => (
                            <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                <b.icon size={14} className="mr-2" />
                                {b.label}
                            </DropdownItem>
                        ))}
                        <DropdownSeparator />
                        <DropdownLabel>Layout</DropdownLabel>
                        {layoutBlocks.map((b) => (
                            <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                <b.icon size={14} className="mr-2" />
                                {b.label}
                            </DropdownItem>
                        ))}
                    </DropdownContent>
                </Dropdown>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-4">
                    {blocks.map((block) => (
                        <SortableBlock
                            key={block.id}
                            block={block}
                            isActive={block.id === activeBlockId}
                            allBlocks={blocks}
                            onSelectBlock={onSelectBlock}
                            onDeleteBlock={onDeleteBlock}
                            onUpdateBlock={onUpdateBlock}
                            onDuplicateBlock={onDuplicateBlock}
                        />
                    ))}

                    {/* Add Block Button */}
                    <div className="flex justify-center pt-4">
                        <Dropdown>
                            <DropdownTrigger className="w-10 h-10 bg-ws-panel-bg border-2 border-dashed border-slate-300 text-ws-muted hover:border-[var(--ws-accent)]/40 hover:text-[var(--ws-accent)] rounded-full flex items-center justify-center transition-all">
                                <Plus size={20} />
                            </DropdownTrigger>
                            <DropdownContent className="w-56">
                                <DropdownLabel>Text & Input</DropdownLabel>
                                {inputBlocks.map((b) => (
                                    <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                        <b.icon size={14} className="mr-2" />
                                        {b.label}
                                    </DropdownItem>
                                ))}
                                <DropdownSeparator />
                                <DropdownLabel>Selection</DropdownLabel>
                                {choiceBlocks.map((b) => (
                                    <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                        <b.icon size={14} className="mr-2" />
                                        {b.label}
                                    </DropdownItem>
                                ))}
                                <DropdownSeparator />
                                <DropdownLabel>Layout</DropdownLabel>
                                {layoutBlocks.map((b) => (
                                    <DropdownItem key={b.id} onSelect={() => onAddBlock(b.id)}>
                                        <b.icon size={14} className="mr-2" />
                                        {b.label}
                                    </DropdownItem>
                                ))}
                            </DropdownContent>
                        </Dropdown>
                    </div>
                </div>
            </SortableContext>
        </DndContext>
    );
}
