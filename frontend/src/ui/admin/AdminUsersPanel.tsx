/**
 * Admin Users Panel
 *
 * Lists all users with create, role editing, reset password, and soft delete.
 */

import { Trash2, Users, Loader2, AlertTriangle, CheckCircle2, XCircle, UserPlus, KeyRound } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

import {
    useAdminUsers,
    useSoftDeleteUser,
    useCreateUser,
    useUpdateUser,
    useResetUserPassword,
    useSearchUsers,
    type AdminUser,
} from '../../api/hooks';
import { useDebounce } from '../../hooks/useDebounce';
import { Badge } from '@autoart/ui';

const ROLE_OPTIONS = ['user', 'admin', 'viewer'] as const;

// ============================================================================
// CREATE USER FORM
// ============================================================================

function CreateUserForm({ onClose }: { onClose: () => void }) {
    const createMutation = useCreateUser();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('user');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = useCallback(async () => {
        if (createMutation.isPending) return; // Prevent duplicate submissions
        setError('');
        const trimmedEmail = email.trim();
        const trimmedName = name.trim();
        if (!trimmedEmail || !trimmedName || !password) {
            setError('All fields are required');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError('Invalid email address');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        try {
            await createMutation.mutateAsync({ email: trimmedEmail, name: trimmedName, role, password });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create user');
        }
    }, [email, name, role, password, createMutation, onClose]);

    return (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
                <input
                    type="password"
                    placeholder="Temporary password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors"
                >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create user'}
                </button>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ============================================================================
// REASSIGN PICKER (inline user search for deactivation)
// ============================================================================

function ReassignPicker({
    users,
    value,
    onChange,
}: {
    users: AdminUser[];
    value: string | null;
    onChange: (userId: string | null) => void;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const debouncedQuery = useDebounce(query, 150);
    const containerRef = useRef<HTMLDivElement>(null);

    // Also search backend for users not in the admin list
    const { data: searchResults = [] } = useSearchUsers(debouncedQuery, open && debouncedQuery.length >= 1);

    // Merge admin list with search results, deduplicate
    const candidates = debouncedQuery.length >= 1
        ? (() => {
            const ids = new Set<string>();
            const merged: { id: string; name: string; email: string; avatar_url: string | null }[] = [];
            // Prioritize admin list (already loaded)
            for (const u of users) {
                if (u.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(debouncedQuery.toLowerCase())) {
                    ids.add(u.id);
                    merged.push(u);
                }
            }
            for (const u of searchResults) {
                if (!ids.has(u.id)) {
                    merged.push({ id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url ?? null });
                }
            }
            return merged.slice(0, 8);
        })()
        : users.slice(0, 8);

    const selected = value ? users.find(u => u.id === value) ?? null : null;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open]);

    if (selected && !open) {
        return (
            <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-700">{selected.name}</span>
                <button
                    onClick={() => { onChange(null); setQuery(''); }}
                    className="text-slate-400 hover:text-slate-600"
                >
                    <XCircle className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="(optional)"
                className="px-2 py-0.5 text-xs border border-slate-300 rounded w-36 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            {open && candidates.length > 0 && (
                <div className="absolute z-50 w-56 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-auto">
                    {candidates.map((u) => (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => { onChange(u.id); setOpen(false); setQuery(''); }}
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2"
                        >
                            {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-slate-800 truncate">{u.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AdminUsersPanel() {
    const { data: users, isLoading, error } = useAdminUsers();
    const softDeleteMutation = useSoftDeleteUser();
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    const [reassignTo, setReassignTo] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleDelete = useCallback(async (userId: string) => {
        try {
            await softDeleteMutation.mutateAsync({ userId, reassignTo: reassignTo ?? undefined });
            setConfirmingDelete(null);
            setReassignTo(null);
        } catch (err) {
            console.error('Failed to delete user:', err);
        }
    }, [softDeleteMutation, reassignTo]);

    const cancelDelete = useCallback(() => {
        setConfirmingDelete(null);
        setReassignTo(null);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-8 text-red-500">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Failed to load users
            </div>
        );
    }

    const activeUsers = users?.filter(u => !u.deleted_at) ?? [];
    const deletedUsers = users?.filter(u => u.deleted_at) ?? [];

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50">
                <Users className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-800">User Management</h2>
                <span className="text-sm text-slate-500">
                    {activeUsers.length} active, {deletedUsers.length} deleted
                </span>
                <div className="flex-1" />
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Add user
                </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <CreateUserForm onClose={() => setShowCreateForm(false)} />
            )}

            {/* Active Users */}
            <div className="divide-y divide-slate-100">
                {activeUsers.map((user) => (
                    <UserRow
                        key={user.id}
                        user={user}
                        allUsers={activeUsers}
                        isConfirmingDelete={confirmingDelete === user.id}
                        isDeleting={softDeleteMutation.isPending && softDeleteMutation.variables?.userId === user.id}
                        reassignTo={reassignTo}
                        onReassignToChange={setReassignTo}
                        onDeleteClick={() => setConfirmingDelete(user.id)}
                        onConfirmDelete={() => handleDelete(user.id)}
                        onCancelDelete={cancelDelete}
                    />
                ))}
            </div>

            {/* Deleted Users Section */}
            {deletedUsers.length > 0 && (
                <>
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                        <span className="text-sm font-medium text-slate-500">
                            Deleted Users ({deletedUsers.length})
                        </span>
                    </div>
                    <div className="divide-y divide-slate-100 opacity-60">
                        {deletedUsers.map((user) => (
                            <UserRow
                                key={user.id}
                                user={user}
                                isDeleted
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Empty state */}
            {users?.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                    No users found
                </div>
            )}
        </div>
    );
}

// ============================================================================
// USER ROW
// ============================================================================

interface UserRowProps {
    user: AdminUser;
    allUsers?: AdminUser[];
    isDeleted?: boolean;
    isConfirmingDelete?: boolean;
    isDeleting?: boolean;
    reassignTo?: string | null;
    onReassignToChange?: (userId: string | null) => void;
    onDeleteClick?: () => void;
    onConfirmDelete?: () => void;
    onCancelDelete?: () => void;
}

function UserRow({
    user,
    allUsers = [],
    isDeleted = false,
    isConfirmingDelete = false,
    isDeleting = false,
    reassignTo,
    onReassignToChange,
    onDeleteClick,
    onConfirmDelete,
    onCancelDelete,
}: UserRowProps) {
    const updateMutation = useUpdateUser();
    const resetPasswordMutation = useResetUserPassword();
    const [editingRole, setEditingRole] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetPw, setResetPw] = useState('');
    const [resetError, setResetError] = useState('');

    const handleRoleChange = useCallback(async (newRole: string) => {
        try {
            await updateMutation.mutateAsync({ userId: user.id, role: newRole });
            setEditingRole(false);
        } catch {
            // Reopen edit UI if onBlur closed it, so user can retry
            setEditingRole(true);
        }
    }, [user.id, updateMutation]);

    const handleResetPassword = useCallback(async () => {
        setResetError('');
        if (resetPw.length < 6) {
            setResetError('Min 6 characters');
            return;
        }
        try {
            await resetPasswordMutation.mutateAsync({ userId: user.id, password: resetPw });
            setShowResetPassword(false);
            setResetPw('');
        } catch (err) {
            setResetError(err instanceof Error ? err.message : 'Failed');
        }
    }, [user.id, resetPw, resetPasswordMutation]);

    const roleBadgeVariant = user.role === 'admin' ? 'info' : user.role === 'viewer' ? 'warning' : 'neutral';

    return (
        <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Avatar thumbnail */}
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{user.name}</span>
                        {isDeleted ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                                Deleted
                            </span>
                        ) : editingRole ? (
                            <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(e.target.value)}
                                onBlur={() => setEditingRole(false)}
                                autoFocus
                                className="text-xs px-1.5 py-0.5 border border-slate-300 rounded focus:outline-none"
                            >
                                {ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        ) : (
                            <button onClick={() => !isDeleted && setEditingRole(true)} title="Click to change role">
                                <Badge variant={roleBadgeVariant} size="xs">{user.role}</Badge>
                            </button>
                        )}
                    </div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                        {user.deleted_at && (
                            <> · Deleted {new Date(user.deleted_at).toLocaleDateString()}</>
                        )}
                    </div>

                    {/* Inline reset password */}
                    {showResetPassword && (
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="password"
                                placeholder="New password"
                                value={resetPw}
                                onChange={(e) => setResetPw(e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                                autoFocus
                            />
                            <button
                                onClick={handleResetPassword}
                                disabled={resetPasswordMutation.isPending}
                                className="px-2 py-1 text-xs text-white bg-slate-600 hover:bg-slate-700 rounded transition-colors"
                            >
                                {resetPasswordMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reset'}
                            </button>
                            <button
                                onClick={() => { setShowResetPassword(false); setResetPw(''); setResetError(''); }}
                                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                            >
                                Cancel
                            </button>
                            {resetError && <span className="text-xs text-red-500">{resetError}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {!isDeleted && (
                <div className="flex items-center gap-1 ml-4">
                    {isConfirmingDelete ? (
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1.5 mr-2">
                                <span className="text-sm text-red-600">Deactivate user?</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-500">Reassign to:</span>
                                    <ReassignPicker
                                        users={allUsers.filter(u => u.id !== user.id)}
                                        value={reassignTo ?? null}
                                        onChange={onReassignToChange ?? (() => {})}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={onConfirmDelete}
                                disabled={isDeleting}
                                className="p-2 text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors"
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                            </button>
                            <button
                                onClick={onCancelDelete}
                                disabled={isDeleting}
                                className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowResetPassword(!showResetPassword)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Reset password"
                            >
                                <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onDeleteClick}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete user"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminUsersPanel;
