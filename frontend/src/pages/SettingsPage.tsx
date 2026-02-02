/**
 * SettingsPage
 *
 * User settings with sidebar navigation.
 * Sections:
 * - Account: User info and logout
 * - Integrations: External service connections (Monday, Google, AutoHelper)
 */

import { Settings, User, Plug, Palette, Server, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { AccountSection, AppearanceSection, AutoHelperSection, IntegrationsSection } from './settings';
import { useConnections, useConnectMonday, useDisconnectMonday, useGeneratePairingCode, useConnectGoogle, useDisconnectGoogle, useConnectMicrosoft, useDisconnectMicrosoft, useMondayOAuthStatus, useConnectMondayOAuth } from '../api/connections';
import { useCurrentUser } from '../api/hooks';

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = 'account' | 'appearance' | 'integrations' | 'autohelper';

interface NavItem {
    id: SettingsTab;
    label: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
    { id: 'autohelper', label: 'AutoHelper', icon: <Server className="w-4 h-4" /> },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function SettingsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isLoading } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');

    // Sync activeTab with location.hash (initial + subsequent navigations)
    useEffect(() => {
        const hash = location.hash.replace('#', '');
        const matched = NAV_ITEMS.find(n => n.id === hash);
        if (matched) setActiveTab(matched.id);
    }, [location.hash]);

    // Fetch connection status from backend
    const { data: connections } = useConnections();
    const connectMondayMutation = useConnectMonday();
    const disconnectMondayMutation = useDisconnectMonday();
    const generatePairingCodeMutation = useGeneratePairingCode();

    // Monday OAuth hooks
    const { data: mondayOAuthStatus } = useMondayOAuthStatus();
    const connectMondayOAuthMutation = useConnectMondayOAuth();

    // Google OAuth hooks
    const connectGoogleMutation = useConnectGoogle();
    const disconnectGoogleMutation = useDisconnectGoogle();

    // Microsoft OAuth hooks
    const connectMicrosoftMutation = useConnectMicrosoft();
    const disconnectMicrosoftMutation = useDisconnectMicrosoft();

    // Monday connection handlers
    const handleMondayConnect = useCallback(async (apiKey: string) => {
        await connectMondayMutation.mutateAsync(apiKey);
    }, [connectMondayMutation]);

    const handleMondayOAuthConnect = useCallback(async () => {
        await connectMondayOAuthMutation.mutateAsync();
    }, [connectMondayOAuthMutation]);

    const handleMondayDisconnect = useCallback(async () => {
        await disconnectMondayMutation.mutateAsync();
    }, [disconnectMondayMutation]);

    // Google connection handlers - now using real OAuth
    const handleGoogleConnect = useCallback(async () => {
        await connectGoogleMutation.mutateAsync();
    }, [connectGoogleMutation]);

    const handleGoogleDisconnect = useCallback(async () => {
        await disconnectGoogleMutation.mutateAsync();
    }, [disconnectGoogleMutation]);

    // Microsoft connection handlers - using real OAuth
    const handleMicrosoftConnect = useCallback(async () => {
        await connectMicrosoftMutation.mutateAsync();
    }, [connectMicrosoftMutation]);

    const handleMicrosoftDisconnect = useCallback(async () => {
        await disconnectMicrosoftMutation.mutateAsync();
    }, [disconnectMicrosoftMutation]);

    // AutoHelper pairing handler
    const handleAutoHelperGenerateCode = useCallback(async () => {
        const result = await generatePairingCodeMutation.mutateAsync();
        return { code: result.code, expiresAt: result.expiresAt, expiresInSeconds: result.expiresInSeconds };
    }, [generatePairingCodeMutation]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ws-bg">
                <Loader2 className="w-8 h-8 text-ws-muted animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ws-bg">
            {/* Header */}
            <header className="bg-ws-panel-bg border-b border-ws-panel-border">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--ws-accent)] rounded-lg flex items-center justify-center">
                            <Settings className="w-5 h-5 text-[var(--ws-accent-fg)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-ws-fg">Settings</h1>
                            <p className="text-sm text-ws-text-secondary">Account and preferences</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-6 py-8">
                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <nav className="w-48 flex-shrink-0">
                        <ul className="space-y-1">
                            {NAV_ITEMS.map((item) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === item.id
                                            ? 'bg-[var(--ws-accent)] text-[var(--ws-accent-fg)]'
                                            : 'text-ws-text-secondary hover:bg-[var(--ws-row-expanded-bg,rgba(63,92,110,0.04))]'
                                            }`}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {/* Back link */}
                        <div className="mt-8 pt-4 border-t border-ws-panel-border">
                            <button
                                onClick={() => navigate('/')}
                                className="text-sm text-ws-text-secondary hover:text-ws-text-secondary"
                            >
                                ← Back to Home
                            </button>
                        </div>
                    </nav>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                        {activeTab === 'account' ? (
                            <AccountSection />
                        ) : activeTab === 'appearance' ? (
                            <AppearanceSection />
                        ) : activeTab === 'autohelper' ? (
                            <AutoHelperSection
                                onGenerateCode={handleAutoHelperGenerateCode}
                                autohelperStatus={{ connected: connections?.autohelper?.connected ?? false }}
                            />
                        ) : activeTab === 'integrations' ? (
                            <IntegrationsSection
                                microsoftStatus={{ connected: connections?.microsoft?.connected ?? false }}
                                mondayStatus={{ connected: connections?.monday?.connected ?? false }}
                                googleStatus={{ connected: connections?.google?.connected ?? false }}
                                onMicrosoftConnect={handleMicrosoftConnect}
                                onMicrosoftDisconnect={handleMicrosoftDisconnect}
                                onMondayConnect={handleMondayConnect}
                                onMondayOAuthConnect={handleMondayOAuthConnect}
                                mondayOAuthAvailable={mondayOAuthStatus?.available ?? false}
                                onMondayDisconnect={handleMondayDisconnect}
                                onGoogleConnect={handleGoogleConnect}
                                onGoogleDisconnect={handleGoogleDisconnect}
                            />
                        ) : (
                            <AccountSection />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default SettingsPage;

