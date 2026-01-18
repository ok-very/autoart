import { clsx } from 'clsx';
import { User, Link2, Type, ExternalLink, AtSign } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

import { PortalMenu } from './PortalMenu';

interface UserValue {
    id?: string;
    name?: string;
    email?: string;
}

interface UserChipProps {
    value: unknown;
    className?: string;
    /** Optional callback to convert to plain text */
    onUnlink?: (text: string) => void;
    /** Optional callback to open user details/drawer */
    onInspect?: (userId: string) => void;
    /** Whether the chip is in a compact table cell */
    compact?: boolean;
}

/**
 * Parse various user value formats into a normalized structure
 */
function parseUserValue(value: unknown): UserValue | null {
    if (!value) return null;

    if (typeof value === 'string') {
        return { name: value };
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return {
            id: obj.id as string | undefined,
            name: obj.name as string | undefined,
            email: obj.email as string | undefined,
        };
    }

    return null;
}

/**
 * UserChip - Display component for user fields with context menu
 * 
 * Features:
 * - Shows user avatar with initials
 * - Right-click context menu with actions
 * - Similar UX to MentionChip for # references
 */
export function UserChip({
    value,
    className,
    onUnlink,
    onInspect,
    compact = false,
}: UserChipProps) {
    const [showMenu, setShowMenu] = useState(false);
    const chipRef = useRef<HTMLDivElement>(null);

    const user = parseUserValue(value);
    const displayName = user?.name || user?.email || '';

    // Get initials for avatar
    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('');

    // Handle right-click
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
    }, []);

    // Handle click - toggle menu
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu((prev) => !prev);
    }, []);

    // Unlink action - convert to plain text
    const handleUnlink = useCallback(() => {
        if (onUnlink) {
            onUnlink(displayName);
        }
        setShowMenu(false);
    }, [displayName, onUnlink]);

    // Inspect user action
    const handleInspect = useCallback(() => {
        if (onInspect && user?.id) {
            onInspect(user.id);
        }
        setShowMenu(false);
    }, [onInspect, user?.id]);

    if (!displayName) {
        return <div className={clsx('text-xs text-slate-400', className)}>-</div>;
    }

    // Compact mode for table cells - just show avatar with tooltip
    if (compact) {
        return (
            <div className={clsx('flex items-center justify-center', className)}>
                <div
                    ref={chipRef}
                    className={clsx(
                        'w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold',
                        'flex items-center justify-center border border-white shadow-sm',
                        'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all'
                    )}
                    title={displayName}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                >
                    {initials || displayName.slice(0, 2).toUpperCase()}
                </div>

                <PortalMenu
                    isOpen={showMenu}
                    anchorRef={chipRef}
                    onClose={() => setShowMenu(false)}
                    className="min-w-[180px] py-1"
                >
                    <UserContextMenuContent
                        user={user}
                        displayName={displayName}
                        onUnlink={onUnlink ? handleUnlink : undefined}
                        onInspect={onInspect && user?.id ? handleInspect : undefined}
                        onClose={() => setShowMenu(false)}
                    />
                </PortalMenu>
            </div>
        );
    }

    // Full chip mode - pill with name
    return (
        <div
            ref={chipRef}
            className={clsx(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
                'bg-blue-50 text-blue-700 text-sm cursor-pointer',
                'hover:bg-blue-100 transition-colors',
                className
            )}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <AtSign size={14} className="opacity-70" />
            <span className="font-medium">{displayName}</span>

            <PortalMenu
                isOpen={showMenu}
                anchorRef={chipRef}
                onClose={() => setShowMenu(false)}
                className="min-w-[180px] py-1"
            >
                <UserContextMenuContent
                    user={user}
                    displayName={displayName}
                    onUnlink={onUnlink ? handleUnlink : undefined}
                    onInspect={onInspect && user?.id ? handleInspect : undefined}
                    onClose={() => setShowMenu(false)}
                />
            </PortalMenu>
        </div>
    );
}

/**
 * Context menu content for user chip
 */
interface UserContextMenuContentProps {
    user: UserValue | null;
    displayName: string;
    onUnlink?: () => void;
    onInspect?: () => void;
    onClose: () => void;
}

function UserContextMenuContent({
    user,
    displayName,
    onUnlink,
    onInspect,
}: UserContextMenuContentProps) {
    return (
        <>
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                        {displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 truncate">{displayName}</div>
                        {user?.email && user.email !== displayName && (
                            <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase font-bold">
                User Actions
            </div>

            {/* Copy Name */}
            <button
                onClick={() => {
                    navigator.clipboard.writeText(displayName);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
            >
                <User size={14} className="text-slate-500" />
                <span>Copy Name</span>
            </button>

            {/* Copy Email */}
            {user?.email && (
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(user.email!);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                    <AtSign size={14} className="text-slate-500" />
                    <span>Copy Email</span>
                </button>
            )}

            {/* Inspect User */}
            {onInspect && (
                <button
                    onClick={onInspect}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                    <ExternalLink size={14} className="text-blue-500" />
                    <span>View User Details</span>
                </button>
            )}

            {onUnlink && (
                <>
                    <div className="border-t border-slate-100 my-1" />

                    {/* Unlink - Convert to Text */}
                    <button
                        onClick={onUnlink}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                        <Type size={14} className="text-orange-500" />
                        <span>Convert to Text</span>
                        <span className="text-[10px] text-slate-400 ml-auto">→ text</span>
                    </button>
                </>
            )}

            {/* Footer info */}
            <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 mt-1">
                <div className="flex items-center gap-1">
                    <Link2 size={10} />
                    <span>Linked user reference</span>
                </div>
            </div>
        </>
    );
}
