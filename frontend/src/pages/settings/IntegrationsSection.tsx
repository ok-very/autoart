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
} from 'lucide-react';
import { useState, useCallback } from 'react';

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
    onMondayConnect?: (apiKey: string) => Promise<void>;
    onMondayOAuthConnect?: () => Promise<void>;
    onMondayDisconnect?: () => Promise<void>;
    mondayOAuthAvailable?: boolean;
    onGoogleConnect?: () => void;
    onGoogleDisconnect?: () => Promise<void>;
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{name}</h3>
                            {status.connected ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                                    <XCircle className="w-3 h-3" />
                                    Not connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
                        {status.connected && status.accountName && (
                            <p className="text-xs text-slate-400 mt-1">
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
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-400">
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
                                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline self-start"
                                >
                                    Or enter API key manually
                                </button>
                            )}
                        </div>
                    )}

                    {/* Manual API Key Input */}
                    {showManualInput && (
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                            {oauthAvailable && (
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Manual Connection</span>
                                    <button
                                        onClick={() => setShowManualInput(false)}
                                        className="text-xs text-slate-400 hover:text-slate-600"
                                    >
                                        Hide
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your API key"
                                        className="w-full pl-10 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button
                                    onClick={handleConnect}
                                    disabled={isLoading || !apiKey.trim()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
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
}

function GoogleIntegration({ status, onConnect, onDisconnect }: GoogleIntegrationProps) {
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
                <button
                    onClick={onConnect}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Connect with Google
                </button>
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
}

function MicrosoftIntegration({ status, onConnect, onDisconnect }: MicrosoftIntegrationProps) {
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
                <button
                    onClick={onConnect}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                    </svg>
                    Connect with Microsoft
                </button>
            )}
        </IntegrationCard>
    );
}

// ============================================================================
// AUTOHELPER INTEGRATION
// ============================================================================

interface AutoHelperIntegrationProps {
    status: IntegrationStatus;
    onGenerateCode: () => Promise<{ code: string; expiresAt: string }>;
}

function AutoHelperIntegration({ status, onGenerateCode }: AutoHelperIntegrationProps) {
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Extract a user-friendly error message from various error types.
     * Handles Axios-style errors, standard Errors, and unknown types.
     */
    const getErrorMessage = (err: unknown): string => {
        if (!err) return 'Failed to generate code';

        // Handle Axios-style API errors
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

        // Handle standard Error objects
        if (err instanceof Error && err.message) {
            return err.message;
        }

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
        <IntegrationCard
            icon={<Link2 className="w-5 h-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
            name="AutoHelper"
            description="Local assistant for file indexing, document production, and Outlook mail"
            hint="Generate a code in AutoArt, then enter it in AutoHelper to connect"
            status={status}
        >
            {status.connected ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    AutoHelper is connected
                </div>
            ) : (
                <div className="space-y-3">
                    {pairingCode ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                            <p className="text-xs text-slate-500 mb-2">Enter this code in AutoHelper:</p>
                            <div className="font-mono text-3xl font-bold text-slate-900 tracking-widest">
                                {pairingCode}
                            </div>
                            {expiresAt && (
                                <p className="text-xs text-slate-400 mt-2">
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
        </IntegrationCard>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ExtendedIntegrationsSectionProps extends IntegrationsSectionProps {
    autohelperStatus?: IntegrationStatus;
    onAutoHelperGenerateCode?: () => Promise<{ code: string; expiresAt: string }>;
}

export function IntegrationsSection({
    microsoftStatus = { connected: false },
    mondayStatus = { connected: false },
    googleStatus = { connected: false },
    autohelperStatus = { connected: false },
    onMicrosoftConnect = () => { },
    onMicrosoftDisconnect = async () => { },
    onMondayConnect = async () => { },
    onMondayOAuthConnect = async () => { },
    mondayOAuthAvailable = false,
    onMondayDisconnect = async () => { },
    onGoogleConnect = () => { },
    onGoogleDisconnect = async () => { },
    onAutoHelperGenerateCode = async () => ({ code: '', expiresAt: '' }),
}: ExtendedIntegrationsSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Connect external services to import data and enable sync
                </p>
            </div>

            <div className="space-y-4">
                <MicrosoftIntegration
                    status={microsoftStatus}
                    onConnect={onMicrosoftConnect}
                    onDisconnect={onMicrosoftDisconnect}
                />
                <GoogleIntegration
                    status={googleStatus}
                    onConnect={onGoogleConnect}
                    onDisconnect={onGoogleDisconnect}
                />
                <MondayIntegration
                    status={mondayStatus}
                    onConnect={onMondayConnect}
                    onOAuthConnect={onMondayOAuthConnect}
                    oauthAvailable={mondayOAuthAvailable}
                    onDisconnect={onMondayDisconnect}
                />
                <AutoHelperIntegration
                    status={autohelperStatus}
                    onGenerateCode={onAutoHelperGenerateCode}
                />
            </div>
        </div>
    );
}

export default IntegrationsSection;

