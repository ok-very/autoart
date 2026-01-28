/**
 * SettingsPage
 *
 * User settings with sidebar navigation.
 * Sections:
 * - Account: User info and logout
 * - Integrations: External service connections (Monday, Google, AutoHelper)
 */

import { Settings, User, Plug, Palette, Clock, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { AccountSection, AppearanceSection, DateTimeSection, IntegrationsSection } from './settings';
import { useConnections, useConnectMonday, useDisconnectMonday, useGeneratePairingCode, useConnectGoogle, useDisconnectGoogle, useConnectMicrosoft, useDisconnectMicrosoft, useMondayOAuthStatus, useConnectMondayOAuth } from '../api/connections';
import { useCurrentUser } from '../api/hooks';

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = 'account' | 'appearance' | 'datetime' | 'integrations';

interface NavItem {
    id: SettingsTab;
    label: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'datetime', label: 'Date & Time', icon: <Clock className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function SettingsPage() {
    const navigate = useNavigate();
    const { isLoading } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');

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
        return { code: result.code, expiresAt: result.expiresAt };
    }, [generatePairingCodeMutation]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
                            <p className="text-sm text-slate-500">Account and preferences</p>
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
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {/* Back link */}
                        <div className="mt-8 pt-4 border-t border-slate-200">
                            <button
                                onClick={() => navigate('/')}
                                className="text-sm text-slate-500 hover:text-slate-700"
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
                        ) : activeTab === 'datetime' ? (
                            <DateTimeSection />
                        ) : activeTab === 'integrations' ? (
                            <IntegrationsSection
                                microsoftStatus={{ connected: (connections as any)?.microsoft?.connected ?? false }}
                                mondayStatus={{ connected: connections?.monday?.connected ?? false }}
                                googleStatus={{ connected: connections?.google?.connected ?? false }}
                                autohelperStatus={{ connected: (connections as any)?.autohelper?.connected ?? false }}
                                onMicrosoftConnect={handleMicrosoftConnect}
                                onMicrosoftDisconnect={handleMicrosoftDisconnect}
                                onMondayConnect={handleMondayConnect}
                                onMondayOAuthConnect={handleMondayOAuthConnect}
                                mondayOAuthAvailable={mondayOAuthStatus?.available ?? false}
                                onMondayDisconnect={handleMondayDisconnect}
                                onGoogleConnect={handleGoogleConnect}
                                onGoogleDisconnect={handleGoogleDisconnect}
                                onAutoHelperGenerateCode={handleAutoHelperGenerateCode}
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

