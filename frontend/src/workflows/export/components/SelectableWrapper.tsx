/**
 * Selectable Wrapper
 * 
 * HOC/wrapper component that makes any element selectable during collection mode.
 * Shows hover state, handles clicks, and displays "in collection" badge.
 */

import { useCallback, useState, type ReactNode, type CSSProperties } from 'react';
import { useCollectionModeOptional } from '../context/CollectionModeProvider';
import { CollectionFlashOverlay } from './CollectionFlashOverlay';
import type { SelectionType } from '../../../stores';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const baseStyle: CSSProperties = {
    position: 'relative',
    transition: 'outline 0.15s ease',
};

const hoverStyle: CSSProperties = {
    outline: '2px dashed #f59e0b', // Amber
    cursor: 'pointer',
};

const selectedStyle: CSSProperties = {
    outline: '2px solid #10b981', // Emerald
};

const badgeStyle: CSSProperties = {
    position: 'absolute',
    top: -6,
    right: -6,
    background: '#8b5cf6', // Violet
    color: 'white',
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 9999,
    zIndex: 10,
    pointerEvents: 'none',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SelectableWrapperProps {
    children: ReactNode;
    type: SelectionType;
    sourceId: string;
    fieldKey?: string;
    displayLabel: string;
    value?: unknown;
    className?: string;
    style?: CSSProperties;
    disabled?: boolean;
}

export function SelectableWrapper({
    children,
    type,
    sourceId,
    fieldKey,
    displayLabel,
    value,
    className,
    style,
    disabled = false,
}: SelectableWrapperProps) {
    const collectionMode = useCollectionModeOptional();
    const [isHovering, setIsHovering] = useState(false);
    const [showFlash, setShowFlash] = useState(false);

    const isCollecting = collectionMode?.isCollecting ?? false;
    const isSelected = collectionMode?.isInCollection(sourceId, fieldKey) ?? false;

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!collectionMode || !isCollecting || disabled) return;

            // Prevent default behavior when in collection mode
            e.preventDefault();
            e.stopPropagation();

            if (isSelected) {
                // Can't remove by clicking - use collection panel
                return;
            }

            // Add to collection with flash animation
            collectionMode.addToCollection({
                type,
                sourceId,
                fieldKey,
                displayLabel,
                value,
            });

            setShowFlash(true);
        },
        [collectionMode, isCollecting, isSelected, disabled, type, sourceId, fieldKey, displayLabel, value]
    );

    const handleFlashComplete = useCallback(() => {
        setShowFlash(false);
    }, []);

    // Not in collection mode - render children as-is
    if (!isCollecting) {
        return (
            <div className={className} style={style}>
                {children}
            </div>
        );
    }

    // In collection mode - add interaction
    const combinedStyle: CSSProperties = {
        ...baseStyle,
        ...style,
        ...(isHovering && !isSelected ? hoverStyle : {}),
        ...(isSelected ? selectedStyle : {}),
        ...(disabled ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
    };

    return (
        <div
            className={className}
            style={combinedStyle}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleClick}
        >
            {children}
            {isSelected && <span style={badgeStyle}>✓</span>}
            {showFlash && <CollectionFlashOverlay onComplete={handleFlashComplete} />}
        </div>
    );
}
