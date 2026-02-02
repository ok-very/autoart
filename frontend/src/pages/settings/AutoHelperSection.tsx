/**
 * AutoHelperSection
 *
 * Settings section for operating the AutoHelper service.
 * Five cards: Service Status, Collector, Mail, Roots, Advanced.
 * Shows a connectivity guard if the service is not reachable.
 */

import {
    Server,
    Database,
    FolderSearch,
    RefreshCw,
    Play,
    Square,
    Trash2,
    Plus,
    X,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    AlertCircle,
    Mail,
    HardDrive,
    Key,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import {
    useAutoHelperHealth,
    useAutoHelperStatus,
    useAutoHelperConfig,
    useUpdateAutoHelperConfig,
    useIndexStatus,
    useRescanIndex,
    useRebuildIndex,
    useRunnerStatus,
    useInvokeRunner,
    useMailStatus,
    useStartMail,
    useStopMail,
    useGCStatus,
    useRunGC,
} from '../../api/hooks/autohelper';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${ok
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-ws-text-secondary'
                }`}
        >
            {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {label}
        </span>
    );
}

function CardShell({
    icon,
    iconBg,
    title,
    badge,
    children,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden">
            <div className="p-4 border-b border-ws-panel-border">
                <div className="flex items-start gap-3">
                    <div
                        className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-ws-fg">{title}</h3>
                            {badge}
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4">
            <span className="text-sm text-ws-text-secondary w-36 flex-shrink-0">{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function SmallButton({
    onClick,
    disabled,
    loading,
    variant = 'default',
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'default' | 'danger' | 'primary';
    children: React.ReactNode;
}) {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50';
    const variants = {
        default: 'bg-slate-100 text-ws-text-secondary hover:bg-slate-200',
        danger: 'bg-red-50 text-red-700 hover:bg-red-100',
        primary: 'bg-indigo-500 text-white hover:bg-indigo-600',
    };
    return (
        <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]}`}>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {children}
        </button>
    );
}

// ============================================================================
// CARDS
// ============================================================================

function PairingCodeCard({
    onGenerateCode,
    autohelperStatus,
}: {
    onGenerateCode: () => Promise<{ code: string; expiresAt: string }>;
    autohelperStatus: { connected: boolean };
}) {
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getErrorMessage = (err: unknown): string => {
        if (!err) return 'Failed to generate code';
        if (typeof err === 'object') {
            const anyErr = err as {
                response?: { data?: { error?: string; message?: string } };
                message?: string;
            };
            const apiMessage =
                anyErr.response?.data?.error ??
                anyErr.response?.data?.message ??
                anyErr.message;
            if (typeof apiMessage === 'string' && apiMessage.trim()) {
                return apiMessage;
            }
        }
        if (err instanceof Error && err.message) return err.message;
        return 'Failed to generate code';
    };

    const handleGenerateCode = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await onGenerateCode();
            setPairingCode(result.code);
            setExpiresAt(result.expiresAt);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [onGenerateCode]);

    return (
        <CardShell
            icon={<Key className="w-5 h-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
            title="Pairing Code"
            badge={
                <StatusBadge
                    ok={autohelperStatus.connected}
                    label={autohelperStatus.connected ? 'Paired' : 'Not paired'}
                />
            }
        >
            {autohelperStatus.connected ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    AutoHelper is connected
                </div>
            ) : (
                <div className="space-y-3">
                    {pairingCode ? (
                        <div className="bg-ws-bg border border-ws-panel-border rounded-lg p-4 text-center">
                            <p className="text-xs text-ws-text-secondary mb-2">
                                Enter this code in AutoHelper:
                            </p>
                            <div className="font-mono text-ws-h1 font-semibold text-ws-fg tracking-widest">
                                {pairingCode}
                            </div>
                            {expiresAt && (
                                <p className="text-xs text-ws-muted mt-2">
                                    Expires in 5 minutes
                                </p>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleGenerateCode}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:bg-slate-300"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Key className="w-4 h-4" />
                            )}
                            Generate Pairing Code
                        </button>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>
            )}
            <div className="mt-1 flex items-start gap-2 text-xs text-ws-muted">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                    Generate a code here, then enter it in AutoHelper to connect.
                    Pairing works regardless of AutoHelper connectivity.
                </span>
            </div>
        </CardShell>
    );
}

function ServiceStatusCard() {
    const { data: status } = useAutoHelperStatus();
    const { data: indexStatus } = useIndexStatus();
    const rescan = useRescanIndex();
    const rebuild = useRebuildIndex();
    const [confirmRebuild, setConfirmRebuild] = useState(false);

    const dbOk = status?.database?.connected ?? false;

    return (
        <CardShell
            icon={<Server className="w-5 h-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
            title="Service Status"
            badge={<StatusBadge ok={dbOk} label={dbOk ? 'Connected' : 'DB offline'} />}
        >
            <FieldRow label="Database">
                <span className="text-sm text-ws-fg">{status?.database?.path ?? '—'}</span>
            </FieldRow>
            <FieldRow label="Migration">
                <span className="text-sm text-ws-fg">{status?.database?.migration_status ?? '—'}</span>
            </FieldRow>
            <FieldRow label="Indexed files">
                <span className="text-sm text-ws-fg">
                    {indexStatus?.total_files != null ? indexStatus.total_files.toLocaleString() : '—'}
                </span>
            </FieldRow>
            <FieldRow label="Last index run">
                <span className="text-sm text-ws-fg">{indexStatus?.last_run ?? '—'}</span>
            </FieldRow>

            <div className="flex gap-2 pt-2">
                <SmallButton
                    onClick={() => rescan.mutate()}
                    loading={rescan.isPending}
                    disabled={rescan.isPending}
                >
                    <RefreshCw className="w-3 h-3" /> Rescan
                </SmallButton>
                {!confirmRebuild ? (
                    <SmallButton
                        onClick={() => setConfirmRebuild(true)}
                        variant="danger"
                    >
                        <Trash2 className="w-3 h-3" /> Rebuild
                    </SmallButton>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Rebuild entire index?</span>
                        <SmallButton
                            onClick={() => {
                                rebuild.mutate();
                                setConfirmRebuild(false);
                            }}
                            loading={rebuild.isPending}
                            variant="danger"
                        >
                            Confirm
                        </SmallButton>
                        <SmallButton onClick={() => setConfirmRebuild(false)}>
                            Cancel
                        </SmallButton>
                    </div>
                )}
            </div>
        </CardShell>
    );
}

function CollectorCard() {
    const { data: config } = useAutoHelperConfig();
    const updateConfig = useUpdateAutoHelperConfig();
    const invoke = useInvokeRunner();
    const { data: runnerStatus } = useRunnerStatus();

    const [url, setUrl] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [crawlDepth, setCrawlDepth] = useState<number | ''>('');
    const [minWidth, setMinWidth] = useState<number | ''>('');
    const [maxWidth, setMaxWidth] = useState<number | ''>('');
    const [minHeight, setMinHeight] = useState<number | ''>('');
    const [maxHeight, setMaxHeight] = useState<number | ''>('');
    const [minFilesize, setMinFilesize] = useState<number | ''>('');
    const [maxFilesize, setMaxFilesize] = useState<number | ''>('');
    const [loaded, setLoaded] = useState(false);

    // Seed local state from config on first load
    if (config && !loaded) {
        setCrawlDepth(config.crawl_depth as number ?? 20);
        setMinWidth(config.min_width as number ?? 100);
        setMaxWidth(config.max_width as number ?? 5000);
        setMinHeight(config.min_height as number ?? 100);
        setMaxHeight(config.max_height as number ?? 5000);
        setMinFilesize(config.min_filesize_kb as number ?? 100);
        setMaxFilesize(config.max_filesize_kb as number ?? 12000);
        setLoaded(true);
    }

    const handleSave = useCallback(() => {
        updateConfig.mutate({
            crawl_depth: crawlDepth || 20,
            min_width: minWidth || 100,
            max_width: maxWidth || 5000,
            min_height: minHeight || 100,
            max_height: maxHeight || 5000,
            min_filesize_kb: minFilesize || 100,
            max_filesize_kb: maxFilesize || 12000,
        });
    }, [updateConfig, crawlDepth, minWidth, maxWidth, minHeight, maxHeight, minFilesize, maxFilesize]);

    const handleRun = useCallback(() => {
        if (!url.trim()) return;
        invoke.mutate({ url: url.trim(), output_path: outputPath || undefined });
    }, [invoke, url, outputPath]);

    const active = runnerStatus?.active ?? false;

    return (
        <CardShell
            icon={<FolderSearch className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
            title="Collector"
            badge={active ? <StatusBadge ok label="Running" /> : undefined}
        >
            <FieldRow label="URL">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/gallery"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </FieldRow>
            <FieldRow label="Output path">
                <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="(default)"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </FieldRow>
            <FieldRow label="Crawl depth">
                <input
                    type="number"
                    value={crawlDepth}
                    onChange={(e) => setCrawlDepth(e.target.value ? Number(e.target.value) : '')}
                    className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Min width">
                    <input type="number" value={minWidth} onChange={(e) => setMinWidth(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
                <FieldRow label="Max width">
                    <input type="number" value={maxWidth} onChange={(e) => setMaxWidth(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
                <FieldRow label="Min height">
                    <input type="number" value={minHeight} onChange={(e) => setMinHeight(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
                <FieldRow label="Max height">
                    <input type="number" value={maxHeight} onChange={(e) => setMaxHeight(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
                <FieldRow label="Min size (KB)">
                    <input type="number" value={minFilesize} onChange={(e) => setMinFilesize(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
                <FieldRow label="Max size (KB)">
                    <input type="number" value={maxFilesize} onChange={(e) => setMaxFilesize(e.target.value ? Number(e.target.value) : '')} className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </FieldRow>
            </div>

            <div className="flex gap-2 pt-2">
                <SmallButton onClick={handleSave} loading={updateConfig.isPending} variant="default">
                    Save Settings
                </SmallButton>
                <SmallButton
                    onClick={handleRun}
                    loading={invoke.isPending}
                    disabled={!url.trim() || invoke.isPending}
                    variant="primary"
                >
                    <Play className="w-3 h-3" /> Run Collector
                </SmallButton>
            </div>

            {invoke.isSuccess && (
                <p className="text-xs text-emerald-600">
                    {invoke.data?.success
                        ? `Done — ${invoke.data.artifacts?.length ?? 0} artifacts collected`
                        : `Failed: ${invoke.data?.error ?? 'unknown error'}`}
                </p>
            )}
            {invoke.isError && (
                <p className="text-xs text-red-600">Error: {(invoke.error as Error).message}</p>
            )}
        </CardShell>
    );
}

function MailCard() {
    const { data: mailStatus } = useMailStatus();
    const { data: config } = useAutoHelperConfig();
    const updateConfig = useUpdateAutoHelperConfig();
    const startMail = useStartMail();
    const stopMail = useStopMail();

    const [pollInterval, setPollInterval] = useState<number | ''>(
        (config?.mail_poll_interval as number) ?? 30,
    );
    const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);

    const enabled = localEnabled ?? mailStatus?.enabled ?? false;
    const running = mailStatus?.running ?? false;

    const handleToggleEnabled = useCallback(() => {
        const next = !enabled;
        setLocalEnabled(next);
        updateConfig.mutate({ mail_enabled: next });
    }, [enabled, updateConfig]);

    const handleSave = useCallback(() => {
        updateConfig.mutate({
            mail_enabled: enabled,
            mail_poll_interval: pollInterval || 30,
        });
    }, [updateConfig, enabled, pollInterval]);

    return (
        <CardShell
            icon={<Mail className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-100"
            title="Mail"
            badge={<StatusBadge ok={running} label={running ? 'Running' : 'Stopped'} />}
        >
            <FieldRow label="Enabled">
                <button
                    onClick={handleToggleEnabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-ws-panel-bg transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </FieldRow>
            <FieldRow label="Poll interval (s)">
                <input
                    type="number"
                    value={pollInterval}
                    onChange={(e) => setPollInterval(e.target.value ? Number(e.target.value) : '')}
                    className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </FieldRow>
            <FieldRow label="Output path">
                <span className="text-sm text-ws-fg truncate block">{mailStatus?.output_path ?? '—'}</span>
            </FieldRow>
            <FieldRow label="Ingest path">
                <span className="text-sm text-ws-fg truncate block">{mailStatus?.ingest_path ?? '—'}</span>
            </FieldRow>

            <div className="flex gap-2 pt-2">
                <SmallButton onClick={handleSave} loading={updateConfig.isPending}>
                    Save
                </SmallButton>
                {running ? (
                    <SmallButton onClick={() => stopMail.mutate()} loading={stopMail.isPending} variant="danger">
                        <Square className="w-3 h-3" /> Stop
                    </SmallButton>
                ) : (
                    <SmallButton onClick={() => startMail.mutate()} loading={startMail.isPending} variant="primary">
                        <Play className="w-3 h-3" /> Start
                    </SmallButton>
                )}
            </div>
        </CardShell>
    );
}

function RootsCard() {
    const { data: config } = useAutoHelperConfig();
    const updateConfig = useUpdateAutoHelperConfig();
    const [newRoot, setNewRoot] = useState('');

    const roots: string[] = (config?.allowed_roots as string[]) ?? [];

    const handleAdd = useCallback(() => {
        const trimmed = newRoot.trim();
        if (!trimmed || roots.includes(trimmed)) return;
        updateConfig.mutate({ allowed_roots: [...roots, trimmed] });
        setNewRoot('');
    }, [newRoot, roots, updateConfig]);

    const handleRemove = useCallback(
        (root: string) => {
            updateConfig.mutate({ allowed_roots: roots.filter((r) => r !== root) });
        },
        [roots, updateConfig],
    );

    return (
        <CardShell
            icon={<HardDrive className="w-5 h-5 text-ws-text-secondary" />}
            iconBg="bg-slate-100"
            title="Roots"
        >
            {roots.length === 0 ? (
                <p className="text-sm text-ws-muted">No roots configured</p>
            ) : (
                <ul className="space-y-1">
                    {roots.map((root) => (
                        <li key={root} className="flex items-center gap-2 group">
                            <span className="text-sm text-ws-fg font-mono truncate flex-1">{root}</span>
                            <button
                                onClick={() => handleRemove(root)}
                                className="opacity-0 group-hover:opacity-100 text-ws-muted hover:text-red-500 transition-opacity"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex gap-2 pt-2">
                <input
                    type="text"
                    value={newRoot}
                    onChange={(e) => setNewRoot(e.target.value)}
                    placeholder="/path/to/files"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <SmallButton onClick={handleAdd} disabled={!newRoot.trim()}>
                    <Plus className="w-3 h-3" /> Add
                </SmallButton>
            </div>
        </CardShell>
    );
}

function AdvancedCard() {
    const { data: status } = useAutoHelperStatus();
    const { data: config } = useAutoHelperConfig();
    const { data: gcStatus } = useGCStatus();
    const runGC = useRunGC();

    return (
        <CardShell
            icon={<Database className="w-5 h-5 text-ws-text-secondary" />}
            iconBg="bg-slate-100"
            title="Advanced"
        >
            <FieldRow label="Host">
                <span className="text-sm text-ws-fg font-mono">
                    {(config as Record<string, unknown>)?.host as string ?? '127.0.0.1'}
                </span>
            </FieldRow>
            <FieldRow label="CORS origins">
                <span className="text-sm text-ws-fg font-mono truncate block">
                    {Array.isArray((config as Record<string, unknown>)?.cors_origins)
                        ? ((config as Record<string, unknown>).cors_origins as string[]).join(', ')
                        : '—'}
                </span>
            </FieldRow>
            <FieldRow label="DB path">
                <span className="text-sm text-ws-fg font-mono truncate block">
                    {status?.database?.path ?? '—'}
                </span>
            </FieldRow>

            <div className="pt-2 border-t border-ws-panel-border">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-ws-fg">Garbage Collection</p>
                        <p className="text-xs text-ws-text-secondary">
                            {gcStatus?.enabled ? 'Enabled' : 'Disabled'}
                            {gcStatus?.last_run ? ` — last run ${gcStatus.last_run}` : ''}
                        </p>
                    </div>
                    <SmallButton onClick={() => runGC.mutate()} loading={runGC.isPending}>
                        Run GC
                    </SmallButton>
                </div>
                {runGC.isSuccess && (
                    <p className="text-xs text-emerald-600 mt-1">GC started</p>
                )}
                {runGC.isError && (
                    <p className="text-xs text-red-600 mt-1">
                        {(runGC.error as Error).message}
                    </p>
                )}
            </div>
        </CardShell>
    );
}

// ============================================================================
// MAIN SECTION
// ============================================================================

interface AutoHelperSectionProps {
    onGenerateCode?: () => Promise<{ code: string; expiresAt: string }>;
    autohelperStatus?: { connected: boolean };
}

export function AutoHelperSection({
    onGenerateCode = async () => ({ code: '', expiresAt: '' }),
    autohelperStatus = { connected: false },
}: AutoHelperSectionProps) {
    const { isError: healthError, isLoading: healthLoading } = useAutoHelperHealth();

    // Pairing code card always renders — it's a backend operation,
    // works regardless of AutoHelper connectivity.
    const pairingCard = (
        <PairingCodeCard
            onGenerateCode={onGenerateCode}
            autohelperStatus={autohelperStatus}
        />
    );

    if (healthLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">AutoHelper</h2>
                    <p className="text-sm text-ws-text-secondary mt-1">Local service management</p>
                </div>
                {pairingCard}
                <div className="flex items-center gap-2 text-ws-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Connecting to AutoHelper...</span>
                </div>
            </div>
        );
    }

    if (healthError) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">AutoHelper</h2>
                    <p className="text-sm text-ws-text-secondary mt-1">Local service management</p>
                </div>
                {pairingCard}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">AutoHelper is not running</p>
                        <p className="text-xs text-amber-600 mt-1">
                            Start the service to manage indexing, mail, and collector settings.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-ws-h2 font-semibold text-ws-fg">AutoHelper</h2>
                <p className="text-sm text-ws-text-secondary mt-1">Local service management</p>
            </div>

            {pairingCard}
            <ServiceStatusCard />
            <CollectorCard />
            <MailCard />
            <RootsCard />
            <AdvancedCard />
        </div>
    );
}
