/**
 * Account Section
 *
 * Settings page section for user account management:
 * - User info display
 * - Logout button
 */

import { LogOut, User, Mail, Calendar, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useCurrentUser, useLogout } from '../../api/hooks';

export function AccountSection() {
    const navigate = useNavigate();
    const { data: user } = useCurrentUser();
    const logoutMutation = useLogout();

    const handleLogout = async () => {
        await logoutMutation.mutateAsync();
        navigate('/login');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Account</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Your profile and account settings
                </p>
            </div>

            {/* User Info Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
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

            {/* Logout Button */}
            <div className="bg-white rounded-xl border border-slate-200">
                <button
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-50 transition-colors rounded-xl disabled:opacity-50"
                >
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <LogOut className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <span className="font-medium text-red-700">Log out</span>
                        <p className="text-sm text-red-600/70">Sign out of your account</p>
                    </div>
                    {logoutMutation.isPending && (
                        <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                    )}
                </button>
            </div>
        </div>
    );
}

export default AccountSection;
