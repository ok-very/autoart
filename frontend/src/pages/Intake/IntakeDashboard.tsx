/**
 * IntakeDashboard - List of existing intake forms with create button
 */

import { Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@autoart/ui';

// Placeholder data - will be replaced with API call
const mockForms = [
    { id: '1', title: 'Artist Registration', description: 'Collect new artist info', updatedAt: '2026-01-15' },
    { id: '2', title: 'Artwork Submission', description: 'Submit new artworks for review', updatedAt: '2026-01-10' },
];

interface IntakeDashboardProps {
    onOpenForm?: (id: string) => void;
}

export function IntakeDashboard({ onOpenForm }: IntakeDashboardProps) {
    const navigate = useNavigate();

    const handleCreateForm = () => {
        // TODO: Create form via API, then navigate to editor
        if (onOpenForm) {
            onOpenForm('new');
        } else {
            navigate('/intake/new');
        }
    };

    const handleOpenForm = (id: string) => {
        if (onOpenForm) {
            onOpenForm(id);
        } else {
            navigate(`/intake/${id}`);
        }
    };

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Intake Forms</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Create and manage intake forms for collecting submissions
                    </p>
                </div>
                <Button onClick={handleCreateForm} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Form
                </Button>
            </div>

            {/* Form Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockForms.map((form) => (
                    <button
                        key={form.id}
                        onClick={() => handleOpenForm(form.id)}
                        className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-800 truncate">{form.title}</h3>
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{form.description}</p>
                                <p className="text-xs text-slate-400 mt-3">Updated {form.updatedAt}</p>
                            </div>
                        </div>
                    </button>
                ))}

                {/* Empty state create card */}
                <button
                    onClick={handleCreateForm}
                    className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-6 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[140px]"
                >
                    <Plus className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-500">New Form</span>
                </button>
            </div>
        </div>
    );
}
