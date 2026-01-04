/**
 * ActionComposer Component
 *
 * A UI component for creating work items via the Composer API.
 * Uses the Action + Event model instead of legacy task creation.
 *
 * Features:
 * - Task and Bug creation
 * - Field value input
 * - Automatic context inference
 */

import { useState } from 'react';
import { useQuickTask, useQuickBug } from '../../api/hooks';
import { X, Plus, AlertCircle, Bug, CheckSquare } from 'lucide-react';

interface ActionComposerProps {
    /** The subprocess ID (context) to create the action in */
    contextId: string;
    /** Callback when action is created successfully */
    onSuccess?: (actionId: string) => void;
    /** Callback to close the composer */
    onClose?: () => void;
    /** Default action type */
    defaultType?: 'TASK' | 'BUG';
}

type ActionType = 'TASK' | 'BUG';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function ActionComposer({
    contextId,
    onSuccess,
    onClose,
    defaultType = 'TASK',
}: ActionComposerProps) {
    const [actionType, setActionType] = useState<ActionType>(defaultType);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [severity, setSeverity] = useState<Severity>('MEDIUM');

    const createTask = useQuickTask();
    const createBug = useQuickBug();

    const isLoading = createTask.isPending || createBug.isPending;
    const error = createTask.error || createBug.error;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            let result;

            if (actionType === 'TASK') {
                result = await createTask.mutateAsync({
                    contextId,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    dueDate: dueDate || undefined,
                });
            } else {
                result = await createBug.mutateAsync({
                    contextId,
                    title: title.trim(),
                    severity,
                    description: description.trim() || undefined,
                });
            }

            // Reset form
            setTitle('');
            setDescription('');
            setDueDate('');
            setSeverity('MEDIUM');

            // Notify success
            onSuccess?.(result.action.id);
            onClose?.();
        } catch (err) {
            console.error('Failed to create action:', err);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                    Create {actionType === 'TASK' ? 'Task' : 'Bug'}
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Type Switcher */}
            <div className="flex gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setActionType('TASK')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${actionType === 'TASK'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                        }`}
                >
                    <CheckSquare size={16} />
                    Task
                </button>
                <button
                    type="button"
                    onClick={() => setActionType('BUG')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${actionType === 'BUG'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                        }`}
                >
                    <Bug size={16} />
                    Bug
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={`Enter ${actionType.toLowerCase()} title...`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                    />
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                        Description
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description..."
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                </div>

                {/* Task-specific fields */}
                {actionType === 'TASK' && (
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700 mb-1">
                            Due Date
                        </label>
                        <input
                            id="dueDate"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                )}

                {/* Bug-specific fields */}
                {actionType === 'BUG' && (
                    <div>
                        <label htmlFor="severity" className="block text-sm font-medium text-slate-700 mb-1">
                            Severity <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="severity"
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as Severity)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                        </select>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                        <AlertCircle size={16} />
                        <span>{error.message || 'Failed to create action'}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!title.trim() || isLoading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Create {actionType === 'TASK' ? 'Task' : 'Bug'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

/**
 * Inline Action Composer - compact version for use in sidebars/cards
 */
export function InlineActionComposer({
    contextId,
    onSuccess,
    placeholder = 'Add a task...',
}: {
    contextId: string;
    onSuccess?: (actionId: string) => void;
    placeholder?: string;
}) {
    const [title, setTitle] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const createTask = useQuickTask();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            const result = await createTask.mutateAsync({
                contextId,
                title: title.trim(),
            });
            setTitle('');
            setIsExpanded(false);
            onSuccess?.(result.action.id);
        } catch (err) {
            console.error('Failed to create task:', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setTitle('');
            setIsExpanded(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value);
                        if (e.target.value && !isExpanded) setIsExpanded(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsExpanded(true)}
                    onBlur={() => {
                        if (!title.trim()) setIsExpanded(false);
                    }}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-colors"
                />
                {isExpanded && title.trim() && (
                    <button
                        type="submit"
                        disabled={createTask.isPending}
                        className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {createTask.isPending ? '...' : 'Add'}
                    </button>
                )}
            </div>
            {createTask.isError && (
                <p className="mt-1 text-xs text-red-600">
                    Failed to create task
                </p>
            )}
        </form>
    );
}
