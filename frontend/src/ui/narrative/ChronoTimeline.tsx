/**
 * ChronoTimeline
 *
 * Wrapper around react-chrono with project-specific styling and configuration.
 * Provides consistent timeline presentation across the application.
 *
 * Modes:
 * - VERTICAL: Default for project log (scrollable history)
 * - HORIZONTAL: Alternative for client-facing summary views
 * - VERTICAL_ALTERNATING: For detailed action threads
 */

import { Chrono, TimelineItem } from 'react-chrono';
import { useMemo } from 'react';
import { clsx } from 'clsx';

export type TimelineMode = 'VERTICAL' | 'HORIZONTAL' | 'VERTICAL_ALTERNATING';

export interface ChronoTimelineItem extends Omit<TimelineItem, 'cardTitle' | 'cardSubtitle' | 'cardDetailedText'> {
    /** Primary title */
    title: string;
    /** Subtitle/secondary text */
    subtitle?: string;
    /** Detailed content (can be array for multiple paragraphs) */
    details?: string | string[];
    /** Custom content to render in the card */
    content?: React.ReactNode;
    /** Category for styling (maps to fact families) */
    category?: 'communication' | 'artifacts' | 'meetings' | 'decisions' | 'financial' | 'contracts' | 'process' | 'workflow';
    /** Icon to display (Lucide icon name or emoji) */
    icon?: React.ReactNode;
}

export interface ChronoTimelineProps {
    /** Items to display in the timeline */
    items: ChronoTimelineItem[];
    /** Display mode */
    mode?: TimelineMode;
    /** Whether to show all cards expanded */
    cardLess?: boolean;
    /** Hide controls (navigation) */
    hideControls?: boolean;
    /** Whether to scroll to the end (most recent) */
    scrollToEnd?: boolean;
    /** Whether to enable keyboard navigation */
    enableKeyboardNav?: boolean;
    /** Theme variant */
    theme?: 'light' | 'dark';
    /** Additional className */
    className?: string;
    /** Called when an item is selected */
    onItemSelected?: (item: ChronoTimelineItem, index: number) => void;
}

/**
 * Category to color mapping for timeline dots/cards
 */
const categoryColors = {
    communication: { primary: '#3b82f6', secondary: '#dbeafe' }, // blue
    artifacts: { primary: '#22c55e', secondary: '#dcfce7' }, // green
    meetings: { primary: '#a855f7', secondary: '#f3e8ff' }, // purple
    decisions: { primary: '#eab308', secondary: '#fef9c3' }, // yellow
    financial: { primary: '#f97316', secondary: '#ffedd5' }, // orange
    contracts: { primary: '#6366f1', secondary: '#e0e7ff' }, // indigo
    process: { primary: '#14b8a6', secondary: '#ccfbf1' }, // teal
    workflow: { primary: '#64748b', secondary: '#f1f5f9' }, // slate
};

/**
 * ChronoTimeline Component
 */
export function ChronoTimeline({
    items,
    mode = 'VERTICAL',
    cardLess = false,
    hideControls = true,
    scrollToEnd: _scrollToEnd = false,
    enableKeyboardNav: _enableKeyboardNav = true,
    theme = 'light',
    className,
    onItemSelected,
}: ChronoTimelineProps) {
    // Convert our items to react-chrono format
    const chronoItems: TimelineItem[] = useMemo(() => {
        return items.map((item) => ({
            title: item.title,
            cardTitle: item.title,
            cardSubtitle: item.subtitle,
            cardDetailedText: Array.isArray(item.details) ? item.details : item.details ? [item.details] : undefined,
        }));
    }, [items]);

    // Build theme object based on category colors
    const chronoTheme = useMemo(() => {
        // Use default category for theming with fallback
        const defaultCategory = items[0]?.category;
        const colors = (defaultCategory && categoryColors[defaultCategory]) || categoryColors.workflow;

        return {
            primary: colors.primary,
            secondary: colors.secondary,
            cardBgColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            cardForeColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
            titleColor: theme === 'dark' ? '#f1f5f9' : '#334155',
            titleColorActive: colors.primary,
        };
    }, [items, theme]);

    // Handle item selection
    const handleItemSelected = (data: { index: number } | Record<string, unknown>) => {
        if (onItemSelected && 'index' in data && typeof data.index === 'number' && data.index >= 0 && data.index < items.length) {
            onItemSelected(items[data.index], data.index);
        }
    };

    if (items.length === 0) {
        return (
            <div className={clsx(
                'flex items-center justify-center py-8 text-slate-400 text-sm',
                className
            )}>
                No timeline items
            </div>
        );
    }

    return (
        <div className={clsx('chrono-timeline-wrapper', className)}>
            <Chrono
                items={chronoItems}
                mode={mode}
                cardLess={cardLess}
                hideControls={hideControls}
                scrollable={{ scrollbar: true }}
                enableOutline={false}
                enableBreakPoint={mode === 'VERTICAL'}
                useReadMore={false}
                fontSizes={{
                    cardSubtitle: '0.75rem',
                    cardText: '0.875rem',
                    cardTitle: '0.875rem',
                    title: '0.75rem',
                }}
                theme={chronoTheme}
                onItemSelected={handleItemSelected}
            />
        </div>
    );
}

export default ChronoTimeline;
