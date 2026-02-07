/**
 * Integrations Section
 *
 * Settings page section for managing external service connections:
 * - Monday.com API key
 * - Google Workspace OAuth
 *
 * Uses consistent card layout with status indicators and hints.
 */

import {
    Calendar,
    Key,
    Link2,
    CheckCircle2,
    XCircle,
    Loader2,
    ExternalLink,
    Eye,
    EyeOff,
    AlertCircle,
    FileText,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useUserSettings, useSetUserSetting } from '../../api/hooks';

// ============================================================================
// TYPES
// ============================================================================

interface IntegrationStatus {
    connected: boolean;
    lastSync?: string;
    accountName?: string;
}

interface IntegrationsSectionProps {
    microsoftStatus?: IntegrationStatus;
    mondayStatus?: IntegrationStatus;
    googleStatus?: IntegrationStatus;
    onMicrosoftConnect?: () => void;
    onMicrosoftDisconnect?: () => Promise<void>;
    microsoftOAuthAvailable?: boolean;
    onMondayConnect?: (apiKey: string) => Promise<void>;
    onMondayOAuthConnect?: () => Promise<void>;
    onMondayDisconnect?: () => Promise<void>;
    mondayOAuthAvailable?: boolean;
    onGoogleConnect?: () => void;
    onGoogleDisconnect?: () => Promise<void>;
    googleOAuthAvailable?: boolean;
}

// ============================================================================
// INTEGRATION CARD
// ============================================================================

interface IntegrationCardProps {
    icon: React.ReactNode;
    iconBg: string;
    name: string;
    description: string;
    hint: string;
    hintLink?: { label: string; url: string };
    status: IntegrationStatus;
    children?: React.ReactNode;
}

function IntegrationCard({
    icon,
    iconBg,
    name,
    description,
    hint,
    hintLink,
    status,
    children,
}: IntegrationCardProps) {
    return (
        <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-ws-panel-border">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-ws-fg">{name}</h3>
                            {status.connected ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 text-ws-text-secondary rounded-full">
                                    <XCircle className="w-3 h-3" />
                                    Not connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-ws-text-secondary mt-0.5">{description}</p>
                        {status.connected && status.accountName && (
                            <p className="text-xs text-ws-muted mt-1">
                                Connected as {status.accountName}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-4">
                {children}

                {/* Hint */}
                <div className="mt-3 flex items-start gap-2 text-xs text-ws-muted">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                        {hint}
                        {hintLink && (
                            <>
                                {' '}
                                <a
                                    href={hintLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-0.5"
                                >
                                    {hintLink.label}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MONDAY INTEGRATION
// ============================================================================

interface MondayIntegrationProps {
    status: IntegrationStatus;
    onConnect: (apiKey: string) => Promise<void>;
    onOAuthConnect?: () => Promise<void>;
    oauthAvailable?: boolean;
    onDisconnect: () => Promise<void>;
}

function MondayIntegration({ status, onConnect, onOAuthConnect, oauthAvailable, onDisconnect }: MondayIntegrationProps) {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [showManualInput, setShowManualInput] = useState(!oauthAvailable);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = useCallback(async () => {
        if (!apiKey.trim()) {
            setError('Please enter your API key');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await onConnect(apiKey);
            setApiKey('');
        } catch (err) {
            setError((err as Error).message || 'Failed to connect');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, onConnect]);

    const handleOAuthConnect = useCallback(async () => {
        if (!onOAuthConnect) return;

        setIsLoading(true);
        setError(null);

        try {
            await onOAuthConnect();
        } catch (err) {
            setError((err as Error).message || 'Failed to connect');
        } finally {
            setIsLoading(false);
        }
    }, [onOAuthConnect]);

    const handleDisconnect = useCallback(async () => {
        setIsLoading(true);
        try {
            await onDisconnect();
        } finally {
            setIsLoading(false);
        }
    }, [onDisconnect]);

    return (
        <IntegrationCard
            icon={<Calendar className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
            name="Monday.com"
            description="Import boards, items, and sync project data"
            hint="Get your API key from Monday.com → Admin → API"
            hintLink={{ label: 'Developer docs', url: 'https://developer.monday.com/api-reference' }}
            status={status}
        >
            {status.connected ? (
                <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    Disconnect
                </button>
            ) : (
                <div className="space-y-4">
                    {/* OAuth Button (Primary if available) */}
                    {oauthAvailable && (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleOAuthConnect}
                                disabled={isLoading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:bg-slate-300 w-full md:w-auto"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Link2 className="w-4 h-4" />
                                )}
                                Connect with Monday
                            </button>

                            {!showManualInput && (
                                <button
                                    onClick={() => setShowManualInput(true)}
                                    className="text-xs text-ws-text-secondary hover:text-ws-text-secondary hover:underline self-start"
                                >
                                    Or enter API key manually
                                </button>
                            )}
                        </div>
                    )}

                    {/* Manual API Key Input */}
                    {showManualInput && (
                        <div className="space-y-3 pt-2 border-t border-ws-panel-border">
                            {oauthAvailable && (
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-semibold text-ws-text-secondary uppercase tracking-wider">Manual Connection</span>
                                    <button
                                        onClick={() => setShowManualInput(false)}
                                        className="text-xs text-ws-muted hover:text-ws-text-secondary"
                                    >
                                        Hide
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ws-muted" />
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your API key"
                                        className="w-full pl-10 pr-10 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ws-muted hover:text-ws-text-secondary"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button
                                    onClick={handleConnect}
                                    disabled={isLoading || !apiKey.trim()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ws-text-secondary bg-ws-panel-bg border border-ws-panel-border hover:bg-ws-bg rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Key className="w-4 h-4" />
                                    )}
                                    Save Key
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>
            )}
        </IntegrationCard>
    );
}

// ============================================================================
// GOOGLE INTEGRATION
// ============================================================================

interface GoogleIntegrationProps {
    status: IntegrationStatus;
    onConnect: () => void;
    onDisconnect: () => Promise<void>;
    oauthAvailable?: boolean;
}

function GoogleIntegration({ status, onConnect, onDisconnect, oauthAvailable = true }: GoogleIntegrationProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleDisconnect = useCallback(async () => {
        setIsLoading(true);
        try {
            await onDisconnect();
        } finally {
            setIsLoading(false);
        }
    }, [onDisconnect]);

    return (
        <IntegrationCard
            icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
            }
            iconBg="bg-slate-100"
            name="Google Workspace"
            description="Sync Calendar events, Drive files, and Contacts"
            hint="Enables automatic event sync and file attachments"
            status={status}
        >
            {status.connected ? (
                <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    Disconnect
                </button>
            ) : (
                <div className="space-y-2">
                    <button
                        onClick={onConnect}
                        disabled={!oauthAvailable}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ws-text-secondary bg-ws-panel-bg border border-ws-panel-border hover:bg-ws-bg rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Connect with Google
                    </button>
                    {!oauthAvailable && (
                        <p className="text-xs text-ws-muted">Not configured on server</p>
                    )}
                </div>
            )}
        </IntegrationCard>
    );
}

// ============================================================================
// MICROSOFT INTEGRATION
// ============================================================================

interface MicrosoftIntegrationProps {
    status: IntegrationStatus;
    onConnect: () => void;
    onDisconnect: () => Promise<void>;
    oauthAvailable?: boolean;
}

function MicrosoftIntegration({ status, onConnect, onDisconnect, oauthAvailable = true }: MicrosoftIntegrationProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleDisconnect = useCallback(async () => {
        setIsLoading(true);
        try {
            await onDisconnect();
        } finally {
            setIsLoading(false);
        }
    }, [onDisconnect]);

    return (
        <IntegrationCard
            icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                </svg>
            }
            iconBg="bg-slate-100"
            name="Microsoft 365"
            description="Sync Outlook Calendar, OneDrive files, and Teams"
            hint="Enables calendar sync and OneDrive file attachments"
            status={status}
        >
            {status.connected ? (
                <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    Disconnect
                </button>
            ) : (
                <div className="space-y-2">
                    <button
                        onClick={onConnect}
                        disabled={!oauthAvailable}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ws-text-secondary bg-ws-panel-bg border border-ws-panel-border hover:bg-ws-bg rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                            <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                            <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                            <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                        </svg>
                        Connect with Microsoft
                    </button>
                    {!oauthAvailable && (
                        <p className="text-xs text-ws-muted">Not configured on server</p>
                    )}
                </div>
            )}
        </IntegrationCard>
    );
}

// ============================================================================
// SHAREPOINT REQUEST URL SETTING
// ============================================================================

function SharePointRequestUrlSetting() {
    const { data: settings } = useUserSettings();
    const setSetting = useSetUserSetting();
    const [url, setUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const savedUrl = (settings?.sharepoint_request_url as string) || '';

    useEffect(() => {
        if (!isEditing) {
            setUrl(savedUrl);
        }
    }, [savedUrl, isEditing]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            await setSetting.mutateAsync({
                key: 'sharepoint_request_url',
                value: url.trim() || null,
            });
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    }, [url, setSetting]);

    return (
        <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden">
            <div className="p-4 border-b border-ws-panel-border">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ws-fg">SharePoint Request Files URL</h3>
                        <p className="text-sm text-ws-text-secondary mt-0.5">
                            Default URL shown on public intake forms for file requests
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {isEditing ? (
                    <div className="space-y-3">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://yourcompany.sharepoint.com/..."
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:bg-slate-300"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setUrl(savedUrl);
                                    setIsEditing(false);
                                }}
                                className="px-4 py-2 text-sm font-medium text-ws-text-secondary hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            {savedUrl ? (
                                <code className="text-sm text-ws-text-secondary bg-ws-bg px-2 py-1 rounded truncate block">
                                    {savedUrl}
                                </code>
                            ) : (
                                <span className="text-sm text-ws-muted italic">Not configured</span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 text-sm font-medium text-ws-text-secondary hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {savedUrl ? 'Edit' : 'Configure'}
                        </button>
                    </div>
                )}

                <div className="mt-3 flex items-start gap-2 text-xs text-ws-muted">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                        This URL will be used as the default SharePoint request link for new intake forms.
                        You can override it per-form.
                    </span>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IntegrationsSection({
    microsoftStatus = { connected: false },
    mondayStatus = { connected: false },
    googleStatus = { connected: false },
    onMicrosoftConnect = () => { },
    onMicrosoftDisconnect = async () => { },
    microsoftOAuthAvailable = true,
    onMondayConnect = async () => { },
    onMondayOAuthConnect = async () => { },
    mondayOAuthAvailable = true,
    onMondayDisconnect = async () => { },
    onGoogleConnect = () => { },
    onGoogleDisconnect = async () => { },
    googleOAuthAvailable = true,
}: IntegrationsSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-ws-h2 font-semibold text-ws-fg">Integrations</h2>
                <p className="text-sm text-ws-text-secondary mt-1">
                    Connect external services to import data and enable sync
                </p>
            </div>

            <div className="space-y-4">
                <MicrosoftIntegration
                    status={microsoftStatus}
                    onConnect={onMicrosoftConnect}
                    onDisconnect={onMicrosoftDisconnect}
                    oauthAvailable={microsoftOAuthAvailable}
                />
                <SharePointRequestUrlSetting />
                <GoogleIntegration
                    status={googleStatus}
                    onConnect={onGoogleConnect}
                    onDisconnect={onGoogleDisconnect}
                    oauthAvailable={googleOAuthAvailable}
                />
                <MondayIntegration
                    status={mondayStatus}
                    onConnect={onMondayConnect}
                    onOAuthConnect={onMondayOAuthConnect}
                    oauthAvailable={mondayOAuthAvailable}
                    onDisconnect={onMondayDisconnect}
                />
            </div>
        </div>
    );
}

export default IntegrationsSection;

