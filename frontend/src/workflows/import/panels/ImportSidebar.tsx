/**
 * ImportSidebar
 *
 * Left sidebar for Import Workbench session configuration.
 * Provides source selection (file upload, Monday, API) and parsing controls.
 * Receives state from ImportPage via props.
 */

import { clsx } from 'clsx';
import {
    File,
    Calendar,
    Plug,
    Plus,
    Upload,
    ClipboardPaste,
    AlertCircle,
    Loader2,
    Check,
    RefreshCw,
    Globe,
} from 'lucide-react';
import { useRef, useCallback, useState } from 'react';

import { useConnections } from '../../../api/connections';
import {
    useGenerateImportPlan,
    useCreateImportSession,
    type ImportSession,
    type ImportPlan,
} from '../../../api/hooks/imports';
import { useUIStore } from '../../../stores/uiStore';
import { CollectorPanel } from './CollectorPanel';

// ============================================================================
// TYPES
// ============================================================================

type SourceType = 'file' | 'monday' | 'collector' | 'api';

interface ImportSidebarProps {
    width: number;
    /** Current source type (controlled by parent for view switching) */
    sourceType: SourceType;
    /** Callback when source type changes */
    onSourceChange: (sourceType: SourceType) => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
    onReset: () => void;
}

// ============================================================================
// SOURCE ICON
// ============================================================================

interface SourceIconProps {
    id: SourceType;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    isConnected: boolean;
    isDisabled: boolean;
    onClick: () => void;
}

function SourceIcon({ id: _id, icon, label, isActive, isConnected, isDisabled, onClick }: SourceIconProps) {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            title={label}
            className={clsx(
                'relative w-10 h-10 flex items-center justify-center rounded-lg transition-all',
                isActive && 'bg-emerald-100 text-emerald-600 shadow-sm',
                !isActive && !isDisabled && 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                isDisabled && 'text-slate-300 cursor-not-allowed'
            )}
        >
            {icon}
            {isConnected && !isActive && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
            {isConnected && isActive && (
                <Check size={10} className="absolute top-1 right-1 text-emerald-600" />
            )}
        </button>
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportSidebar({ width, sourceType, onSourceChange, session, onSessionCreated, onReset }: ImportSidebarProps) {
    // State (sourceType is now controlled by parent)
    const [rawData, setRawData] = useState('');
    const [parserName, setParserName] = useState('monday');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Hooks
    const { openOverlay } = useUIStore();

    // Connections
    const { data: connections } = useConnections();
    const isMondayConnected = connections?.monday?.connected ?? false;

    // Mutations
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

    // Handle parse for file/paste input
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



    // Handle reset
    const handleReset = useCallback(() => {
        onReset();
        setRawData('');
        setError(null);
    }, [onReset]);

    // If session exists and NOT Monday source, show session info only
    // For Monday source, we persist the board list below the session header
    if (session && sourceType !== 'monday') {
        return (
            <aside style={{ width }} className="shrink-0 border-r border-slate-200 bg-white flex flex-col">
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Session Header */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Active Session
                        </div>
                        <div className="text-sm font-medium text-slate-800">{session.parser_name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                            {new Date(session.created_at).toLocaleString()}
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Reset Button */}
                    <div className="p-4 border-t border-slate-200">
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Import
                        </button>
                    </div>
                </div>
            </aside>
        );
    }

    // Configuration mode
    return (
        <aside style={{ width }} className="shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            {/* Source Icon Bar */}
            <div className="w-full border-b border-slate-100 bg-slate-50 py-2 px-2 flex items-center justify-center gap-1">
                <SourceIcon
                    id="file"
                    icon={<File size={18} />}
                    label="File Upload"
                    isActive={sourceType === 'file'}
                    isConnected={false}
                    isDisabled={false}
                    onClick={() => onSourceChange('file')}
                />
                <SourceIcon
                    id="monday"
                    icon={<Calendar size={18} />}
                    label="Monday.com"
                    isActive={sourceType === 'monday'}
                    isConnected={isMondayConnected}

                    isDisabled={false}
                    onClick={() => onSourceChange('monday')}
                />
                <SourceIcon
                    id="collector"
                    icon={<Globe size={18} />}
                    label="Collector"
                    isActive={sourceType === 'collector'}
                    isConnected={false}
                    isDisabled={false}
                    onClick={() => onSourceChange('collector')}
                />
                <SourceIcon
                    id="api"
                    icon={<Plug size={18} />}
                    label="API"
                    isActive={sourceType === 'api'}
                    isConnected={false}
                    isDisabled={true}
                    onClick={() => { }}
                />
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <button
                    onClick={() => openOverlay('integrations', {})}
                    title="Add Integration"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Source-specific content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* File Source */}
                {sourceType === 'file' && (
                    <>
                        {/* Parser Selection */}
                        <div className="p-4 border-b border-slate-100">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Parser
                            </label>
                            <select
                                value={parserName}
                                onChange={(e) => setParserName(e.target.value)}
                                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="monday">Monday.com CSV</option>
                                <option value="airtable">Airtable CSV</option>
                                <option value="generic">Generic CSV</option>
                            </select>
                        </div>

                        {/* File Upload */}
                        <div className="p-4 border-b border-slate-100">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Upload File
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.json,.txt"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Choose File
                            </button>
                        </div>

                        {/* Paste Data */}
                        <div className="flex-1 p-4 flex flex-col min-h-0">
                            <div className="flex items-center gap-1 mb-2">
                                <ClipboardPaste className="w-3 h-3 text-slate-400" />
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Paste Data
                                </label>
                            </div>
                            <textarea
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                placeholder="Paste CSV or JSON..."
                                className="flex-1 w-full p-3 text-xs font-mono border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mx-4 mb-2 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {/* Parse Button */}
                        <div className="p-4 border-t border-slate-200">
                            <button
                                onClick={handleParse}
                                disabled={isLoading || !rawData.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 rounded-lg transition-colors"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Parsing...
                                    </>
                                ) : (
                                    'Parse Data'
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Monday Source - Board list managed by Wizard now */}
                {sourceType === 'monday' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mb-4" />
                        <div className="text-sm font-medium text-slate-600 mb-2">
                            Monday.com Connected
                        </div>
                        <p className="text-xs text-slate-400 max-w-48">
                            Select a board in the main window to begin import.
                        </p>
                    </div>
                )}

                {/* Collector Source */}
                {sourceType === 'collector' && (
                    <div className="p-4">
                        <CollectorPanel />
                    </div>
                )}

                {/* API Source (placeholder) */}
                {sourceType === 'api' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <Plug className="w-12 h-12 text-slate-300 mb-4" />
                        <div className="text-sm font-medium text-slate-600 mb-2">
                            API Connections
                        </div>
                        <p className="text-xs text-slate-400 max-w-48">
                            Coming soon.
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
}

// ============================================================================
// MONDAY BOARD LIST (inline in sidebar)
// ============================================================================



export default ImportSidebar;
