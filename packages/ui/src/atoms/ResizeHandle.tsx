import { clsx } from 'clsx';
import { useCallback, useEffect, useState, useRef } from 'react';

export interface ResizeHandleProps {
    /** Resize direction - determines handle orientation and delta calculation */
    direction: 'left' | 'right' | 'top' | 'bottom';
    /** Called with constrained delta on each resize movement */
    onResize: (delta: number) => void;

    // Built-in constraints (optional - consumer can still do their own Math.max/min)
    /** Minimum size in pixels (prevents resizing below this) */
    minSize?: number;
    /** Maximum size in pixels (prevents resizing above this) */
    maxSize?: number;
    /** Current size in pixels (required for constraint calculation) */
    currentSize?: number;

    // Scaling options
    /** Handle thickness preset */
    size?: 'sm' | 'md' | 'lg';
    /** Override indicator length (e.g., '2rem', 32) */
    indicatorLength?: number | string;

    // Customization
    /** Color variant */
    variant?: 'default' | 'subtle' | 'prominent';
    /** Additional className */
    className?: string;
}

// Size presets for handle thickness
const SIZE_PRESETS = {
    sm: { handle: 'h-0.5 w-full', handleV: 'w-0.5 h-full', indicator: 'h-px w-6', indicatorV: 'w-px h-6' },
    md: { handle: 'h-1 w-full', handleV: 'w-1 h-full', indicator: 'h-0.5 w-8', indicatorV: 'w-0.5 h-8' },
    lg: { handle: 'h-2 w-full', handleV: 'w-2 h-full', indicator: 'h-1 w-12', indicatorV: 'w-1 h-12' },
};

// Color variants
const VARIANT_COLORS = {
    default: {
        base: 'bg-transparent',
        hover: 'hover:bg-blue-200/50',
        active: 'bg-blue-300',
        indicator: 'bg-slate-300',
        indicatorHover: 'group-hover:bg-blue-400',
        indicatorActive: 'bg-blue-500',
    },
    subtle: {
        base: 'bg-transparent',
        hover: 'hover:bg-slate-100',
        active: 'bg-slate-200',
        indicator: 'bg-slate-200',
        indicatorHover: 'group-hover:bg-slate-400',
        indicatorActive: 'bg-slate-500',
    },
    prominent: {
        base: 'bg-slate-100',
        hover: 'hover:bg-blue-100',
        active: 'bg-blue-200',
        indicator: 'bg-blue-400',
        indicatorHover: 'group-hover:bg-blue-500',
        indicatorActive: 'bg-blue-600',
    },
};

/**
 * ResizeHandle - Draggable resize handle for panels
 *
 * Handles drag/touch interactions and reports constrained delta movements.
 * Supports built-in min/max constraints or delegates to parent.
 */
export function ResizeHandle({
    direction,
    onResize,
    minSize,
    maxSize,
    currentSize,
    size = 'md',
    indicatorLength,
    variant = 'default',
    className,
}: ResizeHandleProps) {
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef(0);
    const currentSizeRef = useRef(currentSize);

    // Keep currentSize ref updated
    useEffect(() => {
        currentSizeRef.current = currentSize;
    }, [currentSize]);

    const isVertical = direction === 'top' || direction === 'bottom';
    const sizePreset = SIZE_PRESETS[size];
    const colors = VARIANT_COLORS[variant];

    // Calculate constrained delta
    const constrainDelta = useCallback((rawDelta: number): number => {
        if (currentSizeRef.current === undefined) return rawDelta;

        const newSize = currentSizeRef.current + rawDelta;
        let constrainedSize = newSize;

        if (minSize !== undefined) constrainedSize = Math.max(minSize, constrainedSize);
        if (maxSize !== undefined) constrainedSize = Math.min(maxSize, constrainedSize);

        return constrainedSize - currentSizeRef.current;
    }, [minSize, maxSize]);

    // Unified start handler (mouse + touch)
    const handleStart = useCallback((clientPos: number) => {
        setIsDragging(true);
        startPosRef.current = clientPos;
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        handleStart(isVertical ? e.clientY : e.clientX);
    }, [isVertical, handleStart]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        handleStart(isVertical ? e.touches[0].clientY : e.touches[0].clientX);
    }, [isVertical, handleStart]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (clientPos: number) => {
            const delta = clientPos - startPosRef.current;

            // For left handles, positive movement (right) shrinks the panel (negative delta)
            // For right handles, positive movement (right) expands the panel (positive delta)
            const adjustedDelta = direction === 'left' ? -delta : delta;
            const constrainedDelta = constrainDelta(adjustedDelta);

            if (constrainedDelta !== 0) {
                onResize(constrainedDelta);
                // Only update start position by the actual (constrained) movement
                const actualMovement = direction === 'left' ? -constrainedDelta : constrainedDelta;
                startPosRef.current += actualMovement;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            handleMove(isVertical ? e.clientY : e.clientX);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            handleMove(isVertical ? e.touches[0].clientY : e.touches[0].clientX);
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
            document.removeEventListener('touchcancel', handleEnd);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, direction, onResize, isVertical, constrainDelta]);

    // Indicator style with optional custom length
    const indicatorStyle = indicatorLength
        ? { [isVertical ? 'width' : 'height']: typeof indicatorLength === 'number' ? `${indicatorLength}px` : indicatorLength }
        : undefined;

    return (
        <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={clsx(
                'transition-colors group flex items-center justify-center touch-none',
                isVertical ? `cursor-row-resize ${sizePreset.handle}` : `cursor-col-resize ${sizePreset.handleV}`,
                isDragging ? colors.active : `${colors.base} ${colors.hover}`,
                className
            )}
        >
            {/* Visual indicator */}
            <div
                style={indicatorStyle}
                className={clsx(
                    'rounded-full transition-colors',
                    // Only use preset classes if no custom length
                    !indicatorLength && (isVertical ? sizePreset.indicator : sizePreset.indicatorV),
                    // When custom length is set, we need thickness classes
                    indicatorLength && (isVertical ? 'h-0.5' : 'w-0.5'),
                    isDragging ? colors.indicatorActive : `${colors.indicator} ${colors.indicatorHover}`
                )}
            />
        </div>
    );
}
