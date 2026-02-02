/**
 * BlockOptionsEditor - Editor for multiple choice, checkbox, dropdown options
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import type { ModuleBlock } from '@autoart/shared';

interface BlockOptionsEditorProps {
    block: ModuleBlock;
    onUpdate: (updates: Partial<ModuleBlock>) => void;
}

const CHOICE_TYPES = ['multiple_choice', 'checkbox', 'dropdown'];

export function BlockOptionsEditor({ block, onUpdate }: BlockOptionsEditorProps) {
    const [newOption, setNewOption] = useState('');

    const isChoiceBlock = CHOICE_TYPES.includes(block.type);

    const options = useMemo(
        () => block.options || [],
        [block.options]
    );

    const handleAddOption = useCallback(() => {
        if (newOption.trim()) {
            onUpdate({ options: [...options, newOption.trim()] });
            setNewOption('');
        }
    }, [newOption, options, onUpdate]);

    const handleRemoveOption = useCallback((index: number) => {
        const updated = options.filter((_, i) => i !== index);
        onUpdate({ options: updated });
    }, [options, onUpdate]);

    const handleUpdateOption = useCallback((index: number, value: string) => {
        const updated = [...options];
        updated[index] = value;
        onUpdate({ options: updated });
    }, [options, onUpdate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddOption();
        }
    }, [handleAddOption]);

    // Only show for choice-type blocks
    if (!isChoiceBlock) {
        return null;
    }

    return (
        <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-ws-text-secondary uppercase tracking-wide">Options</p>

            {/* Existing Options */}
            <div className="space-y-2">
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                        <GripVertical className="w-4 h-4 text-ws-muted" />
                        <div className="flex items-center gap-2 flex-1">
                            {block.type === 'multiple_choice' && (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                            )}
                            {block.type === 'checkbox' && (
                                <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                            )}
                            {block.type === 'dropdown' && (
                                <span className="text-ws-muted text-sm shrink-0">{index + 1}.</span>
                            )}
                            <input
                                type="text"
                                value={option}
                                onChange={(e) => handleUpdateOption(index, e.target.value)}
                                className="flex-1 bg-transparent text-sm text-ws-text-secondary border-b border-transparent hover:border-ws-panel-border focus:border-indigo-500 focus:outline-none py-1"
                            />
                        </div>
                        <button
                            onClick={() => handleRemoveOption(index)}
                            className="opacity-0 group-hover:opacity-100 text-ws-muted hover:text-red-500 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Add New Option */}
            <div className="flex items-center gap-2 pt-2">
                {block.type === 'multiple_choice' && (
                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 shrink-0" />
                )}
                {block.type === 'checkbox' && (
                    <div className="w-4 h-4 rounded border-2 border-dashed border-slate-300 shrink-0" />
                )}
                {block.type === 'dropdown' && (
                    <Plus className="w-4 h-4 text-ws-muted shrink-0" />
                )}
                <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add option"
                    className="flex-1 bg-transparent text-sm text-ws-text-secondary placeholder-slate-400 border-b border-ws-panel-border focus:border-indigo-500 focus:outline-none py-1"
                />
                <button
                    onClick={handleAddOption}
                    disabled={!newOption.trim()}
                    className="text-indigo-600 hover:text-indigo-700 disabled:text-ws-muted disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {options.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                    Add at least one option for respondents to choose from.
                </p>
            )}
        </div>
    );
}
