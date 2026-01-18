import { useState, useEffect, useCallback, ChangeEvent, KeyboardEvent, forwardRef } from 'react';
import { TextInput } from './TextInput';

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof TextInput>, 'onChange'> {
    value: string;
    onCommit: (value: string) => void;
    onChange?: (value: string) => void;
}

export const DebouncedInput = forwardRef<HTMLInputElement, DebouncedInputProps>(
    ({ value: initialValue, onCommit, onChange, ...props }, ref) => {
        const [value, setValue] = useState(initialValue);

        // Sync with external value changes
        useEffect(() => {
            setValue(initialValue);
        }, [initialValue]);

        const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setValue(newValue);
            onChange?.(newValue);
        }, [onChange]);

        const handleBlur = useCallback(() => {
            if (value !== initialValue) {
                onCommit(value);
            }
        }, [value, initialValue, onCommit]);

        const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.currentTarget.blur(); // Trigger blur to commit
            }
            props.onKeyDown?.(e);
        }, [props]);

        return (
            <TextInput
                {...props}
                ref={ref}
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
        );
    }
);

DebouncedInput.displayName = 'DebouncedInput';
