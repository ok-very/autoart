import clsx from 'clsx';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { useArtifactLookup } from '../../api/hooks';

interface ImageFieldRendererProps {
    /** Stored URL/path value from record data */
    value: string | undefined;
    /** Persistent artifact ID for AutoHelper lookup (survives file moves) */
    artifactId?: string;
    /** Alt text for the image */
    alt?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional className */
    className?: string;
}

/**
 * ImageFieldRenderer - Renders image fields with live AutoHelper lookup
 *
 * When an artifact_id is present, queries AutoHelper for the current file location.
 * Falls back to the stored value if AutoHelper is unavailable or lookup fails.
 * Shows a visual indicator if the file has been moved since the record was created.
 */
export function ImageFieldRenderer({
    value,
    artifactId,
    alt = '',
    size = 'sm',
    className,
}: ImageFieldRendererProps) {
    const { data: artifact, isLoading, isError } = useArtifactLookup(artifactId);

    // Determine which URL to display
    // Priority: live lookup result > stored value
    const displayUrl = artifact?.current_filename || value;

    // Detect if file has moved (stored path differs from current)
    const hasMoved = artifact && value && artifact.current_filename !== value;

    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-20 w-20',
    };

    if (!displayUrl) {
        return (
            <div
                className={clsx(
                    'bg-slate-100 rounded flex items-center justify-center text-ws-muted',
                    sizeClasses[size],
                    className
                )}
            >
                <span className="text-xs">-</span>
            </div>
        );
    }

    return (
        <div className={clsx('relative inline-block', className)}>
            {/* Loading indicator */}
            {isLoading && artifactId && (
                <div
                    className={clsx(
                        'absolute inset-0 bg-slate-100 rounded flex items-center justify-center z-10',
                        sizeClasses[size]
                    )}
                >
                    <RefreshCw size={12} className="animate-spin text-ws-muted" />
                </div>
            )}

            {/* Image */}
            <img
                src={displayUrl}
                alt={alt}
                className={clsx(
                    'object-cover rounded',
                    sizeClasses[size],
                    isLoading && 'opacity-50'
                )}
                onError={(e) => {
                    // If live URL fails, try the stored value
                    if (artifact && value && e.currentTarget.src !== value) {
                        e.currentTarget.src = value;
                    }
                }}
            />

            {/* Moved indicator */}
            {hasMoved && !isLoading && (
                <div
                    className="absolute -top-1 -right-1 bg-amber-100 rounded-full p-0.5"
                    title={`File moved from: ${value}`}
                >
                    <AlertTriangle size={10} className="text-amber-600" />
                </div>
            )}

            {/* Error indicator (AutoHelper unavailable) */}
            {isError && artifactId && (
                <div
                    className="absolute -top-1 -right-1 bg-slate-100 rounded-full p-0.5"
                    title="Could not verify current location"
                >
                    <RefreshCw size={10} className="text-ws-muted" />
                </div>
            )}
        </div>
    );
}
