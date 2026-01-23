/**
 * Collection Flash Overlay
 * 
 * Overlay component that shows an amber flash animation when an item is added
 * to a collection. Self-removes after animation completes.
 */

import { useEffect, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    animation: 'collection-flash 300ms ease-out forwards',
};

// CSS keyframes injected once
const KEYFRAMES_ID = 'collection-flash-keyframes';

function ensureKeyframes() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KEYFRAMES_ID)) return;

    const style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = `
    @keyframes collection-flash {
      0% { background-color: transparent; }
      20% { background-color: rgba(245, 158, 11, 0.4); }
      100% { background-color: transparent; }
    }
  `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CollectionFlashOverlayProps {
    onComplete?: () => void;
}

export function CollectionFlashOverlay({ onComplete }: CollectionFlashOverlayProps) {
    // Ensure keyframes are in the document
    useEffect(() => {
        ensureKeyframes();
    }, []);

    // Call onComplete after animation duration
    useEffect(() => {
        const timer = setTimeout(() => {
            onComplete?.();
        }, 300);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return <div style={overlayStyle} />;
}
