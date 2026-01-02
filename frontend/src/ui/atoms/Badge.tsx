import { clsx } from 'clsx';

interface BadgeProps {
    variant?: 'project' | 'process' | 'stage' | 'subprocess' | 'task' | 'default';
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
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </span>
    );
}
