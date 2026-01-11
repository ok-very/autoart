import { clsx } from 'clsx';

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    colors: { name: string; hex: string }[];
    label?: string;
    className?: string;
}

export function ColorPicker({ value, onChange, colors, label, className }: ColorPickerProps) {
    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            {label && (
                <span className="text-xs text-slate-500 mb-1">
                    {label}
                </span>
            )}
            <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                    <button
                        key={color.name}
                        type="button"
                        onClick={() => onChange(color.name)}
                        className={clsx(
                            'w-8 h-8 rounded-full transition-all cursor-pointer',
                            'hover:scale-110 focus:outline-none',
                            value === color.name && 'ring-2 ring-offset-2'
                        )}
                        style={{
                            backgroundColor: color.hex,
                            // Use outline instead of ring for dynamic color
                            outline: value === color.name ? `2px solid ${color.hex}` : undefined,
                            outlineOffset: value === color.name ? '2px' : undefined,
                        }}
                        aria-label={`Select ${color.name} color`}
                    />
                ))}
            </div>
        </div>
    );
}
