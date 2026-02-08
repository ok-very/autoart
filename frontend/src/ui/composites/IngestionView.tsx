/**
 * IngestionView - Full-page data ingestion interface
 *
 * Displays as a full view when user selects "Ingest" mode on the Records page.
 * Provides file upload, parser selection, live preview, and import functionality.
 *
 * @layer composites
 */
import { Upload, FileText, Play, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useIngestionParsers, useIngestionPreview, useRunIngestion } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface IngestionViewProps {
    /**
     * Optional callback when import completes successfully
     */
    onImportComplete?: (projectId: string) => void;
}

export function IngestionView({ onImportComplete }: IngestionViewProps) {
    const { selectProject } = useHierarchyStore();
    const setRecordsViewMode = useWorkspaceStore((s) => s.setRecordsViewMode);

    // Data state
    const [rawData, setRawData] = useState('');
    const [selectedParser, setSelectedParser] = useState<string>('monday');

    // API hooks
    const { data: parsers, isLoading: parsersLoading } = useIngestionParsers();
    const preview = useIngestionPreview();
    const runImport = useRunIngestion();

    // Debounce timer
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get current parser and derive default config
    const currentParser = parsers?.find(p => p.name === selectedParser);
    const parserConfig = useMemo(() => {
        if (!currentParser) return {};
        const defaults: Record<string, unknown> = {};
        currentParser.configFields.forEach(field => {
            defaults[field.key] = field.defaultValue;
        });
        return defaults;
    }, [currentParser]);

    // Auto-preview on data or config change
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (rawData.trim() && selectedParser) {
            debounceRef.current = setTimeout(() => {
                preview.mutate({
                    parserName: selectedParser,
                    rawData,
                    config: parserConfig,
                });
            }, 500);
        }

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [rawData, selectedParser, parserConfig, preview]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setRawData(event.target?.result as string || '');
            };
            reader.readAsText(file);
        }
    }, []);

    const handleConfigChange = useCallback((_key: string, _value: string) => {
        // Config is now derived from defaults - no user override yet
        // TODO: Add user config override if needed
    }, []);

    const handleImport = useCallback(async () => {
        if (!rawData.trim()) return;

        try {
            const result = await runImport.mutateAsync({
                parserName: selectedParser,
                rawData,
                config: parserConfig,
            });

            // Select the new project and switch back to list view
            selectProject(result.projectId);
            setRecordsViewMode('list');
            onImportComplete?.(result.projectId);
        } catch (err) {
            console.error('Import failed:', err);
        }
    }, [rawData, selectedParser, parserConfig, runImport, selectProject, setRecordsViewMode, onImportComplete]);

    const handleCancel = useCallback(() => {
        setRecordsViewMode('list');
    }, [setRecordsViewMode]);

    if (parsersLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex h-full bg-ws-panel-bg">
            {/* Left Panel: Configuration */}
            <div className="w-96 border-r border-ws-panel-border flex flex-col bg-ws-panel-bg shrink-0">
                <div className="h-10 border-b border-ws-panel-border flex items-center px-3 bg-ws-bg">
                    <h2 className="text-xs font-semibold text-ws-text-secondary uppercase tracking-wide">
                        Input & Logic
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll">
                    {/* Section 1: Data Source */}
                    <div className="p-5 border-b border-ws-panel-border">
                        <label className="text-xs font-semibold text-ws-fg uppercase mb-3 flex justify-between">
                            <span>1. Data Source</span>
                            <span className="text-[10px] font-normal text-ws-muted lowercase">csv, xlsx, json</span>
                        </label>

                        {/* File Upload */}
                        <div
                            className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-ws-bg transition-colors cursor-pointer mb-4 group"
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                accept=".csv,.txt,.json"
                                onChange={handleFileUpload}
                            />
                            <Upload className="w-6 h-6 text-ws-muted mx-auto mb-2 group-hover:text-blue-500 transition-colors" />
                            <div className="text-xs font-medium text-ws-text-secondary group-hover:text-blue-600">
                                Click to Upload File
                            </div>
                            <div className="text-[10px] text-ws-muted">or drag and drop here</div>
                        </div>

                        {/* Paste Area */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="h-px bg-slate-200 flex-1" />
                            <span className="text-[10px] text-ws-muted font-semibold uppercase">OR PASTE RAW DATA</span>
                            <span className="h-px bg-slate-200 flex-1" />
                        </div>

                        <textarea
                            value={rawData}
                            onChange={(e) => setRawData(e.target.value)}
                            className="w-full h-24 p-2 text-[10px] font-mono border border-slate-300 rounded bg-ws-bg focus:outline-none focus:border-blue-500 resize-none transition-all focus:bg-ws-panel-bg"
                            placeholder="Paste content here..."
                        />
                    </div>

                    {/* Section 2: Parser Modules */}
                    <div className="p-5 bg-ws-bg/50 flex-1">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-semibold text-ws-fg uppercase">
                                2. Parser Module
                            </label>
                            <span className="text-[10px] text-ws-muted">Logic for interpretation</span>
                        </div>

                        <div className="space-y-3">
                            {parsers?.map((parser) => (
                                <div
                                    key={parser.name}
                                    onClick={() => setSelectedParser(parser.name)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedParser === parser.name
                                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                                            : 'bg-ws-panel-bg border-ws-panel-border opacity-70 hover:opacity-100 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-semibold ${parser.name === 'monday'
                                                    ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                                    : 'bg-yellow-100 text-yellow-600 border border-yellow-200'
                                                }`}>
                                                {parser.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-semibold ${selectedParser === parser.name ? 'text-blue-900' : 'text-ws-text-secondary'}`}>
                                                    {parser.name === 'monday' ? 'Monday.com v2' : 'Airtable Grid'}
                                                </div>
                                                <div className={`text-[10px] ${selectedParser === parser.name ? 'text-blue-600' : 'text-ws-muted'}`}>
                                                    {parser.description}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedParser === parser.name && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-100" />
                                        )}
                                    </div>

                                    {/* Config Fields (only for selected parser) */}
                                    {selectedParser === parser.name && parser.configFields.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-3">
                                            {parser.configFields.map((field) => (
                                                <div key={field.key}>
                                                    <label className="text-[10px] text-blue-500 font-semibold block mb-1">
                                                        {field.label}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={String(parserConfig[field.key] || field.defaultValue)}
                                                        onChange={(e) => handleConfigChange(field.key, e.target.value)}
                                                        className="w-full text-[10px] font-mono border border-blue-200 rounded px-2 py-1.5 text-ws-text-secondary focus:border-blue-500 focus:outline-none bg-ws-panel-bg"
                                                    />
                                                    {field.description && (
                                                        <div className="text-[10px] text-ws-muted mt-1">{field.description}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="flex-1 flex flex-col bg-ws-bg">
                {/* Preview Header */}
                <div className="h-10 bg-ws-panel-bg border-b border-ws-panel-border flex items-center justify-between px-4 shrink-0 shadow-sm">
                    <span className="text-xs font-semibold text-ws-text-secondary uppercase">Live Output Preview</span>
                    <div className="flex gap-3">
                        {preview.data && (
                            <>
                                <span className="text-[10px] text-ws-text-secondary">
                                    <span className="font-semibold text-ws-fg">{preview.data.stageCount}</span> Stages
                                </span>
                                <span className="text-[10px] text-ws-text-secondary">
                                    <span className="font-semibold text-ws-fg">{preview.data.taskCount}</span> Tasks
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scroll">
                    {preview.isPending && (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                        </div>
                    )}

                    {preview.isError && (
                        <div className="flex items-center justify-center h-full text-red-500">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">Failed to parse data</span>
                        </div>
                    )}

                    {preview.data && !preview.isPending && (
                        <div className="space-y-4">
                            {/* Project Card */}
                            <div className="bg-ws-panel-bg border border-purple-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                                <div className="flex items-start gap-3">
                                    <span className="text-[10px] font-semibold text-purple-600 uppercase bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                        Project Record
                                    </span>
                                </div>
                                <h2 className="text-ws-h2 font-semibold text-ws-fg mt-2">
                                    {preview.data.parsedData.projectTitle}
                                </h2>
                                {Object.keys(preview.data.parsedData.projectMeta).length > 0 && (
                                    <div className="flex gap-6 mt-2 text-sm">
                                        {Object.entries(preview.data.parsedData.projectMeta).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-[10px] font-semibold text-ws-muted uppercase">{key}</span>
                                                <div className="font-medium text-ws-text-secondary">{String(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Nodes Tree */}
                            {preview.data.parsedData.nodes.map((node) => (
                                <div
                                    key={node.tempId}
                                    className={`p-3 rounded border-l-4 ${node.type === 'process' ? 'border-purple-400 bg-purple-50' :
                                            node.type === 'stage' ? 'border-yellow-400 bg-yellow-50' :
                                                node.type === 'subprocess' ? 'border-orange-400 bg-orange-50' :
                                                    'border-blue-400 bg-ws-panel-bg'
                                        }`}
                                    style={{ marginLeft: getNodeIndent(node.type) }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${node.type === 'process' ? 'bg-purple-100 text-purple-600' :
                                                node.type === 'stage' ? 'bg-yellow-100 text-yellow-600' :
                                                    node.type === 'subprocess' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-blue-100 text-blue-600'
                                            }`}>
                                            {node.type}
                                        </span>
                                        <span className="text-sm font-medium text-ws-fg">{node.title}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!rawData && !preview.data && (
                        <div className="flex flex-col items-center justify-center h-full text-ws-muted">
                            <FileText className="w-12 h-12 mb-3" />
                            <p className="text-sm font-medium">No data to preview</p>
                            <p className="text-xs">Upload a file or paste data to see the preview</p>
                        </div>
                    )}
                </div>

                {/* Action Bar */}
                <div className="p-4 border-t border-ws-panel-border bg-ws-panel-bg flex justify-between items-center">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-ws-text-secondary bg-ws-panel-bg border border-slate-300 rounded-md hover:bg-ws-bg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!rawData.trim() || runImport.isPending || !preview.data}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {runImport.isPending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Importing...
                            </>
                        ) : runImport.isSuccess ? (
                            <>
                                <Check size={16} />
                                Success!
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                Run Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function getNodeIndent(type: string): number {
    switch (type) {
        case 'process': return 0;
        case 'stage': return 16;
        case 'subprocess': return 32;
        default: return 0;
    }
}
