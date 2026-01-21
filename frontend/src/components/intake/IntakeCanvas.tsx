/**
 * IntakeCanvas - Scrollable canvas for form blocks
 *
 * Supports drag-and-drop reordering via @dnd-kit/core
 */

import { useCallback } from 'react';
import { Trash2, GripVertical, Copy } from 'lucide-react';
import type { FormBlock } from '@autoart/shared';

interface IntakeCanvasProps {
    blocks: FormBlock[];
    activeBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlock: (id: string, updates: Partial<FormBlock>) => void;
    onReorderBlocks: (blocks: FormBlock[]) => void;
    onDuplicateBlock: (id: string) => void;
}

export function IntakeCanvas({
    blocks,
    activeBlockId,
    onSelectBlock,
    onDeleteBlock,

    onUpdateBlock,
    onDuplicateBlock,
}: IntakeCanvasProps) {
    const handleBlockClick = useCallback(
        (id: string) => {
            onSelectBlock(id);
        },
        [onSelectBlock]
    );

    if (blocks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">No blocks yet</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Use the toolbar to add questions and content
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {blocks.map((block) => {
                const isActive = block.id === activeBlockId;

                return (
                    <div
                        key={block.id}
                        onClick={() => handleBlockClick(block.id)}
                        className={`bg-white rounded-xl border p-6 transition-all cursor-pointer ${isActive
                            ? 'border-indigo-300 shadow-md border-l-4 border-l-indigo-600'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
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
                                            className="w-full bg-slate-50 p-3 text-base font-medium border-b-2 border-indigo-600 focus:outline-none rounded-t"
                                        />
                                    </div>
                                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600">
                                        {block.kind === 'module' ? block.type.replace('_', ' ') : 'Record'}
                                    </div>
                                </div>

                                {/* Input Preview */}
                                <div className="mb-6">
                                    <input
                                        type="text"
                                        disabled
                                        placeholder="Answer placeholder"
                                        className="w-1/2 border-b border-slate-200 py-2 text-sm text-slate-400 bg-transparent"
                                    />
                                </div>

                                {/* Footer Actions */}
                                <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDuplicateBlock(block.id);
                                        }}
                                        className="text-slate-400 hover:text-indigo-600"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteBlock(block.id);
                                        }}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <label className="flex items-center gap-2 text-sm">
                                        <span className="text-slate-600">Required</span>
                                        <input
                                            type="checkbox"
                                            checked={block.kind === 'module' ? block.required : false}
                                            onChange={(e) =>
                                                onUpdateBlock(block.id, { required: e.target.checked })
                                            }
                                            className="rounded border-slate-300 text-indigo-600"
                                        />
                                    </label>
                                    <button className="text-slate-400 hover:text-slate-600">
                                        <GripVertical className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Preview View (when inactive) */
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-2">
                                    {block.kind === 'module' ? block.label : 'Record Block'}
                                    {block.kind === 'module' && block.required && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    disabled
                                    placeholder="Your answer"
                                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm text-slate-600 bg-slate-50"
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
