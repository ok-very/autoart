/**
 * ExportStepIndicator
 *
 * Minimal step bar: Configure → Execute → Output.
 * Derives position from the current step in the store.
 */

import { clsx } from 'clsx';

const STEPS = ['Configure', 'Output'] as const;

interface ExportStepIndicatorProps {
    currentStep: 'configure' | 'output';
}

export function ExportStepIndicator({ currentStep }: ExportStepIndicatorProps) {
    const currentIndex = currentStep === 'output' ? 1 : 0;

    return (
        <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                    {i > 0 && (
                        <div
                            className={clsx(
                                'w-6 h-px',
                                i <= currentIndex
                                    ? 'bg-[var(--ws-accent,#3F5C6E)]'
                                    : 'bg-[var(--ws-text-disabled,#8C8C88)]',
                            )}
                        />
                    )}
                    <span
                        className={clsx(
                            'text-xs font-semibold uppercase tracking-wide',
                            i === currentIndex
                                ? 'text-[var(--ws-accent,#3F5C6E)]'
                                : i < currentIndex
                                  ? 'text-[var(--ws-text-secondary,#5A5A57)]'
                                  : 'text-[var(--ws-text-disabled,#8C8C88)]',
                        )}
                    >
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}
