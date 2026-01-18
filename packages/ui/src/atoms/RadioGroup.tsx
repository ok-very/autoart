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
                <span className="text-sm font-medium text-slate-700 mb-1">
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
                            className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex flex-col gap-0">
                            <span className="text-sm font-medium text-slate-700">
                                {option.label}
                            </span>
                            {option.description && (
                                <span className="text-xs text-slate-500">
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
