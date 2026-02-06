import { useState, useCallback } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import type { ModuleBlock } from '@autoart/shared';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function DropdownPreview({ block, isActive, onUpdate }: EditorBlockProps) {
    const [newOption, setNewOption] = useState('');
    const options = (block.kind === 'module' ? block.options : undefined) ?? [];

    const updateOptions = useCallback(
        (opts: string[]) => onUpdate?.(block.id, { options: opts } as Partial<ModuleBlock>),
        [block.id, onUpdate]
    );

    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <ChevronDown className="w-4 h-4 opacity-40" />
                <span className="text-sm">
                    {options.length} option{options.length !== 1 ? 's' : ''}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 w-1/2 border border-ws-panel-border rounded-md px-3 py-2">
                <span className="flex-1 text-sm text-ws-muted">Select an option</span>
                <ChevronDown className="w-4 h-4 text-ws-muted" />
            </div>
            <div className="space-y-2">
                <p className="text-xs font-medium text-ws-text-secondary uppercase tracking-wide">Options</p>
                {options.map((option, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                        <span className="text-ws-muted text-sm shrink-0 w-5 text-right">{i + 1}.</span>
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                                const next = [...options];
                                next[i] = e.target.value;
                                updateOptions(next);
                            }}
                            className="flex-1 bg-transparent text-sm text-ws-text-secondary border-b border-transparent hover:border-ws-panel-border focus:border-[var(--ws-accent)] focus:outline-none py-1"
                        />
                        <button
                            onClick={() => updateOptions(options.filter((_, idx) => idx !== i))}
                            className="opacity-0 group-hover:opacity-100 text-ws-muted hover:text-red-500 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                    <Plus className="w-4 h-4 text-ws-muted shrink-0" />
                    <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newOption.trim()) {
                                e.preventDefault();
                                updateOptions([...options, newOption.trim()]);
                                setNewOption('');
                            }
                        }}
                        placeholder="Add option"
                        className="flex-1 bg-transparent text-sm text-ws-text-secondary placeholder-slate-400 border-b border-ws-panel-border focus:border-[var(--ws-accent)] focus:outline-none py-1"
                    />
                    <button
                        onClick={() => {
                            if (newOption.trim()) {
                                updateOptions([...options, newOption.trim()]);
                                setNewOption('');
                            }
                        }}
                        disabled={!newOption.trim()}
                        className="text-[var(--ws-accent)] disabled:text-ws-muted disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                {options.length === 0 && (
                    <p className="text-xs text-[var(--ws-color-warning)] mt-1">
                        Add at least one option for respondents to choose from.
                    </p>
                )}
            </div>
        </div>
    );
}
