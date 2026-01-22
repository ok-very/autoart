/**
 * FloatingToolbar - Sticky toolbar for adding blocks
 */

import {
    AlignLeft,
    AtSign,
    Calendar,
    CheckSquare,
    ChevronDown,
    Clock,
    FileText,
    Hash,
    Heading,
    Image,
    List,
    Phone,
    Type,
    Upload,
} from 'lucide-react';

interface FloatingToolbarProps {
    activeBlockId: string | null;
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

export function FloatingToolbar({ activeBlockId, onAddBlock }: FloatingToolbarProps) {
    // Only show when a block is active
    if (!activeBlockId) return null;

    const renderSection = (title: string, tools: typeof inputTools) => (
        <div className="mb-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 px-1">{title}</p>
            <div className="flex flex-col gap-1">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => onAddBlock(tool.id)}
                        title={tool.label}
                        className="w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-xs"
                    >
                        <tool.icon className="w-4 h-4" />
                        <span>{tool.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="absolute right-[-180px] top-0 w-[160px] bg-white p-2 rounded-lg shadow-lg border border-slate-200 max-h-[70vh] overflow-y-auto">
            {renderSection('Input', inputTools)}
            <hr className="my-2 border-slate-100" />
            {renderSection('Choice', choiceTools)}
            <hr className="my-2 border-slate-100" />
            {renderSection('Static', staticTools)}
        </div>
    );
}
