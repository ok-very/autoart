/**
 * Workspace color class mappings for Tailwind CSS.
 *
 * Tailwind requires class names to be statically analyzable.
 * This lookup ensures all color variants are included in the bundle.
 */

export type WorkspaceColorName = 'cyan' | 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'amber' | 'slate';

export interface WorkspaceColorClasses {
    bg50: string;
    bg100: string;
    bg200: string;
    border200: string;
    borderL500: string;
    text600: string;
    text700: string;
    hoverBg100: string;
}

export const WORKSPACE_COLORS: Record<WorkspaceColorName, WorkspaceColorClasses> = {
    cyan: {
        bg50: 'bg-cyan-50',
        bg100: 'bg-cyan-100',
        bg200: 'bg-cyan-200',
        border200: 'border-cyan-200',
        borderL500: 'border-l-cyan-500',
        text600: 'text-cyan-600',
        text700: 'text-cyan-700',
        hoverBg100: 'hover:bg-cyan-100',
    },
    pink: {
        bg50: 'bg-pink-50',
        bg100: 'bg-pink-100',
        bg200: 'bg-pink-200',
        border200: 'border-pink-200',
        borderL500: 'border-l-pink-500',
        text600: 'text-pink-600',
        text700: 'text-pink-700',
        hoverBg100: 'hover:bg-pink-100',
    },
    blue: {
        bg50: 'bg-blue-50',
        bg100: 'bg-blue-100',
        bg200: 'bg-blue-200',
        border200: 'border-blue-200',
        borderL500: 'border-l-blue-500',
        text600: 'text-blue-600',
        text700: 'text-blue-700',
        hoverBg100: 'hover:bg-blue-100',
    },
    green: {
        bg50: 'bg-green-50',
        bg100: 'bg-green-100',
        bg200: 'bg-green-200',
        border200: 'border-green-200',
        borderL500: 'border-l-green-500',
        text600: 'text-green-600',
        text700: 'text-green-700',
        hoverBg100: 'hover:bg-green-100',
    },
    purple: {
        bg50: 'bg-purple-50',
        bg100: 'bg-purple-100',
        bg200: 'bg-purple-200',
        border200: 'border-purple-200',
        borderL500: 'border-l-purple-500',
        text600: 'text-purple-600',
        text700: 'text-purple-700',
        hoverBg100: 'hover:bg-purple-100',
    },
    orange: {
        bg50: 'bg-orange-50',
        bg100: 'bg-orange-100',
        bg200: 'bg-orange-200',
        border200: 'border-orange-200',
        borderL500: 'border-l-orange-500',
        text600: 'text-orange-600',
        text700: 'text-orange-700',
        hoverBg100: 'hover:bg-orange-100',
    },
    amber: {
        bg50: 'bg-amber-50',
        bg100: 'bg-amber-100',
        bg200: 'bg-amber-200',
        border200: 'border-amber-200',
        borderL500: 'border-l-amber-500',
        text600: 'text-amber-600',
        text700: 'text-amber-700',
        hoverBg100: 'hover:bg-amber-100',
    },
    slate: {
        bg50: 'bg-slate-50',
        bg100: 'bg-slate-100',
        bg200: 'bg-slate-200',
        border200: 'border-slate-200',
        borderL500: 'border-l-slate-500',
        text600: 'text-slate-600',
        text700: 'text-slate-700',
        hoverBg100: 'hover:bg-slate-100',
    },
};

/** Get color classes for a workspace color, with slate fallback */
export function getWorkspaceColorClasses(color: string | null | undefined): WorkspaceColorClasses {
    if (color && color in WORKSPACE_COLORS) {
        return WORKSPACE_COLORS[color as WorkspaceColorName];
    }
    return WORKSPACE_COLORS.slate;
}
