/**
 * FormSettingsPanel - Settings configuration for intake forms
 */

import { useState, useCallback, useMemo } from 'react';
import { Save, Check, AlertCircle, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@autoart/ui';

interface FormSettings {
    showProgress: boolean;
    confirmationMessage?: string;
    redirectUrl?: string;
}

interface FormSettingsPanelProps {
    settings: FormSettings;
    onSave: (settings: FormSettings) => void;
    isSaving?: boolean;
}

export function FormSettingsPanel({ settings, onSave, isSaving }: FormSettingsPanelProps) {
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

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
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
                            <span className="animate-spin">⏳</span>
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
                            className="text-indigo-600"
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
                            className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-text-secondary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
                            className="w-full px-3 py-2 border border-ws-panel-border rounded-lg text-sm text-ws-text-secondary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
