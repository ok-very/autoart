/**
 * FormSettingsPanel - Settings configuration for intake forms
 */

import { useState, useCallback, useMemo } from 'react';
import { Save, Check, AlertCircle, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@autoart/ui';
import { useProjects, useProjectTree } from '../../../api/hooks/entities/hierarchy';

interface FormSettings {
    showProgress: boolean;
    confirmationMessage?: string;
    redirectUrl?: string;
}

interface FormSettingsPanelProps {
    settings: FormSettings;
    projectId: string | null;
    classificationNodeId: string | null;
    onSave: (settings: FormSettings) => void;
    onClassificationChange: (projectId: string | null, classificationNodeId: string | null) => void;
    isSaving?: boolean;
}

export function FormSettingsPanel({
    settings,
    projectId,
    classificationNodeId,
    onSave,
    onClassificationChange,
    isSaving,
}: FormSettingsPanelProps) {
    // Track user changes separately from props
    const [changes, setChanges] = useState<Partial<FormSettings>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Derive display settings (merge props with user changes)
    const localSettings = useMemo<FormSettings>(() => ({
        ...settings,
        ...changes,
    }), [settings, changes]);

    const handleChange = useCallback(<K extends keyof FormSettings>(key: K, value: FormSettings[K]) => {
        setChanges(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    }, []);

    const handleSave = useCallback(() => {
        onSave(localSettings);
        setChanges({});
        setIsDirty(false);
    }, [localSettings, onSave]);

    // Hierarchy hooks
    const { data: projects } = useProjects();
    const { data: treeNodes } = useProjectTree(projectId);

    // Build cascading options for context node
    const contextOptions = useMemo(() => {
        if (!treeNodes) return [];
        const opts: Array<{ value: string; label: string }> = [];

        const buildOptions = (nodes: typeof treeNodes, parentId: string | null, depth: number) => {
            const children = nodes.filter(n => n.parent_id === parentId);
            for (const node of children) {
                const indent = '\u00A0\u00A0'.repeat(depth);
                const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                opts.push({
                    value: node.id,
                    label: `${indent}${typeLabel}: ${node.title}`,
                });
                buildOptions(nodes, node.id, depth + 1);
            }
        };

        // Start from the project node (root)
        const projectNode = treeNodes.find(n => n.type === 'project');
        if (projectNode) {
            buildOptions(treeNodes, projectNode.id, 0);
        }

        return opts;
    }, [treeNodes]);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
            {/* Classification Section */}
            <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden">
                <div className="px-6 py-4 border-b border-ws-panel-border">
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">Classification</h2>
                    <p className="text-sm text-ws-text-secondary mt-1">
                        Associate this form with a project. Submissions create records under the selected context.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* Project Select */}
                    <div>
                        <label className="block text-sm font-medium text-ws-text-secondary mb-2">
                            Project
                        </label>
                        <select
                            value={projectId ?? ''}
                            onChange={(e) => {
                                const newProjectId = e.target.value || null;
                                onClassificationChange(newProjectId, null);
                            }}
                            className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-fg bg-ws-panel-bg focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)] focus:border-transparent"
                        >
                            <option value="">None</option>
                            {projects?.map((p) => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Context Node Select (cascading) */}
                    {projectId && (
                        <div>
                            <label className="block text-sm font-medium text-ws-text-secondary mb-2">
                                Context
                            </label>
                            <select
                                value={classificationNodeId ?? ''}
                                onChange={(e) => {
                                    onClassificationChange(projectId, e.target.value || null);
                                }}
                                className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-fg bg-ws-panel-bg focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)] focus:border-transparent"
                            >
                                <option value="">Select context node...</option>
                                {contextOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-ws-text-secondary mt-2">
                                Submissions land under this node in the hierarchy.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Settings Section */}
            <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-ws-panel-border flex items-center justify-between">
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">Form Settings</h2>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className="flex items-center gap-2"
                    >
                        {isSaving ? (
                            <span className="animate-spin">&#x23F3;</span>
                        ) : isDirty ? (
                            <Save className="w-4 h-4" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {isDirty ? 'Save Changes' : 'Saved'}
                    </Button>
                </div>

                {/* Settings Form */}
                <div className="p-6 space-y-6">
                    {/* Progress Bar Toggle */}
                    <div className="flex items-start justify-between">
                        <div>
                            <label className="text-sm font-medium text-ws-text-secondary">Show Progress Bar</label>
                            <p className="text-sm text-ws-text-secondary mt-1">
                                Display a progress indicator for multi-page forms
                            </p>
                        </div>
                        <button
                            onClick={() => handleChange('showProgress', !localSettings.showProgress)}
                            className="text-[var(--ws-accent)]"
                        >
                            {localSettings.showProgress ? (
                                <ToggleRight className="w-8 h-8" />
                            ) : (
                                <ToggleLeft className="w-8 h-8 text-ws-muted" />
                            )}
                        </button>
                    </div>

                    <hr className="border-ws-panel-border" />

                    {/* Confirmation Message */}
                    <div>
                        <label className="block text-sm font-medium text-ws-text-secondary mb-2">
                            Confirmation Message
                        </label>
                        <p className="text-sm text-ws-text-secondary mb-3">
                            Message shown to respondents after they submit the form
                        </p>
                        <textarea
                            value={localSettings.confirmationMessage || ''}
                            onChange={(e) => handleChange('confirmationMessage', e.target.value || undefined)}
                            placeholder="Thank you! Your response has been recorded."
                            rows={3}
                            className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-text-secondary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)] focus:border-transparent resize-none"
                        />
                    </div>

                    <hr className="border-ws-panel-border" />

                    {/* Redirect URL */}
                    <div>
                        <label className="block text-sm font-medium text-ws-text-secondary mb-2">
                            <ExternalLink className="w-4 h-4 inline mr-1" />
                            Redirect URL
                        </label>
                        <p className="text-sm text-ws-text-secondary mb-3">
                            After submission, redirect respondents to this URL
                        </p>
                        <input
                            type="url"
                            value={localSettings.redirectUrl || ''}
                            onChange={(e) => handleChange('redirectUrl', e.target.value || undefined)}
                            placeholder="https://example.com/thank-you"
                            className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-text-secondary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)] focus:border-transparent"
                        />
                        {localSettings.redirectUrl && !isValidUrl(localSettings.redirectUrl) && (
                            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Enter a valid URL starting with https://
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function isValidUrl(str: string): boolean {
    try {
        const url = new URL(str);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}
