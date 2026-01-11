/**
 * MediaCell - Image thumbnail with popup viewer
 *
 * Features:
 * - Displays image thumbnail in table cell
 * - Click to open full-size popup viewer
 * - Keyboard navigation (arrow keys, escape to close)
 * - Gallery mode for multiple images
 */
import { clsx } from 'clsx';
import { X, ChevronLeft, ChevronRight, ZoomIn, ExternalLink } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface MediaItem {
    url: string;
    caption?: string;
    type?: string;
    date?: string;
}

export interface MediaCellProps {
    /** Single image or array of images */
    media: MediaItem | MediaItem[];
    /** Size of thumbnail */
    size?: 'sm' | 'md' | 'lg';
    /** Show count badge for multiple images */
    showCount?: boolean;
    /** Additional className */
    className?: string;
}

export interface MediaViewerProps {
    /** Array of media items */
    items: MediaItem[];
    /** Initial index to display */
    initialIndex?: number;
    /** Called when viewer is closed */
    onClose: () => void;
}

/**
 * MediaViewer - Full-screen popup for viewing images
 */
export function MediaViewer({ items, initialIndex = 0, onClose }: MediaViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const currentItem = items[currentIndex];

    const goNext = useCallback(() => {
        setCurrentIndex((i) => (i + 1) % items.length);
    }, [items.length]);

    const goPrev = useCallback(() => {
        setCurrentIndex((i) => (i - 1 + items.length) % items.length);
    }, [items.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight' && items.length > 1) {
                goNext();
            } else if (e.key === 'ArrowLeft' && items.length > 1) {
                goPrev();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, goNext, goPrev, items.length]);

    // Prevent body scroll when viewer is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close viewer"
            >
                <X size={24} />
            </button>

            {/* Navigation - Previous */}
            {items.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                    }}
                    className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Previous image"
                >
                    <ChevronLeft size={32} />
                </button>
            )}

            {/* Main image */}
            <div
                className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={currentItem.url}
                    alt={currentItem.caption || 'Image'}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />

                {/* Caption and metadata */}
                <div className="mt-4 text-center text-white">
                    {currentItem.caption && (
                        <p className="text-lg font-medium">{currentItem.caption}</p>
                    )}
                    <div className="flex items-center justify-center gap-4 mt-2 text-sm text-white/70">
                        {currentItem.type && <span>{currentItem.type}</span>}
                        {currentItem.date && <span>{currentItem.date}</span>}
                        {items.length > 1 && (
                            <span>
                                {currentIndex + 1} / {items.length}
                            </span>
                        )}
                    </div>
                    {/* Open in new tab */}
                    <a
                        href={currentItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                        <ExternalLink size={14} />
                        Open original
                    </a>
                </div>
            </div>

            {/* Navigation - Next */}
            {items.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                    }}
                    className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Next image"
                >
                    <ChevronRight size={32} />
                </button>
            )}

            {/* Thumbnail strip for gallery */}
            {items.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-lg bg-black/50">
                    {items.map((item, index) => (
                        <button
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(index);
                            }}
                            className={clsx(
                                'w-12 h-12 rounded overflow-hidden border-2 transition-all',
                                index === currentIndex
                                    ? 'border-white scale-110'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                            )}
                        >
                            <img
                                src={item.url}
                                alt={item.caption || `Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body
    );
}

/**
 * MediaCell - Thumbnail display for table cells
 */
export function MediaCell({
    media,
    size = 'md',
    showCount = true,
    className,
}: MediaCellProps) {
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const items = Array.isArray(media) ? media : [media];

    if (items.length === 0 || !items[0]?.url) {
        return (
            <div
                className={clsx(
                    'flex items-center justify-center bg-slate-100 text-slate-400 rounded',
                    size === 'sm' && 'w-8 h-8 text-xs',
                    size === 'md' && 'w-12 h-12 text-sm',
                    size === 'lg' && 'w-16 h-16',
                    className
                )}
            >
                —
            </div>
        );
    }

    const primaryImage = items[0];

    return (
        <>
            <button
                onClick={() => setIsViewerOpen(true)}
                className={clsx(
                    'relative rounded overflow-hidden group cursor-pointer',
                    'hover:ring-2 hover:ring-violet-400 transition-all',
                    size === 'sm' && 'w-8 h-8',
                    size === 'md' && 'w-12 h-12',
                    size === 'lg' && 'w-16 h-16',
                    className
                )}
                title={primaryImage.caption || 'View image'}
            >
                <img
                    src={primaryImage.url}
                    alt={primaryImage.caption || 'Thumbnail'}
                    className="w-full h-full object-cover"
                />

                {/* Zoom overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn size={size === 'sm' ? 12 : 16} className="text-white" />
                </div>

                {/* Count badge for multiple images */}
                {showCount && items.length > 1 && (
                    <div className="absolute bottom-0 right-0 px-1 py-0.5 bg-black/70 text-white text-xs rounded-tl">
                        +{items.length - 1}
                    </div>
                )}
            </button>

            {isViewerOpen && (
                <MediaViewer
                    items={items}
                    initialIndex={0}
                    onClose={() => setIsViewerOpen(false)}
                />
            )}
        </>
    );
}
