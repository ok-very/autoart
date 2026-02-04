/**
 * AutoHelperSection
 *
 * Settings section for operating the AutoHelper service.
 * Uses backend bridge for settings/commands (works even when AutoHelper is remote).
 * Falls back gracefully when AutoHelper is offline.
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
    Clock,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useClaimPairing, usePairingStatus, useUnpairAutoHelper } from '../../api/connections';
import {
    useBridgeSettings,
    useUpdateBridgeSettings,
    useBridgeStatus,
    useQueueCommand,
} from '../../api/hooks/autohelper';
import { toast } from '../../stores/toastStore';
import { Badge, Button, TextInput, Toggle } from '@autoart/ui';

// ============================================================================
// HELPERS
// ============================================================================

function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return 'Never connected';

    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
}

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

/** Shows pending command indicator */
function PendingCommandBadge({ type, status }: { type: string; status: string }) {
    const label = status === 'running' ? `Running: ${type}` : `Pending: ${type}`;
    return (
        <Badge variant="warning" size="sm" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {label}
        </Badge>
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
    const [secondsLeft, setSecondsLeft] = useState<number>(0);
    const [confirmUnpair, setConfirmUnpair] = useState(false);

    // Poll for claim status while showing a code
    const { data: pairingStatus } = usePairingStatus(!!claimCode);

    // When claim is redeemed, refetch connections then show toast
    // Clear state immediately to prevent re-triggering from re-renders (e.g., countdown timer)
    useEffect(() => {
        if (pairingStatus?.claimed && claimCode) {
            // Clear state synchronously to prevent effect re-entry
            setClaimCode(null);
            setExpiresAt(null);
            setSecondsLeft(0);
            // Refetch connections so autohelperStatus.connected updates, then toast
            queryClient.refetchQueries({ queryKey: ['connections'] }).then(() => {
                toast.success('AutoHelper paired');
            });
        }
    }, [pairingStatus?.claimed, claimCode, queryClient]);

    // Check for code expiration and update countdown
    useEffect(() => {
        if (!expiresAt) return;
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining <= 0) {
                setClaimCode(null);
                setExpiresAt(null);
                toast.warning('Pairing code expired');
            }
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

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
        if (!confirmUnpair) {
            setConfirmUnpair(true);
            return;
        }
        try {
            await unpairAutoHelper.mutateAsync();
            toast.info('AutoHelper unpaired');
            setConfirmUnpair(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unpair failed';
            toast.error(msg);
        }
    }, [unpairAutoHelper, confirmUnpair]);

    const handleCancelUnpair = useCallback(() => {
        setConfirmUnpair(false);
    }, []);

    const handleCancel = useCallback(() => {
        setClaimCode(null);
        setExpiresAt(null);
        setSecondsLeft(0);
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
                    {confirmUnpair ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--ws-color-error)]">Unpair AutoHelper?</span>
                            <Button
                                onClick={handleUnpair}
                                disabled={unpairAutoHelper.isPending}
                                variant="danger"
                                size="xs"
                                leftSection={unpairAutoHelper.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
                            >
                                Confirm
                            </Button>
                            <Button
                                onClick={handleCancelUnpair}
                                variant="secondary"
                                size="xs"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={handleUnpair}
                            variant="secondary"
                            size="xs"
                            leftSection={<Unplug className="w-3 h-3" />}
                        >
                            Unpair
                        </Button>
                    )}
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
                        <Button onClick={handleCancel} variant="secondary" size="xs">
                            Cancel
                        </Button>
                        <span className="text-xs text-ws-muted">
                            Expires in {formatTime(secondsLeft)}
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

function ServiceStatusCard({ lastSeen }: { lastSeen: string | null }) {
    const { data: bridgeStatus } = useBridgeStatus();
    const queueCommand = useQueueCommand();

    const [confirmRebuild, setConfirmRebuild] = useState(false);

    const status = bridgeStatus?.status;
    const dbOk = status?.database?.connected ?? false;
    const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 30000;

    // Check for pending index commands
    const pendingIndexCmd = bridgeStatus?.pendingCommands?.find(
        c => c.type === 'rescan_index' || c.type === 'rebuild_index'
    );

    const handleRescan = useCallback(() => {
        queueCommand.mutate({ commandType: 'rescan_index' });
        toast.info('Rescan queued');
    }, [queueCommand]);

    const handleRebuild = useCallback(() => {
        queueCommand.mutate({ commandType: 'rebuild_index' });
        setConfirmRebuild(false);
        toast.info('Rebuild queued');
    }, [queueCommand]);

    return (
        <CardShell
            icon={<Server className="w-5 h-5 text-[var(--ws-accent)]" />}
            iconBg="bg-[var(--ws-accent)]/10"
            title="Service Status"
            badge={
                pendingIndexCmd ? (
                    <PendingCommandBadge type={pendingIndexCmd.type} status={pendingIndexCmd.status} />
                ) : (
                    <StatusBadge ok={dbOk} label={dbOk ? 'Connected' : 'DB offline'} />
                )
            }
        >
            <FieldRow label="Last seen">
                <span className={`text-sm ${isOnline ? 'text-[var(--ws-color-success)]' : 'text-ws-text-secondary'}`}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatLastSeen(lastSeen)}
                </span>
            </FieldRow>
            <FieldRow label="Database">
                <span className="text-sm text-ws-fg">{status?.database?.path ?? '—'}</span>
            </FieldRow>
            <FieldRow label="Migration">
                <span className="text-sm text-ws-fg">{status?.database?.migration_status ?? '—'}</span>
            </FieldRow>
            <FieldRow label="Indexed files">
                <span className="text-sm text-ws-fg">
                    {status?.index?.total_files != null ? status.index.total_files.toLocaleString() : '—'}
                </span>
            </FieldRow>
            <FieldRow label="Last index run">
                <span className="text-sm text-ws-fg">{status?.index?.last_run ?? '—'}</span>
            </FieldRow>

            <div className="flex gap-2 pt-2">
                <SmallButton
                    onClick={handleRescan}
                    loading={queueCommand.isPending}
                    disabled={!!pendingIndexCmd}
                >
                    <RefreshCw className="w-3 h-3" /> Rescan
                </SmallButton>
                {!confirmRebuild ? (
                    <SmallButton
                        onClick={() => setConfirmRebuild(true)}
                        variant="danger"
                        disabled={!!pendingIndexCmd}
                    >
                        <Trash2 className="w-3 h-3" /> Rebuild
                    </SmallButton>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--ws-color-error)]">Rebuild entire index?</span>
                        <SmallButton onClick={handleRebuild} variant="danger">
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
    const { data: bridgeSettings } = useBridgeSettings();
    const updateSettings = useUpdateBridgeSettings();
    const queueCommand = useQueueCommand();
    const { data: bridgeStatus } = useBridgeStatus();

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

    const settings = bridgeSettings?.settings;

    // Seed local state from settings on first load
    if (settings && !loaded) {
        setCrawlDepth(settings.crawl_depth ?? 20);
        setMinWidth(settings.min_width ?? 100);
        setMaxWidth(settings.max_width ?? 5000);
        setMinHeight(settings.min_height ?? 100);
        setMaxHeight(settings.max_height ?? 5000);
        setMinFilesize(settings.min_filesize_kb ?? 100);
        setMaxFilesize(settings.max_filesize_kb ?? 12000);
        setLoaded(true);
    }

    const handleSave = useCallback(() => {
        updateSettings.mutate({
            crawl_depth: crawlDepth || 20,
            min_width: minWidth || 100,
            max_width: maxWidth || 5000,
            min_height: minHeight || 100,
            max_height: maxHeight || 5000,
            min_filesize_kb: minFilesize || 100,
            max_filesize_kb: maxFilesize || 12000,
        });
        toast.success('Settings saved');
    }, [updateSettings, crawlDepth, minWidth, maxWidth, minHeight, maxHeight, minFilesize, maxFilesize]);

    const handleRun = useCallback(() => {
        if (!url.trim()) return;
        queueCommand.mutate({
            commandType: 'run_collector',
            payload: { url: url.trim(), output_path: outputPath || undefined },
        });
        toast.info('Collector queued');
    }, [queueCommand, url, outputPath]);

    const active = bridgeStatus?.status?.runner?.active ?? false;
    const pendingCollectorCmd = bridgeStatus?.pendingCommands?.find(c => c.type === 'run_collector');

    return (
        <CardShell
            icon={<FolderSearch className="w-5 h-5 text-[var(--ws-color-warning)]" />}
            iconBg="bg-[var(--ws-color-warning)]/10"
            title="Collector"
            badge={
                pendingCollectorCmd ? (
                    <PendingCommandBadge type="collector" status={pendingCollectorCmd.status} />
                ) : active ? (
                    <StatusBadge ok label="Running" />
                ) : undefined
            }
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
                <SmallButton onClick={handleSave} loading={updateSettings.isPending} variant="default">
                    Save Settings
                </SmallButton>
                <SmallButton
                    onClick={handleRun}
                    loading={queueCommand.isPending}
                    disabled={!url.trim() || !!pendingCollectorCmd || active}
                    variant="primary"
                >
                    <Play className="w-3 h-3" /> Run Collector
                </SmallButton>
            </div>
        </CardShell>
    );
}

function MailCard() {
    const { data: bridgeSettings } = useBridgeSettings();
    const { data: bridgeStatus } = useBridgeStatus();
    const updateSettings = useUpdateBridgeSettings();
    const queueCommand = useQueueCommand();

    const settings = bridgeSettings?.settings;
    const status = bridgeStatus?.status;

    const [pollInterval, setPollInterval] = useState<number | ''>(settings?.mail_poll_interval ?? 30);
    const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);

    const enabled = localEnabled ?? settings?.mail_enabled ?? false;
    const running = status?.mail?.running ?? false;

    const pendingMailCmd = bridgeStatus?.pendingCommands?.find(
        c => c.type === 'start_mail' || c.type === 'stop_mail'
    );

    const handleToggleEnabled = useCallback((next: boolean) => {
        setLocalEnabled(next);
        updateSettings.mutate({ mail_enabled: next });
    }, [updateSettings]);

    const handleSave = useCallback(() => {
        updateSettings.mutate({
            mail_enabled: enabled,
            mail_poll_interval: pollInterval || 30,
        });
        toast.success('Mail settings saved');
    }, [updateSettings, enabled, pollInterval]);

    const handleStart = useCallback(() => {
        queueCommand.mutate({ commandType: 'start_mail' });
        toast.info('Mail start queued');
    }, [queueCommand]);

    const handleStop = useCallback(() => {
        queueCommand.mutate({ commandType: 'stop_mail' });
        toast.info('Mail stop queued');
    }, [queueCommand]);

    return (
        <CardShell
            icon={<Mail className="w-5 h-5 text-[var(--ws-color-info)]" />}
            iconBg="bg-[var(--ws-color-info)]/10"
            title="Mail"
            badge={
                pendingMailCmd ? (
                    <PendingCommandBadge type={pendingMailCmd.type} status={pendingMailCmd.status} />
                ) : (
                    <StatusBadge ok={running} label={running ? 'Running' : 'Stopped'} />
                )
            }
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

            <div className="flex gap-2 pt-2">
                <SmallButton onClick={handleSave} loading={updateSettings.isPending}>
                    Save
                </SmallButton>
                {running ? (
                    <SmallButton
                        onClick={handleStop}
                        loading={queueCommand.isPending}
                        disabled={!!pendingMailCmd}
                        variant="danger"
                    >
                        <Square className="w-3 h-3" /> Stop
                    </SmallButton>
                ) : (
                    <SmallButton
                        onClick={handleStart}
                        loading={queueCommand.isPending}
                        disabled={!!pendingMailCmd}
                        variant="primary"
                    >
                        <Play className="w-3 h-3" /> Start
                    </SmallButton>
                )}
            </div>
        </CardShell>
    );
}

function RootsCard() {
    const { data: bridgeSettings } = useBridgeSettings();
    const updateSettings = useUpdateBridgeSettings();
    const [newRoot, setNewRoot] = useState('');

    const roots: string[] = useMemo(
        () => bridgeSettings?.settings?.allowed_roots ?? [],
        [bridgeSettings?.settings?.allowed_roots],
    );

    const handleAdd = useCallback(() => {
        const trimmed = newRoot.trim();
        if (!trimmed || roots.includes(trimmed)) return;
        updateSettings.mutate({ allowed_roots: [...roots, trimmed] });
        setNewRoot('');
        toast.success('Root added');
    }, [newRoot, roots, updateSettings]);

    const handleRemove = useCallback(
        (root: string) => {
            updateSettings.mutate({ allowed_roots: roots.filter((r) => r !== root) });
            toast.info('Root removed');
        },
        [roots, updateSettings],
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
    const { data: bridgeStatus } = useBridgeStatus();
    const queueCommand = useQueueCommand();

    const status = bridgeStatus?.status;
    const pendingGcCmd = bridgeStatus?.pendingCommands?.find(c => c.type === 'run_gc');

    const handleRunGC = useCallback(() => {
        queueCommand.mutate({ commandType: 'run_gc' });
        toast.info('GC queued');
    }, [queueCommand]);

    return (
        <CardShell
            icon={<Database className="w-5 h-5 text-ws-text-secondary" />}
            iconBg="bg-[var(--ws-bg)]"
            title="Advanced"
        >
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
                            {status?.gc?.enabled ? 'Enabled' : 'Disabled'}
                            {status?.gc?.last_run ? ` — last run ${status.gc.last_run}` : ''}
                        </p>
                    </div>
                    <SmallButton
                        onClick={handleRunGC}
                        loading={queueCommand.isPending}
                        disabled={!!pendingGcCmd}
                    >
                        Run GC
                    </SmallButton>
                </div>
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
    const { data: bridgeStatus, isLoading: statusLoading } = useBridgeStatus({
        enabled: autohelperStatus.connected,
        refetchInterval: 5000, // Poll every 5 seconds when connected
    });

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

    // Not paired - show pairing card only
    if (!autohelperStatus.connected) {
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
                        <p className="text-sm font-medium text-ws-fg">AutoHelper is not paired</p>
                        <p className="text-xs text-[var(--ws-color-warning)] mt-1">
                            Pair AutoHelper to manage settings, indexing, mail, and collector from this dashboard.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (statusLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">AutoHelper</h2>
                    <p className="text-sm text-ws-text-secondary mt-1">Local service management</p>
                </div>
                {pairingCard}
                <div className="flex items-center gap-2 text-ws-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading AutoHelper status...</span>
                </div>
            </div>
        );
    }

    const lastSeen = bridgeStatus?.lastSeen ?? null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-ws-h2 font-semibold text-ws-fg">AutoHelper</h2>
                <p className="text-sm text-ws-text-secondary mt-1">Local service management</p>
            </div>

            {pairingCard}
            <ServiceStatusCard lastSeen={lastSeen} />
            <CollectorCard />
            <MailCard />
            <RootsCard />
            <AdvancedCard />
        </div>
    );
}
