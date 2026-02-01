import { clsx } from 'clsx';

export interface BadgeProps {
    variant?: 'project' | 'process' | 'stage' | 'subprocess' | 'task' | 'default' | 'warning' | 'light' | 'success' | 'error' | 'neutral' | 'info';
    size?: 'xs' | 'sm' | 'md';
    children: React.ReactNode;
    className?: string;
}

const variantStyles = {
    project: 'bg-blue-100 text-blue-800 border-blue-200',
    process: 'bg-purple-100 text-purple-800 border-purple-200',
    stage: 'bg-slate-100 text-slate-600 border-slate-200',
    subprocess: 'bg-orange-50 text-orange-700 border-orange-200',
    task: 'bg-green-50 text-green-700 border-green-200',
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    light: 'bg-slate-50 text-slate-500 border-slate-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const sizeStyles = {
    xs: 'px-1 py-0.5 text-[9px]',
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
};

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center rounded font-sans font-bold uppercase tracking-wider border',
                variantStyles[variant],
                sizeStyles[size],
                className
            )}
        >
            {children}
        </span>
    );
}
