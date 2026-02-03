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
    Mail,
    HardDrive,
    Link,
    Unplug,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useClaimPairing, usePairingStatus, useUnpairAutoHelper } from '../../api/connections';
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
import { toast } from '../../stores/toastStore';
import { Badge, Button, TextInput, Toggle } from '@autoart/ui';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
        <Badge variant={ok ? 'success' : 'neutral'} size="sm" className="gap-1">
            {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {label}
        </Badge>
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
    const variantMap = { default: 'secondary', danger: 'danger', primary: 'primary' } as const;
    return (
        <Button
            onClick={onClick}
            disabled={disabled || loading}
            variant={variantMap[variant]}
            size="xs"
            leftSection={loading ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
        >
            {children}
        </Button>
    );
}

// ============================================================================
// CARDS
// ============================================================================

function PairCard({ autohelperStatus }: { autohelperStatus: { connected: boolean } }) {
    const queryClient = useQueryClient();
    const claimPairing = useClaimPairing();
    const unpairAutoHelper = useUnpairAutoHelper();
    const [claimCode, setClaimCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);

    // Poll for claim status while showing a code
    const { data: pairingStatus } = usePairingStatus(!!claimCode);

    // When claim is redeemed, clear the code display and invalidate connections
    useEffect(() => {
        if (pairingStatus?.claimed && claimCode) {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            setClaimCode(null);
            setExpiresAt(null);
            toast.success('AutoHelper paired');
        }
    }, [pairingStatus?.claimed, claimCode, queryClient]);

    // Check for code expiration
    useEffect(() => {
        if (!expiresAt) return;
        const checkExpiry = () => {
            if (new Date() >= expiresAt) {
                setClaimCode(null);
                setExpiresAt(null);
                toast.warning('Pairing code expired');
            }
        };
        const interval = setInterval(checkExpiry, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    const handleGenerateCode = useCallback(async () => {
        try {
            const result = await claimPairing.mutateAsync();
            setClaimCode(result.code);
            setExpiresAt(new Date(result.expiresAt));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate pairing code';
            toast.error(msg);
        }
    }, [claimPairing]);

    const handleUnpair = useCallback(async () => {
        try {
            await unpairAutoHelper.mutateAsync();
            toast.info('AutoHelper unpaired');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unpair failed';
            toast.error(msg);
        }
    }, [unpairAutoHelper]);

    const handleCancel = useCallback(() => {
        setClaimCode(null);
        setExpiresAt(null);
    }, []);

    return (
        <CardShell
            icon={<Link className="w-5 h-5 text-[var(--ws-accent)]" />}
            iconBg="bg-[var(--ws-accent)]/10"
            title="Pairing"
            badge={
                <StatusBadge
                    ok={autohelperStatus.connected}
                    label={autohelperStatus.connected ? 'Paired' : 'Not paired'}
                />
            }
        >
            {autohelperStatus.connected ? (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--ws-color-success)]">
                        <CheckCircle2 className="w-4 h-4" />
                        AutoHelper is paired
                    </div>
                    <Button
                        onClick={handleUnpair}
                        disabled={unpairAutoHelper.isPending}
                        variant="danger"
                        size="xs"
                        leftSection={unpairAutoHelper.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
                    >
                        Unpair
                    </Button>
                </div>
            ) : claimCode ? (
                <div className="space-y-4">
                    <div className="text-sm text-ws-text-secondary">
                        Enter this code in AutoHelper's tray menu:
                    </div>
                    <div className="flex items-center gap-4">
                        <code className="text-2xl font-mono font-bold tracking-widest text-[var(--ws-accent)] bg-[var(--ws-accent)]/5 px-4 py-2 rounded-lg border border-[var(--ws-accent)]/20">
                            {claimCode}
                        </code>
                        <div className="flex items-center gap-2 text-sm text-ws-text-secondary">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Waiting...
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleCancel}
                            variant="secondary"
                            size="xs"
                        >
                            Cancel
                        </Button>
                        <span className="text-xs text-ws-muted">
                            Code expires in 5 minutes
                        </span>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-ws-text-secondary">
                        Click below to generate a pairing code, then enter it in AutoHelper's system tray.
                    </p>
                    <Button
                        onClick={handleGenerateCode}
                        disabled={claimPairing.isPending}
                        variant="primary"
                        size="sm"
                        leftSection={claimPairing.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                    >
                        Generate Pairing Code
                    </Button>
                </div>
            )}
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
            icon={<Server className="w-5 h-5 text-[var(--ws-accent)]" />}
            iconBg="bg-[var(--ws-accent)]/10"
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
                        <span className="text-xs text-[var(--ws-color-error)]">Rebuild entire index?</span>
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
            icon={<FolderSearch className="w-5 h-5 text-[var(--ws-color-warning)]" />}
            iconBg="bg-[var(--ws-color-warning)]/10"
            title="Collector"
            badge={active ? <StatusBadge ok label="Running" /> : undefined}
        >
            <FieldRow label="URL">
                <TextInput
                    type="url"
                    size="sm"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/gallery"
                />
            </FieldRow>
            <FieldRow label="Output path">
                <TextInput
                    size="sm"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="(default)"
                />
            </FieldRow>
            <FieldRow label="Crawl depth">
                <TextInput
                    type="number"
                    size="sm"
                    value={String(crawlDepth)}
                    onChange={(e) => setCrawlDepth(e.target.value ? Number(e.target.value) : '')}
                    className="w-24"
                />
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Min width">
                    <TextInput type="number" size="sm" value={String(minWidth)} onChange={(e) => setMinWidth(e.target.value ? Number(e.target.value) : '')} className="w-24" />
                </FieldRow>
                <FieldRow label="Max width">
                    <TextInput type="number" size="sm" value={String(maxWidth)} onChange={(e) => setMaxWidth(e.target.value ? Number(e.target.value) : '')} className="w-24" />
                </FieldRow>
                <FieldRow label="Min height">
                    <TextInput type="number" size="sm" value={String(minHeight)} onChange={(e) => setMinHeight(e.target.value ? Number(e.target.value) : '')} className="w-24" />
                </FieldRow>
                <FieldRow label="Max height">
                    <TextInput type="number" size="sm" value={String(maxHeight)} onChange={(e) => setMaxHeight(e.target.value ? Number(e.target.value) : '')} className="w-24" />
                </FieldRow>
                <FieldRow label="Min size (KB)">
                    <TextInput type="number" size="sm" value={String(minFilesize)} onChange={(e) => setMinFilesize(e.target.value ? Number(e.target.value) : '')} className="w-24" />
                </FieldRow>
                <FieldRow label="Max size (KB)">
                    <TextInput type="number" size="sm" value={String(maxFilesize)} onChange={(e) => setMaxFilesize(e.target.value ? Number(e.target.value) : '')} className="w-24" />
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
                <p className={`text-xs ${invoke.data?.success ? 'text-[var(--ws-color-success)]' : 'text-[var(--ws-color-error)]'}`}>
                    {invoke.data?.success
                        ? `Done — ${invoke.data.artifacts?.length ?? 0} artifacts collected`
                        : `Failed: ${invoke.data?.error ?? 'unknown error'}`}
                </p>
            )}
            {invoke.isError && (
                <p className="text-xs text-[var(--ws-color-error)]">Error: {(invoke.error as Error).message}</p>
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

    const handleToggleEnabled = useCallback((next: boolean) => {
        setLocalEnabled(next);
        updateConfig.mutate({ mail_enabled: next });
    }, [updateConfig]);

    const handleSave = useCallback(() => {
        updateConfig.mutate({
            mail_enabled: enabled,
            mail_poll_interval: pollInterval || 30,
        });
    }, [updateConfig, enabled, pollInterval]);

    return (
        <CardShell
            icon={<Mail className="w-5 h-5 text-[var(--ws-color-info)]" />}
            iconBg="bg-[var(--ws-color-info)]/10"
            title="Mail"
            badge={<StatusBadge ok={running} label={running ? 'Running' : 'Stopped'} />}
        >
            <FieldRow label="Enabled">
                <Toggle checked={enabled} onChange={handleToggleEnabled} />
            </FieldRow>
            <FieldRow label="Poll interval (s)">
                <TextInput
                    type="number"
                    size="sm"
                    value={String(pollInterval)}
                    onChange={(e) => setPollInterval(e.target.value ? Number(e.target.value) : '')}
                    className="w-24"
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

    const roots: string[] = useMemo(
        () => (config?.allowed_roots as string[]) ?? [],
        [config?.allowed_roots],
    );

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
            iconBg="bg-[var(--ws-bg)]"
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
                                className="opacity-0 group-hover:opacity-100 text-ws-muted hover:text-[var(--ws-color-error)] transition-opacity"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex gap-2 pt-2">
                <TextInput
                    size="sm"
                    value={newRoot}
                    onChange={(e) => setNewRoot(e.target.value)}
                    placeholder="/path/to/files"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="flex-1"
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
            iconBg="bg-[var(--ws-bg)]"
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
                    <p className="text-xs text-[var(--ws-color-success)] mt-1">GC started</p>
                )}
                {runGC.isError && (
                    <p className="text-xs text-[var(--ws-color-error)] mt-1">
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
    autohelperStatus?: { connected: boolean };
}

export function AutoHelperSection({
    autohelperStatus = { connected: false },
}: AutoHelperSectionProps) {
    const { isError: healthError, isLoading: healthLoading } = useAutoHelperHealth();

    // Toast on pairing status transitions (not on initial load)
    const prevConnected = useRef<boolean | null>(null);
    useEffect(() => {
        const connected = autohelperStatus.connected;
        if (prevConnected.current !== null && prevConnected.current !== connected) {
            if (connected) {
                toast.success('AutoHelper connected');
            } else {
                toast.warning('AutoHelper disconnected');
            }
        }
        prevConnected.current = connected;
    }, [autohelperStatus.connected]);

    // Pairing card always renders — works regardless of AutoHelper connectivity.
    const pairingCard = <PairCard autohelperStatus={autohelperStatus} />;

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
                <div className="bg-[var(--ws-color-warning)]/5 border border-[var(--ws-color-warning)]/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[var(--ws-color-warning)] flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-ws-fg">AutoHelper is not running</p>
                        <p className="text-xs text-[var(--ws-color-warning)] mt-1">
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
