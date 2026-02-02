/**
 * IntakeDashboard - List of existing intake forms with create button
 */

import { Plus, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@autoart/ui';
import { useIntakeForms, useCreateIntakeForm } from '../../api/hooks/intake';

interface IntakeDashboardProps {
    onOpenForm?: (id: string) => void;
}

export function IntakeDashboard({ onOpenForm }: IntakeDashboardProps) {
    const navigate = useNavigate();
    const { data: forms, isLoading } = useIntakeForms();
    const createForm = useCreateIntakeForm();

    const handleCreateForm = async () => {
        try {
            const result = await createForm.mutateAsync({ title: 'Untitled Form' });
            const newFormId = result.form.id;
            if (onOpenForm) {
                onOpenForm(newFormId);
            } else {
                navigate(`/intake/${newFormId}`);
            }
        } catch (err) {
            console.error('Failed to create form:', err);
        }
    };

    const handleOpenForm = (id: string) => {
        if (onOpenForm) {
            onOpenForm(id);
        } else {
            navigate(`/intake/${id}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-semibold text-slate-800">Intake Forms</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Create and manage intake forms for collecting submissions
                    </p>
                </div>
                <Button
                    onClick={handleCreateForm}
                    disabled={createForm.isPending}
                    className="hidden md:flex items-center gap-2"
                >
                    {createForm.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    Create Form
                </Button>
            </div>

            {/* Form Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms?.map((form) => (
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
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                    {form.status === 'active' ? 'Published' : 'Draft'}
                                </p>
                                <p className="text-xs text-slate-400 mt-3">
                                    Created {new Date(form.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}

                {/* Empty state create card */}
                <button
                    onClick={handleCreateForm}
                    disabled={createForm.isPending}
                    className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-6 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[140px]"
                >
                    <Plus className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-500">New Form</span>
                </button>
            </div>
        </div>
    );
}
