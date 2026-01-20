/**
 * Account Section
 *
 * Settings page section for user account management:
 * - User info display + Edit
 * - Logout button
 * - Sign out everywhere
 */

import { LogOut, User, Mail, Calendar, Loader2, Pencil, Check, X, Shield } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCurrentUser, useLogout, useUpdateProfile, useLogoutEverywhere } from '../../api/hooks';

export function AccountSection() {
    const navigate = useNavigate();
    const { data: user, refetch } = useCurrentUser();
    const logoutMutation = useLogout();
    const logoutEverywhereMutation = useLogoutEverywhere();
    const updateProfileMutation = useUpdateProfile();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(user?.name || '');

    const handleLogout = async () => {
        await logoutMutation.mutateAsync();
        navigate('/login');
    };

    const handleLogoutEverywhere = async () => {
        await logoutEverywhereMutation.mutateAsync();
        navigate('/login');
    };

    const handleStartEditName = useCallback(() => {
        setEditedName(user?.name || '');
        setIsEditingName(true);
    }, [user?.name]);

    const handleCancelEditName = useCallback(() => {
        setIsEditingName(false);
        setEditedName(user?.name || '');
    }, [user?.name]);

    const handleSaveName = useCallback(async () => {
        if (!editedName.trim()) return;
        await updateProfileMutation.mutateAsync({ name: editedName.trim() });
        setIsEditingName(false);
        refetch();
    }, [editedName, updateProfileMutation, refetch]);

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
                        {/* Name - Editable */}
                        <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-slate-400" />
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editedName}
                                        onChange={(e) => setEditedName(e.target.value)}
                                        className="px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveName();
                                            if (e.key === 'Escape') handleCancelEditName();
                                        }}
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        disabled={updateProfileMutation.isPending}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    >
                                        {updateProfileMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={handleCancelEditName}
                                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="font-medium text-slate-900">{user?.name || 'Unknown'}</span>
                                    <button
                                        onClick={handleStartEditName}
                                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                        title="Edit name"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
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

            {/* Security Section */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {/* Sign Out Everywhere */}
                <button
                    onClick={handleLogoutEverywhere}
                    disabled={logoutEverywhereMutation.isPending}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <span className="font-medium text-amber-700">Sign out everywhere</span>
                        <p className="text-sm text-amber-600/70">Revoke all active sessions on other devices</p>
                    </div>
                    {logoutEverywhereMutation.isPending && (
                        <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    )}
                </button>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-50 transition-colors disabled:opacity-50"
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
