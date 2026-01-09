/**
 * Session Config Panel
 *
 * Left sidebar for configuring import session:
 * - VSCode-style icon sidebar for source selection
 * - Source-specific content panel
 * - Validation results when session exists
 */

import { useState, useCallback, useRef } from 'react';
import {
    Upload,
    FileSpreadsheet,
    ClipboardPaste,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Plug,
} from 'lucide-react';
import { useCreateImportSession, useGenerateImportPlan } from '../../api/hooks/imports';
import { MondayBoardSelector } from './MondayBoardSelector';
import { SourceIconSidebar, type SourceType } from './SourceIconSidebar';
import type { ImportSession, ImportPlan } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface SessionConfigPanelProps {
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
    onReset: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SessionConfigPanel({
    session,
    plan,
    onSessionCreated,
    onReset,
}: SessionConfigPanelProps) {
    const [sourceType, setSourceType] = useState<SourceType>('file');
    const [rawData, setRawData] = useState('');
    const [parserName, setParserName] = useState('monday');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const createSession = useCreateImportSession();
    const generatePlan = useGenerateImportPlan();

    // Handle file upload
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setRawData(event.target?.result as string);
        };
        reader.readAsText(file);
    }, []);

    // Handle parse - calls the actual backend API
    const handleParse = useCallback(async () => {
        if (!rawData.trim()) {
            setError('Please provide data to import');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const newSession = await createSession.mutateAsync({
                parserName,
                rawData,
            });
            const newPlan = await generatePlan.mutateAsync(newSession.id);
            onSessionCreated(newSession, newPlan);
        } catch (err) {
            setError((err as Error).message || 'Failed to parse data');
        } finally {
            setIsLoading(false);
        }
    }, [rawData, parserName, createSession, generatePlan, onSessionCreated]);

    // If session exists, show validation summary
    if (session && plan) {
        const errorCount = plan.validationIssues.filter((i) => i.severity === 'error').length;
        const warningCount = plan.validationIssues.filter((i) => i.severity === 'warning').length;

        return (
            <div className="flex h-full">
                <SourceIconSidebar activeSource={sourceType} onSourceChange={setSourceType} />
                <div className="flex-1 flex flex-col">
                    {/* Session Info */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Session</div>
                        <div className="text-sm font-medium text-slate-700">{session.parser_name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                            {new Date(session.created_at).toLocaleString()}
                        </div>
                    </div>

                    {/* Validation Summary */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-3">Validation</div>
                        <div className="space-y-2">
                            {errorCount === 0 && warningCount === 0 ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm">No issues found</span>
                                </div>
                            ) : (
                                <>
                                    {errorCount > 0 && (
                                        <div className="flex items-center gap-2 text-red-600">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="text-sm">{errorCount} errors</span>
                                        </div>
                                    )}
                                    {warningCount > 0 && (
                                        <div className="flex items-center gap-2 text-amber-600">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-sm">{warningCount} warnings</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-3">Stats</div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Containers</span>
                                <span className="font-medium text-slate-800">{plan.containers.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Items</span>
                                <span className="font-medium text-slate-800">{plan.items.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Reset Button */}
                    <div className="mt-auto p-4">
                        <button
                            onClick={onReset}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Import
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Icon sidebar + source-specific content
    return (
        <div className="flex h-full">
            {/* VSCode-style icon sidebar */}
            <SourceIconSidebar activeSource={sourceType} onSourceChange={setSourceType} />

            {/* Content panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* File Source Content */}
                {sourceType === 'file' && (
                    <>
                        {/* Parser Selection */}
                        <div className="p-4 border-b border-slate-200">
                            <label className="text-xs font-bold text-slate-400 uppercase">Parser</label>
                            <select
                                value={parserName}
                                onChange={(e) => setParserName(e.target.value)}
                                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="monday">Monday.com CSV</option>
                                <option value="airtable">Airtable CSV</option>
                                <option value="generic">Generic CSV</option>
                            </select>
                        </div>

                        {/* File Upload */}
                        <div className="p-4 border-b border-slate-200">
                            <label className="text-xs font-bold text-slate-400 uppercase">Upload File</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.json,.txt"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Choose File
                            </button>
                        </div>

                        {/* Paste Data */}
                        <div className="flex-1 p-4 flex flex-col min-h-0">
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardPaste className="w-3 h-3 text-slate-400" />
                                <label className="text-xs font-bold text-slate-400 uppercase">Paste Data</label>
                            </div>
                            <textarea
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                placeholder="Paste your CSV or JSON data here..."
                                className="flex-1 w-full p-3 text-xs font-mono border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="mx-4 mb-2 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {/* Parse Button */}
                        <div className="p-4">
                            <button
                                onClick={handleParse}
                                disabled={isLoading || !rawData.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 rounded-lg transition-colors"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Parsing...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet className="w-4 h-4" />
                                        Parse Data
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Monday.com Source Content */}
                {sourceType === 'monday' && (
                    <div className="flex-1 overflow-auto">
                        <MondayBoardSelector
                            onImport={(boardIds, options) => {
                                // TODO: Create session from Monday board import
                                console.log('Import boards:', boardIds, options);
                            }}
                        />
                    </div>
                )}

                {/* API Source Content */}
                {sourceType === 'api' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <Plug className="w-12 h-12 text-slate-300 mb-4" />
                        <div className="text-sm font-medium text-slate-600 mb-2">
                            API Connections
                        </div>
                        <p className="text-xs text-slate-400 max-w-48">
                            Connect to external APIs to sync data automatically.
                            Coming soon.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SessionConfigPanel;
