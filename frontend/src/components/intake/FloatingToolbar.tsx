/**
 * FloatingToolbar - Sticky toolbar for adding blocks
 */

import {
    PlusCircle,
    FileDown,
    Type,
    Image,
    Rows3,
} from 'lucide-react';

interface FloatingToolbarProps {
    activeBlockId: string | null;
    onAddBlock: (type: string) => void;
}

const tools = [
    { id: 'short_answer', icon: PlusCircle, label: 'Add Question' },
    { id: 'import', icon: FileDown, label: 'Import Question' },
    { id: 'section_header', icon: Type, label: 'Add Title/Desc' },
    { id: 'image', icon: Image, label: 'Add Image' },
    { id: 'section', icon: Rows3, label: 'Add Section' },
];

export function FloatingToolbar({ activeBlockId, onAddBlock }: FloatingToolbarProps) {
    // Only show when a block is active
    if (!activeBlockId) return null;

    return (
        <div className="absolute right-[-60px] top-0 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg border border-slate-200">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => onAddBlock(tool.id)}
                    title={tool.label}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors relative group"
                >
                    <tool.icon className="w-5 h-5" />
                    {/* Tooltip */}
                    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {tool.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
