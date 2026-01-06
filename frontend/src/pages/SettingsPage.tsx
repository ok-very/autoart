/**
 * SettingsPage
 *
 * User settings and account management.
 * Features:
 * - Display current user info
 * - Logout functionality
 */

import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, User, Mail, Calendar, Loader2 } from 'lucide-react';
import { useCurrentUser, useLogout } from '../api/hooks';

export function SettingsPage() {
    const navigate = useNavigate();
    const { data: user, isLoading } = useCurrentUser();
    const logoutMutation = useLogout();

    const handleLogout = async () => {
        await logoutMutation.mutateAsync();
        navigate('/login');
    };

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
                <div className="max-w-3xl mx-auto px-6 py-4">
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
            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* Account Section */}
                <section className="mb-8">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Account
                    </h2>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {/* User Info */}
                        <div className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium text-slate-900">{user?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span>{user?.email || 'No email'}</span>
                                    </div>
                                    {user?.created_at && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Actions Section */}
                <section>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Actions
                    </h2>
                    <div className="bg-white rounded-xl border border-slate-200">
                        <button
                            onClick={handleLogout}
                            disabled={logoutMutation.isPending}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-50 transition-colors rounded-xl disabled:opacity-50"
                        >
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                <LogOut className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <span className="font-medium text-red-700">Log out</span>
                                <p className="text-sm text-red-600/70">Sign out of your account</p>
                            </div>
                            {logoutMutation.isPending && (
                                <Loader2 className="w-5 h-5 text-red-500 animate-spin ml-auto" />
                            )}
                        </button>
                    </div>
                </section>

                {/* Back link */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm text-slate-500 hover:text-slate-700"
                    >
                        ← Back to Home
                    </button>
                </div>
            </main>
        </div>
    );
}
