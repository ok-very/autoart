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
    mondayStatus?: IntegrationStatus;
    googleStatus?: IntegrationStatus;
    onMondayConnect?: (apiKey: string) => Promise<void>;
    onMondayDisconnect?: () => Promise<void>;
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
    onDisconnect: () => Promise<void>;
}

function MondayIntegration({ status, onConnect, onDisconnect }: MondayIntegrationProps) {
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
                <div className="space-y-3">
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
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:bg-slate-300"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Link2 className="w-4 h-4" />
                            )}
                            Connect
                        </button>
                    </div>
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
// MAIN COMPONENT
// ============================================================================

export function IntegrationsSection({
    mondayStatus = { connected: false },
    googleStatus = { connected: false },
    onMondayConnect = async () => { },
    onMondayDisconnect = async () => { },
    onGoogleConnect = () => { },
    onGoogleDisconnect = async () => { },
}: IntegrationsSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Connect external services to import data and enable sync
                </p>
            </div>

            <div className="space-y-4">
                <MondayIntegration
                    status={mondayStatus}
                    onConnect={onMondayConnect}
                    onDisconnect={onMondayDisconnect}
                />
                <GoogleIntegration
                    status={googleStatus}
                    onConnect={onGoogleConnect}
                    onDisconnect={onGoogleDisconnect}
                />
            </div>
        </div>
    );
}

export default IntegrationsSection;
