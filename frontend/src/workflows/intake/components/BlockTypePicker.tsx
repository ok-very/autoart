/**
 * BlockTypePicker - Sidebar panel for adding blocks to the form
 * 
 * Always visible in the editor, provides all block types organized by category.
 */

import { useState } from 'react';
import {
    AlignLeft,
    AtSign,
    Calendar,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    Hash,
    Heading,
    Image,
    List,
    Phone,
    Plus,
    Type,
    Upload,
} from 'lucide-react';

interface BlockTypePickerProps {
    onAddBlock: (type: string) => void;
}

const inputTools = [
    { id: 'short_answer', icon: Type, label: 'Short Answer' },
    { id: 'paragraph', icon: AlignLeft, label: 'Paragraph' },
    { id: 'email', icon: AtSign, label: 'Email' },
    { id: 'phone', icon: Phone, label: 'Phone' },
    { id: 'number', icon: Hash, label: 'Number' },
    { id: 'date', icon: Calendar, label: 'Date' },
    { id: 'time', icon: Clock, label: 'Time' },
    { id: 'file_upload', icon: Upload, label: 'File Upload' },
];

const choiceTools = [
    { id: 'multiple_choice', icon: List, label: 'Multiple Choice' },
    { id: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
    { id: 'dropdown', icon: ChevronDown, label: 'Dropdown' },
];

const staticTools = [
    { id: 'section_header', icon: Heading, label: 'Section Header' },
    { id: 'description', icon: FileText, label: 'Description' },
    { id: 'image', icon: Image, label: 'Image' },
];

const categories = [
    { id: 'input', label: 'Text & Input', tools: inputTools },
    { id: 'choice', label: 'Selection', tools: choiceTools },
    { id: 'static', label: 'Layout', tools: staticTools },
];

export function BlockTypePicker({ onAddBlock }: BlockTypePickerProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>('input');

    const toggleCategory = (id: string) => {
        setExpandedCategory(prev => prev === id ? null : id);
    };

    return (
        <div className="w-64 bg-ws-panel-bg border-l border-ws-panel-border h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-ws-panel-border">
                <h3 className="text-sm font-semibold text-ws-fg flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    Add Block
                </h3>
                <p className="text-xs text-ws-text-secondary mt-1">
                    Click to add to your form
                </p>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto py-2">
                {categories.map((category) => {
                    const isExpanded = expandedCategory === category.id;

                    return (
                        <div key={category.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-ws-text-secondary hover:bg-ws-bg"
                            >
                                <span>{category.label}</span>
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-ws-muted" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-ws-muted" />
                                )}
                            </button>

                            {isExpanded && (
                                <div className="px-2 pb-2">
                                    {category.tools.map((tool) => (
                                        <button
                                            key={tool.id}
                                            onClick={() => onAddBlock(tool.id)}
                                            className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-ws-text-secondary hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                                                <tool.icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm">{tool.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Add Footer */}
            <div className="px-4 py-3 border-t border-ws-panel-border bg-ws-bg">
                <p className="text-xs text-ws-text-secondary">
                    Tip: Drag blocks to reorder them
                </p>
            </div>
        </div>
    );
}
