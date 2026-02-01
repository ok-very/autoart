/**
 * Workspace color class mappings for Tailwind CSS.
 *
 * Tailwind requires class names to be statically analyzable.
 * This lookup ensures all color variants are included in the bundle.
 */

export type WorkspaceColorName =
    | 'red' | 'orange' | 'amber' | 'yellow' | 'lime'
    | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky'
    | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia'
    | 'pink' | 'rose'
    | 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone';

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
    // Chromatic — warm to cool
    red: {
        bg50: 'bg-red-50',
        bg100: 'bg-red-100',
        bg200: 'bg-red-200',
        border200: 'border-red-200',
        borderL500: 'border-l-red-500',
        text600: 'text-red-600',
        text700: 'text-red-700',
        hoverBg100: 'hover:bg-red-100',
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
    yellow: {
        bg50: 'bg-yellow-50',
        bg100: 'bg-yellow-100',
        bg200: 'bg-yellow-200',
        border200: 'border-yellow-200',
        borderL500: 'border-l-yellow-500',
        text600: 'text-yellow-600',
        text700: 'text-yellow-700',
        hoverBg100: 'hover:bg-yellow-100',
    },
    lime: {
        bg50: 'bg-lime-50',
        bg100: 'bg-lime-100',
        bg200: 'bg-lime-200',
        border200: 'border-lime-200',
        borderL500: 'border-l-lime-500',
        text600: 'text-lime-600',
        text700: 'text-lime-700',
        hoverBg100: 'hover:bg-lime-100',
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
    emerald: {
        bg50: 'bg-emerald-50',
        bg100: 'bg-emerald-100',
        bg200: 'bg-emerald-200',
        border200: 'border-emerald-200',
        borderL500: 'border-l-emerald-500',
        text600: 'text-emerald-600',
        text700: 'text-emerald-700',
        hoverBg100: 'hover:bg-emerald-100',
    },
    teal: {
        bg50: 'bg-teal-50',
        bg100: 'bg-teal-100',
        bg200: 'bg-teal-200',
        border200: 'border-teal-200',
        borderL500: 'border-l-teal-500',
        text600: 'text-teal-600',
        text700: 'text-teal-700',
        hoverBg100: 'hover:bg-teal-100',
    },
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
    sky: {
        bg50: 'bg-sky-50',
        bg100: 'bg-sky-100',
        bg200: 'bg-sky-200',
        border200: 'border-sky-200',
        borderL500: 'border-l-sky-500',
        text600: 'text-sky-600',
        text700: 'text-sky-700',
        hoverBg100: 'hover:bg-sky-100',
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
    indigo: {
        bg50: 'bg-indigo-50',
        bg100: 'bg-indigo-100',
        bg200: 'bg-indigo-200',
        border200: 'border-indigo-200',
        borderL500: 'border-l-indigo-500',
        text600: 'text-indigo-600',
        text700: 'text-indigo-700',
        hoverBg100: 'hover:bg-indigo-100',
    },
    violet: {
        bg50: 'bg-violet-50',
        bg100: 'bg-violet-100',
        bg200: 'bg-violet-200',
        border200: 'border-violet-200',
        borderL500: 'border-l-violet-500',
        text600: 'text-violet-600',
        text700: 'text-violet-700',
        hoverBg100: 'hover:bg-violet-100',
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
    fuchsia: {
        bg50: 'bg-fuchsia-50',
        bg100: 'bg-fuchsia-100',
        bg200: 'bg-fuchsia-200',
        border200: 'border-fuchsia-200',
        borderL500: 'border-l-fuchsia-500',
        text600: 'text-fuchsia-600',
        text700: 'text-fuchsia-700',
        hoverBg100: 'hover:bg-fuchsia-100',
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
    rose: {
        bg50: 'bg-rose-50',
        bg100: 'bg-rose-100',
        bg200: 'bg-rose-200',
        border200: 'border-rose-200',
        borderL500: 'border-l-rose-500',
        text600: 'text-rose-600',
        text700: 'text-rose-700',
        hoverBg100: 'hover:bg-rose-100',
    },
    // Neutrals
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
    gray: {
        bg50: 'bg-gray-50',
        bg100: 'bg-gray-100',
        bg200: 'bg-gray-200',
        border200: 'border-gray-200',
        borderL500: 'border-l-gray-500',
        text600: 'text-gray-600',
        text700: 'text-gray-700',
        hoverBg100: 'hover:bg-gray-100',
    },
    zinc: {
        bg50: 'bg-zinc-50',
        bg100: 'bg-zinc-100',
        bg200: 'bg-zinc-200',
        border200: 'border-zinc-200',
        borderL500: 'border-l-zinc-500',
        text600: 'text-zinc-600',
        text700: 'text-zinc-700',
        hoverBg100: 'hover:bg-zinc-100',
    },
    neutral: {
        bg50: 'bg-neutral-50',
        bg100: 'bg-neutral-100',
        bg200: 'bg-neutral-200',
        border200: 'border-neutral-200',
        borderL500: 'border-l-neutral-500',
        text600: 'text-neutral-600',
        text700: 'text-neutral-700',
        hoverBg100: 'hover:bg-neutral-100',
    },
    stone: {
        bg50: 'bg-stone-50',
        bg100: 'bg-stone-100',
        bg200: 'bg-stone-200',
        border200: 'border-stone-200',
        borderL500: 'border-l-stone-500',
        text600: 'text-stone-600',
        text700: 'text-stone-700',
        hoverBg100: 'hover:bg-stone-100',
    },
};

/** 8 curated defaults shown by default in pickers */
export const BASIC_COLOR_NAMES: WorkspaceColorName[] = [
    'red', 'orange', 'amber', 'green', 'cyan', 'blue', 'purple', 'pink',
];

/** Full ordered palette (warm → cool → neutral) */
export const ALL_COLOR_NAMES: WorkspaceColorName[] = [
    'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
    'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
    'slate', 'gray', 'zinc', 'neutral', 'stone',
];

/** Get color classes for a workspace color, with slate fallback */
export function getWorkspaceColorClasses(color: string | null | undefined): WorkspaceColorClasses {
    if (color && color in WORKSPACE_COLORS) {
        return WORKSPACE_COLORS[color as WorkspaceColorName];
    }
    return WORKSPACE_COLORS.slate;
}
