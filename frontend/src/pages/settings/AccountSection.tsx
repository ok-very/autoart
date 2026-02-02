/**
 * Account Section
 *
 * Settings page section for user account management:
 * - Avatar upload with preview and delete
 * - User info display + edit
 * - Password change
 * - Role badge
 * - Logout / Sign out everywhere
 */

import { LogOut, User, Mail, Calendar, Loader2, Pencil, Check, X, Shield, Lock, Camera, Trash2 } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
    useCurrentUser,
    useLogout,
    useUpdateProfile,
    useLogoutEverywhere,
    useChangePassword,
    useUploadAvatar,
    useDeleteAvatar,
} from '../../api/hooks';
import { Badge } from '@autoart/ui';

export function AccountSection() {
    const navigate = useNavigate();
    const { data: user, refetch } = useCurrentUser();
    const logoutMutation = useLogout();
    const logoutEverywhereMutation = useLogoutEverywhere();
    const updateProfileMutation = useUpdateProfile();
    const changePasswordMutation = useChangePassword();
    const uploadAvatarMutation = useUploadAvatar();
    const deleteAvatarMutation = useDeleteAvatar();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(user?.name || '');

    // Password change state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

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

    // Avatar handlers
    const handleAvatarClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadAvatarMutation.mutateAsync(file);
        refetch();
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [uploadAvatarMutation, refetch]);

    const handleDeleteAvatar = useCallback(async () => {
        await deleteAvatarMutation.mutateAsync();
        refetch();
    }, [deleteAvatarMutation, refetch]);

    // Password change handler
    const handleChangePassword = useCallback(async () => {
        setPasswordError('');
        setPasswordSuccess(false);

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        try {
            await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess(false);
            }, 2000);
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
        }
    }, [currentPassword, newPassword, confirmPassword, changePasswordMutation]);

    const roleBadgeVariant = user?.role === 'admin' ? 'info' : user?.role === 'viewer' ? 'warning' : 'neutral';

    const avatarUploading = uploadAvatarMutation.isPending || deleteAvatarMutation.isPending;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-ws-h2 font-semibold text-ws-fg">Account</h2>
                <p className="text-sm text-ws-text-secondary mt-1">
                    Your profile and account settings
                </p>
            </div>

            {/* User Info Card */}
            <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border p-4">
                <div className="flex items-center gap-4">
                    {/* Avatar with upload */}
                    <div className="relative group">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {user?.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.name}
                                className="w-14 h-14 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        {/* Overlay buttons */}
                        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {avatarUploading ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                            ) : (
                                <>
                                    <button
                                        onClick={handleAvatarClick}
                                        className="p-1 text-white hover:text-white/80"
                                        title="Upload photo"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    {user?.avatar_url && (
                                        <button
                                            onClick={handleDeleteAvatar}
                                            className="p-1 text-white hover:text-red-300"
                                            title="Remove photo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        {/* Name + Role */}
                        <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-ws-muted" />
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
                                        className="p-1 text-ws-muted hover:bg-slate-100 rounded"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="font-medium text-ws-fg">{user?.name || 'Unknown'}</span>
                                    <button
                                        onClick={handleStartEditName}
                                        className="p-1 text-ws-muted hover:text-ws-text-secondary hover:bg-slate-100 rounded"
                                        title="Edit name"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {user?.role && (
                                        <Badge variant={roleBadgeVariant} size="xs">{user.role}</Badge>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-ws-text-secondary">
                            <Mail className="w-4 h-4 text-ws-muted" />
                            <span>{user?.email || 'No email'}</span>
                        </div>
                        {user?.created_at && (
                            <div className="flex items-center gap-2 text-xs text-ws-muted mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Password Change */}
            <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border divide-y divide-slate-100">
                <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Lock className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                        <span className="font-medium text-ws-fg">Change password</span>
                        <p className="text-sm text-ws-text-secondary">Update your account password</p>
                    </div>
                </button>

                {showPasswordForm && (
                    <div className="p-4 space-y-3">
                        <input
                            type="password"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
                        />
                        {passwordError && (
                            <p className="text-sm text-red-600">{passwordError}</p>
                        )}
                        {passwordSuccess && (
                            <p className="text-sm text-green-600">Password changed</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleChangePassword}
                                disabled={changePasswordMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors"
                            >
                                {changePasswordMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Update password'
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowPasswordForm(false);
                                    setPasswordError('');
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                className="px-4 py-2 text-sm text-ws-text-secondary hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Section */}
            <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border divide-y divide-slate-100">
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
