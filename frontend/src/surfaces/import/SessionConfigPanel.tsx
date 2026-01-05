/**
 * Session Config Panel
 *
 * Left sidebar for configuring import session:
 * - File upload / paste data
 * - Parser selection
 * - Validation results
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
} from 'lucide-react';
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
    const [rawData, setRawData] = useState('');
    const [parserName, setParserName] = useState('monday-csv');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Handle parse
    const handleParse = useCallback(async () => {
        if (!rawData.trim()) {
            setError('Please provide data to import');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // TODO: Replace with actual API call when backend is ready
            // For now, create a mock session/plan for UI testing
            const mockSession: ImportSession = {
                id: `session-${Date.now()}`,
                parser_name: parserName,
                status: 'planned',
                created_at: new Date().toISOString(),
            };

            const mockPlan: ImportPlan = {
                sessionId: mockSession.id,
                containers: [
                    {
                        tempId: 'temp-process-1',
                        type: 'process',
                        title: 'Imported Process',
                        parentTempId: null,
                    },
                    {
                        tempId: 'temp-subprocess-1',
                        type: 'subprocess',
                        title: 'Imported Subprocess',
                        parentTempId: 'temp-process-1',
                    },
                ],
                items: rawData
                    .split('\n')
                    .filter((line) => line.trim())
                    .slice(0, 10)
                    .map((line, idx) => ({
                        tempId: `temp-task-${idx}`,
                        title: line.slice(0, 50),
                        parentTempId: 'temp-subprocess-1',
                        metadata: {
                            'import.stage_name': idx < 3 ? 'To Do' : idx < 7 ? 'In Progress' : 'Done',
                            'import.stage_order': idx < 3 ? 1 : idx < 7 ? 2 : 3,
                        },
                        plannedAction: {
                            type: 'CREATE_TASK',
                            payload: { title: line.slice(0, 50) },
                        },
                        fieldRecordings: [],
                    })),
                validationIssues: [],
            };

            onSessionCreated(mockSession, mockPlan);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [rawData, parserName, onSessionCreated]);

    // If session exists, show validation summary
    if (session && plan) {
        const errorCount = plan.validationIssues.filter((i) => i.severity === 'error').length;
        const warningCount = plan.validationIssues.filter((i) => i.severity === 'warning').length;

        return (
            <div className="flex flex-col h-full">
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
        );
    }

    // Upload/Paste UI
    return (
        <div className="flex flex-col h-full">
            {/* Parser Selection */}
            <div className="p-4 border-b border-slate-200">
                <label className="text-xs font-bold text-slate-400 uppercase">Parser</label>
                <select
                    value={parserName}
                    onChange={(e) => setParserName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="monday-csv">Monday.com CSV</option>
                    <option value="generic-csv">Generic CSV</option>
                    <option value="json">JSON</option>
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
            <div className="flex-1 p-4 flex flex-col">
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
        </div>
    );
}

export default SessionConfigPanel;
