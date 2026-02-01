/**
 * QUARANTINED ATOM
 * 
 * This component breaks atom rules:
 * - Uses createPortal (global DOM access)
 * - Complex positioning logic
 * 
 * This is acceptable as a primitive building block for menus/dropdowns.
 * Consider this a "low-level atom" that enables higher-level patterns.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { Z_INDEX } from '../constants/zIndex';
import { useClickOutside } from '../hooks/useClickOutside';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface PortalMenuProps {
    /** Whether the menu is open */
    isOpen: boolean;
    /** Ref to the anchor element that the menu positions relative to */
    anchorRef: React.RefObject<HTMLElement | null>;
    /** Callback when the menu should close */
    onClose: () => void;
    /** Menu content */
    children: React.ReactNode;
    /** Placement relative to anchor. Default: 'bottom-start' */
    placement?: Placement;
    /** Z-index for the menu. Default: Z_INDEX.CONTEXT_MENU */
    zIndex?: number;
    /** Additional className for the menu container */
    className?: string;
}

interface Position {
    top: number;
    left: number;
}

/**
 * Portal-based menu component that renders outside the DOM hierarchy
 * to escape stacking context issues. Automatically positions relative
 * to an anchor element and handles viewport boundaries.
 */
export function PortalMenu({
    isOpen,
    anchorRef,
    onClose,
    children,
    placement = 'bottom-start',
    zIndex = Z_INDEX.CONTEXT_MENU,
    className = '',
}: PortalMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

    // Calculate position based on anchor and placement
    const updatePosition = useCallback(() => {
        if (!anchorRef.current || !menuRef.current) return;

        const anchorRect = anchorRef.current.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top: number;
        let left: number;

        // Calculate initial position based on placement
        switch (placement) {
            case 'bottom-start':
                top = anchorRect.bottom + 4;
                left = anchorRect.left;
                break;
            case 'bottom-end':
                top = anchorRect.bottom + 4;
                left = anchorRect.right - menuRect.width;
                break;
            case 'top-start':
                top = anchorRect.top - menuRect.height - 4;
                left = anchorRect.left;
                break;
            case 'top-end':
                top = anchorRect.top - menuRect.height - 4;
                left = anchorRect.right - menuRect.width;
                break;
            default:
                top = anchorRect.bottom + 4;
                left = anchorRect.left;
        }

        // Adjust for viewport boundaries
        // Right edge
        if (left + menuRect.width > viewportWidth - 8) {
            left = viewportWidth - menuRect.width - 8;
        }
        // Left edge
        if (left < 8) {
            left = 8;
        }
        // Bottom edge - flip to top if needed
        if (top + menuRect.height > viewportHeight - 8 && placement.startsWith('bottom')) {
            top = anchorRect.top - menuRect.height - 4;
        }
        // Top edge - flip to bottom if needed
        if (top < 8 && placement.startsWith('top')) {
            top = anchorRect.bottom + 4;
        }

        setPosition({ top, left });
    }, [anchorRef, placement]);

    // Update position when menu opens or anchor changes
    useEffect(() => {
        if (isOpen) {
            // Initial position calculation
            updatePosition();

            // Recalculate on scroll/resize
            const handleReposition = () => updatePosition();
            window.addEventListener('scroll', handleReposition, true);
            window.addEventListener('resize', handleReposition);

            return () => {
                window.removeEventListener('scroll', handleReposition, true);
                window.removeEventListener('resize', handleReposition);
            };
        }
    }, [isOpen, updatePosition]);

    // Handle click outside to close
    useClickOutside([anchorRef, menuRef], onClose, { enabled: isOpen });

    // Handle Escape key to close
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={menuRef}
            className={`fixed bg-white border border-slate-200 rounded-lg shadow-xl font-sans ${className}`}
            style={{
                top: position.top,
                left: position.left,
                zIndex,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    );
}
