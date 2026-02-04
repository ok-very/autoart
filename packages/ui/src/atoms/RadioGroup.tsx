import { clsx } from 'clsx';

interface RadioOption {
    value: string;
    label: string;
    description?: string;
}

interface RadioGroupProps {
    value: string;
    onChange: (value: string) => void;
    options: RadioOption[];
    name: string;
    label?: string;
    className?: string;
}

export function RadioGroup({ value, onChange, options, name, label, className }: RadioGroupProps) {
    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            {label && (
                <span className="text-sm font-medium text-ws-fg mb-1">
                    {label}
                </span>
            )}
            <div className="flex flex-col gap-2">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="flex items-start gap-3 cursor-pointer"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={(e) => onChange(e.target.value)}
                            className="mt-0.5 w-4 h-4 text-ws-accent border-ws-panel-border focus:ring-ws-accent focus:ring-2"
                        />
                        <div className="flex flex-col gap-0">
                            <span className="text-sm font-medium text-ws-fg">
                                {option.label}
                            </span>
                            {option.description && (
                                <span className="text-xs text-ws-text-secondary">
                                    {option.description}
                                </span>
                            )}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
