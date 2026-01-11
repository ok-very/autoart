/**
 * Admin Users Panel
 *
 * Lists all users with soft delete functionality.
 */

import { Trash2, Users, Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useCallback } from 'react';

import { useAdminUsers, useSoftDeleteUser, type AdminUser } from '../../api/hooks';

// ============================================================================
// COMPONENT
// ============================================================================

export function AdminUsersPanel() {
    const { data: users, isLoading, error } = useAdminUsers();
    const softDeleteMutation = useSoftDeleteUser();
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

    const handleDelete = useCallback(async (userId: string) => {
        try {
            await softDeleteMutation.mutateAsync(userId);
            setConfirmingDelete(null);
        } catch (err) {
            console.error('Failed to delete user:', err);
        }
    }, [softDeleteMutation]);

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
            </div>

            {/* Active Users */}
            <div className="divide-y divide-slate-100">
                {activeUsers.map((user) => (
                    <UserRow
                        key={user.id}
                        user={user}
                        isConfirmingDelete={confirmingDelete === user.id}
                        isDeleting={softDeleteMutation.isPending && softDeleteMutation.variables === user.id}
                        onDeleteClick={() => setConfirmingDelete(user.id)}
                        onConfirmDelete={() => handleDelete(user.id)}
                        onCancelDelete={() => setConfirmingDelete(null)}
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
    isDeleted?: boolean;
    isConfirmingDelete?: boolean;
    isDeleting?: boolean;
    onDeleteClick?: () => void;
    onConfirmDelete?: () => void;
    onCancelDelete?: () => void;
}

function UserRow({
    user,
    isDeleted = false,
    isConfirmingDelete = false,
    isDeleting = false,
    onDeleteClick,
    onConfirmDelete,
    onCancelDelete,
}: UserRowProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{user.name}</span>
                    {isDeleted && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                            Deleted
                        </span>
                    )}
                </div>
                <div className="text-sm text-slate-500">{user.email}</div>
                <div className="text-xs text-slate-400 mt-1">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                    {user.deleted_at && (
                        <> · Deleted {new Date(user.deleted_at).toLocaleDateString()}</>
                    )}
                </div>
            </div>

            {/* Actions */}
            {!isDeleted && (
                <div className="flex items-center gap-2 ml-4">
                    {isConfirmingDelete ? (
                        <>
                            <span className="text-sm text-red-600 mr-2">Delete user?</span>
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
                        </>
                    ) : (
                        <button
                            onClick={onDeleteClick}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete user"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminUsersPanel;
