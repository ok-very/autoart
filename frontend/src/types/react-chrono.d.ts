declare module 'react-chrono' {
    import { ComponentType, ReactNode } from 'react';

    export interface TimelineItem {
        title?: string;
        cardTitle?: string;
        cardSubtitle?: string;
        cardDetailedText?: string | string[];
        media?: {
            type: 'IMAGE' | 'VIDEO';
            source: { url: string };
        };
        [key: string]: unknown;
    }

    export interface ChronoProps {
        items?: TimelineItem[];
        mode?: 'VERTICAL' | 'HORIZONTAL' | 'VERTICAL_ALTERNATING';
        cardLess?: boolean;
        hideControls?: boolean;
        scrollable?: boolean | { scrollbar: boolean };
        enableOutline?: boolean;
        enableBreakPoint?: boolean;
        useReadMore?: boolean;
        flipLayout?: boolean;
        showAllCardsHorizontal?: boolean;
        cardPositionHorizontal?: 'TOP' | 'BOTTOM';
        cardWidth?: number;
        cardHeight?: number;
        lineWidth?: number;
        theme?: {
            primary?: string;
            secondary?: string;
            cardBgColor?: string;
            cardForeColor?: string;
            titleColor?: string;
            titleColorActive?: string;
        };
        fontSizes?: {
            cardSubtitle?: string;
            cardText?: string;
            cardTitle?: string;
            title?: string;
        };
        onItemSelected?: (data: { index: number } | TimelineItem) => void;
        activeItemIndex?: number;
        children?: ReactNode;
        classNames?: {
            card?: string;
            cardMedia?: string;
            cardSubTitle?: string;
            cardText?: string;
            cardTitle?: string;
            controls?: string;
            title?: string;
        };
    }

    export const Chrono: ComponentType<ChronoProps>;
    export default Chrono;
}
