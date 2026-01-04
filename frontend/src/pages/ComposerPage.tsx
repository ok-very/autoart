/**
 * ComposerPage
 *
 * A full-page interface for declaring Actions using the foundational model.
 *
 * Core principle: The Composer declares intent and emits events.
 * It does NOT create tasks, calculate status, or infer progress.
 *
 * Emits:
 * - ACTION_DECLARED (always)
 * - FIELD_VALUE_SET (per provided field)
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Wand2,
    ChevronDown,
    CheckSquare,
    Bug,
    ArrowLeft,
    Plus,
    Eye,
    LinkIcon,
    FileText,
    Users,
    Package,
    GitBranch,
    Layers,
    FolderTree,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useRecordDefinitions, useProjects, useProjectTree } from '../api/hooks';
import { useCompose, useQuickTask, useQuickBug } from '../api/hooks';
import { useUIStore } from '../stores/uiStore';
import { useHierarchyStore } from '../stores/hierarchyStore';
import type { HierarchyNode } from '../types';

// Action types organized by category
// This is about user cognition, not schema
const ACTION_TYPE_CATEGORIES = {
    work: {
        label: 'Work',
        description: 'Actions that represent work to be done',
        types: [
            { id: 'BUG', label: 'Bug', icon: Bug, color: 'bg-red-100 text-red-600' },
            { id: 'FEATURE', label: 'Feature', icon: Plus, color: 'bg-blue-100 text-blue-600' },
            { id: 'REVIEW', label: 'Review', icon: Eye, color: 'bg-amber-100 text-amber-600' },
            { id: 'PREPARE', label: 'Prepare', icon: CheckSquare, color: 'bg-green-100 text-green-600' },
        ],
    },
    structural: {
        label: 'Structural',
        description: 'Actions that define process structure',
        types: [
            { id: 'PROCESS', label: 'Process', icon: GitBranch, color: 'bg-indigo-100 text-indigo-600' },
            { id: 'STAGE', label: 'Stage', icon: Layers, color: 'bg-purple-100 text-purple-600' },
            { id: 'SUBPROCESS', label: 'Subprocess', icon: FolderTree, color: 'bg-violet-100 text-violet-600' },
        ],
    },
    informational: {
        label: 'Informational',
        description: 'Actions that capture information',
        types: [
            { id: 'DOCUMENT', label: 'Document', icon: FileText, color: 'bg-slate-100 text-slate-600' },
            { id: 'CONTACT', label: 'Contact', icon: Users, color: 'bg-cyan-100 text-cyan-600' },
            { id: 'MATERIAL', label: 'Material', icon: Package, color: 'bg-orange-100 text-orange-600' },
        ],
    },
};

// Flat list for easy lookup
const ALL_ACTION_TYPES = [
    ...ACTION_TYPE_CATEGORIES.work.types,
    ...ACTION_TYPE_CATEGORIES.structural.types,
    ...ACTION_TYPE_CATEGORIES.informational.types,
];

export function ComposerPage() {
    // State for action declaration
    const [selectedType, setSelectedType] = useState('PREPARE');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedReferences, setSelectedReferences] = useState<string[]>([]);

    // Context selection
    const { activeProjectId, setActiveProject } = useUIStore();
    const { getNode, getChildren } = useHierarchyStore();
    const [selectedSubprocessId, setSelectedSubprocessId] = useState<string | null>(null);

    // Data hooks
    const { data: projects } = useProjects();
    const { data: definitions } = useRecordDefinitions();
    const { data: projectNodes } = useProjectTree(activeProjectId);
    const compose = useCompose();
    const quickTask = useQuickTask();
    const quickBug = useQuickBug();

    // Collect subprocesses from the active project
    const subprocesses = useMemo(() => {
        if (!activeProjectId) return [];
        const project = getNode(activeProjectId);
        if (!project) return [];

        const subs: HierarchyNode[] = [];
        const processes = getChildren(project.id).filter((n) => n.type === 'process');
        for (const process of processes) {
            const stages = getChildren(process.id).filter((n) => n.type === 'stage');
            for (const stage of stages) {
                subs.push(...getChildren(stage.id).filter((n) => n.type === 'subprocess'));
            }
        }
        return subs;
    }, [activeProjectId, getNode, getChildren, projectNodes]);

    // Auto-select first subprocess
    useMemo(() => {
        if (subprocesses.length > 0 && !selectedSubprocessId) {
            setSelectedSubprocessId(subprocesses[0].id);
        }
    }, [subprocesses, selectedSubprocessId]);

    const selectedSubprocess = selectedSubprocessId ? getNode(selectedSubprocessId) : null;

    // Get the definition for the selected type (if applicable)
    const selectedDefinition = useMemo(() => {
        return definitions?.find((d) => d.name === selectedType || d.name === 'Task');
    }, [definitions, selectedType]);

    const isLoading = compose.isPending || quickTask.isPending || quickBug.isPending;
    const error = compose.error || quickTask.error || quickBug.error;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !selectedSubprocessId) return;

        try {
            // Use quickTask for PREPARE (work-like actions)
            if (selectedType === 'PREPARE' || selectedType === 'FEATURE' || selectedType === 'REVIEW') {
                await quickTask.mutateAsync({
                    contextId: selectedSubprocessId,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    dueDate: dueDate || undefined,
                });
            } else if (selectedType === 'BUG') {
                await quickBug.mutateAsync({
                    contextId: selectedSubprocessId,
                    title: title.trim(),
                    severity,
                    description: description.trim() || undefined,
                });
            } else {
                // Generic compose for all other action types
                await compose.mutateAsync({
                    action: {
                        contextId: selectedSubprocessId,
                        contextType: 'subprocess',
                        type: selectedType,
                        fieldBindings: [
                            { fieldKey: 'title' },
                            { fieldKey: 'description' },
                        ],
                    },
                    fieldValues: [
                        { fieldName: 'title', value: title.trim() },
                        ...(description ? [{ fieldName: 'description', value: description.trim() }] : []),
                    ],
                    references: selectedReferences.map((id) => ({ sourceRecordId: id, mode: 'dynamic' as const })),
                });
            }

            // Reset form
            setTitle('');
            setDescription('');
            setDueDate('');
            setSeverity('MEDIUM');
            setSelectedReferences([]);
        } catch (err) {
            console.error('Failed to declare action:', err);
        }
    };

    const currentType = ALL_ACTION_TYPES.find((t) => t.id === selectedType) || ALL_ACTION_TYPES[0];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Page Header */}
                    <div className="mb-6">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
                        >
                            <ArrowLeft size={14} />
                            Back to Projects
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                                <Wand2 size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Composer</h1>
                                <p className="text-sm text-slate-500">
                                    Declare intent using Actions + Events
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Main Form */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <form onSubmit={handleSubmit}>
                            {/* Context Selection */}
                            <div className="p-6 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-4">
                                    {/* Project Selection */}
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                                            Project
                                        </label>
                                        <select
                                            value={activeProjectId || ''}
                                            onChange={(e) => {
                                                setActiveProject(e.target.value);
                                                setSelectedSubprocessId(null);
                                            }}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        >
                                            <option value="">Select a project...</option>
                                            {projects?.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Subprocess Selection */}
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                                            Subprocess (Context)
                                        </label>
                                        <select
                                            value={selectedSubprocessId || ''}
                                            onChange={(e) => setSelectedSubprocessId(e.target.value)}
                                            disabled={!activeProjectId}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100"
                                        >
                                            <option value="">Select a subprocess...</option>
                                            {subprocesses.map((sp) => (
                                                <option key={sp.id} value={sp.id}>
                                                    {sp.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Action Type Selection - Categorized */}
                            <div className="p-6 border-b border-slate-100">
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">
                                    Action Type
                                </label>
                                <div className="space-y-4">
                                    {Object.entries(ACTION_TYPE_CATEGORIES).map(([categoryKey, category]) => (
                                        <div key={categoryKey}>
                                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                                {category.label}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {category.types.map((type) => {
                                                    const Icon = type.icon;
                                                    const isSelected = selectedType === type.id;
                                                    return (
                                                        <button
                                                            key={type.id}
                                                            type="button"
                                                            onClick={() => setSelectedType(type.id)}
                                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isSelected
                                                                ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className={`w-6 h-6 rounded flex items-center justify-center ${type.color}`}>
                                                                <Icon size={14} />
                                                            </span>
                                                            <span className="font-medium">{type.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Custom types from schema definitions */}
                                    {definitions && definitions.filter((d) => !d.is_system).length > 0 && (
                                        <div>
                                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                                Custom (from Schema)
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {definitions
                                                    .filter((d) => !d.is_system)
                                                    .map((def) => (
                                                        <button
                                                            key={def.id}
                                                            type="button"
                                                            onClick={() => setSelectedType(def.name)}
                                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${selectedType === def.name
                                                                ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                                                                {def.styling?.icon || def.name.charAt(0)}
                                                            </span>
                                                            <span className="font-medium">{def.name}</span>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="p-6 space-y-4">
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
                                        placeholder={`Enter ${currentType.label.toLowerCase()} title...`}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                                        rows={4}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Type-specific fields (from schema in future) */}
                                <div className="grid grid-cols-2 gap-4">
                                    {selectedType === 'PREPARE' && (
                                        <div>
                                            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700 mb-1">
                                                Due Date
                                            </label>
                                            <input
                                                id="dueDate"
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                    )}

                                    {selectedType === 'BUG' && (
                                        <div>
                                            <label htmlFor="severity" className="block text-sm font-medium text-slate-700 mb-1">
                                                Severity <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                id="severity"
                                                value={severity}
                                                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            >
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                                <option value="CRITICAL">Critical</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Advanced Options Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                    />
                                    Advanced Options
                                </button>

                                {/* Advanced Options */}
                                {showAdvanced && (
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                                        {/* References */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                <LinkIcon size={14} className="inline mr-1" />
                                                Link to Records
                                            </label>
                                            <p className="text-xs text-slate-500 mb-2">
                                                Reference existing records to inherit field values dynamically.
                                            </p>
                                            <div className="text-sm text-slate-400 italic">
                                                Record linking will be available in a future update.
                                            </div>
                                        </div>

                                        {/* Preview - Shows exactly what events will be emitted */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                <Eye size={14} className="inline mr-1" />
                                                Events to Emit
                                            </label>
                                            <p className="text-xs text-slate-500 mb-2">
                                                These are the immutable facts that will be recorded.
                                            </p>
                                            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs space-y-1">
                                                <div className="text-green-600">→ ACTION_DECLARED (action_type: {selectedType})</div>
                                                {title && (
                                                    <div className="text-blue-600">→ FIELD_VALUE_SET (field_key: "title", value: "{title}")</div>
                                                )}
                                                {description && (
                                                    <div className="text-blue-600">→ FIELD_VALUE_SET (field_key: "description", value: "...")</div>
                                                )}
                                                {selectedType === 'PREPARE' && dueDate && (
                                                    <div className="text-blue-600">→ FIELD_VALUE_SET (field_key: "dueDate", value: "{dueDate}")</div>
                                                )}
                                                {selectedType === 'BUG' && (
                                                    <div className="text-blue-600">→ FIELD_VALUE_SET (field_key: "severity", value: "{severity}")</div>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 italic">
                                                Status, progress, and other derived properties are computed downstream — not stored.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        {error.message || 'Failed to create action'}
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    Declaring <span className="font-medium">{currentType.label}</span> action in{' '}
                                    <span className="font-medium">{selectedSubprocess?.title || 'no subprocess'}</span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!title.trim() || !selectedSubprocessId || isLoading}
                                    className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            Declaring...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 size={16} />
                                            Declare Action
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Schema Info Panel */}
                    {selectedDefinition && (
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                Schema: {selectedDefinition.name}
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {selectedDefinition.schema_config?.fields?.map((field) => (
                                    <div
                                        key={field.key}
                                        className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                                    >
                                        <div className="text-xs font-medium text-slate-700">{field.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Type: {field.type}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
