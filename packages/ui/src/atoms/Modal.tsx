
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    className?: string;
}

export function Modal({ open, onOpenChange, title, description, children, size = 'md', className }: ModalProps) {
    // Map size to max-width classes
    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        full: 'max-w-[95vw]',
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-[2px] transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content
                    className={clsx(
                        "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--ws-panel-border,#e2e8f0)] bg-[var(--ws-panel-bg,#fff)] p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl",
                        sizeClasses[size],
                        className
                    )}
                >
                    {(title || description) && (
                        <div className="flex flex-col space-y-1.5 text-center sm:text-left pr-8">
                            {title && <Dialog.Title className="text-lg font-semibold leading-none tracking-tight text-[var(--ws-fg,#1e293b)]">{title}</Dialog.Title>}
                            {description && <Dialog.Description className="text-sm text-[var(--ws-text-secondary,#5a5a57)]">{description}</Dialog.Description>}
                        </div>
                    )}

                    <div className="relative">
                        {children}
                    </div>

                    <Dialog.Close asChild>
                        <button
                            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[var(--ws-panel-bg,#fff)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent,#3b82f6)] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[var(--ws-row-expanded-bg,rgba(63,92,110,0.04))] data-[state=open]:text-[var(--ws-text-secondary,#5a5a57)]"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
