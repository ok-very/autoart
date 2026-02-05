import { clsx } from 'clsx';
import { forwardRef, InputHTMLAttributes } from 'react';
import { AtSign } from 'lucide-react';

interface EmailInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    /** Icon size in pixels */
    iconSize?: number;
}

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
    ({ className, iconSize = 16, ...props }, ref) => {
        return (
            <div className={clsx('relative flex items-center', className)}>
                <AtSign
                    size={iconSize}
                    className="absolute left-3 pointer-events-none text-current opacity-40"
                />
                <input
                    ref={ref}
                    type="email"
                    className={clsx(
                        'w-full pl-9 pr-3 py-2 text-sm border rounded-md transition-colors',
                        'focus:outline-none focus:ring-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        className
                    )}
                    {...props}
                />
            </div>
        );
    }
);

EmailInput.displayName = 'EmailInput';
