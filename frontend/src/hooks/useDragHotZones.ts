/**
 * useDragHotZones Hook
 *
 * Detects cursor position during drag operations and triggers callbacks
 * when the cursor dwells in defined "hot zones" for a specified duration.
 *
 * This solves a limitation in react-big-calendar's flexbox layout where
 * dragging to the edge doesn't auto-scroll/navigate. Hot zones enable
 * cross-month navigation when dragging events near calendar edges.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface HotZoneConfig {
    /** Unique identifier for this zone */
    id: string;
    /** Bounding box in viewport coordinates */
    bounds: { left: number; right: number; top: number; bottom: number };
    /** Callback when dwell time is reached */
    onTrigger: () => void;
}

export interface UseDragHotZonesOptions {
    /** Hot zone configurations */
    zones: HotZoneConfig[];
    /** Time in ms cursor must dwell in zone before triggering (default: 450ms) */
    dwellTime?: number;
    /** Cooldown in ms after trigger before zone can trigger again (default: 900ms) */
    cooldownTime?: number;
    /** Whether a drag operation is currently active */
    isDragging: boolean;
}

export interface UseDragHotZonesResult {
    /** Currently active zone ID, if any */
    activeZoneId: string | null;
    /** Whether in cooldown period after a trigger */
    inCooldown: boolean;
}

/**
 * Hook for handling drag hot zones with dwell-time triggers.
 *
 * Usage:
 * ```tsx
 * const [isDragging, setIsDragging] = useState(false);
 * const containerRef = useRef<HTMLDivElement>(null);
 *
 * const zones = useMemo(() => {
 *   if (!containerRef.current) return [];
 *   const rect = containerRef.current.getBoundingClientRect();
 *   return [
 *     {
 *       id: 'prev',
 *       bounds: { left: rect.left, right: rect.left + 60, top: rect.top, bottom: rect.bottom },
 *       onTrigger: () => navigatePrev(),
 *     },
 *     {
 *       id: 'next',
 *       bounds: { left: rect.right - 60, right: rect.right, top: rect.top, bottom: rect.bottom },
 *       onTrigger: () => navigateNext(),
 *     },
 *   ];
 * }, [containerRef.current]);
 *
 * useDragHotZones({ zones, isDragging, dwellTime: 450, cooldownTime: 900 });
 * ```
 */
export function useDragHotZones({
    zones,
    dwellTime = 450,
    cooldownTime = 900,
    isDragging,
}: UseDragHotZonesOptions): UseDragHotZonesResult {
    const dwellTimerRef = useRef<number | null>(null);
    const cooldownTimerRef = useRef<number | null>(null);
    const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
    const [inCooldown, setInCooldown] = useState(false);

    const clearTimers = useCallback(() => {
        if (dwellTimerRef.current) {
            window.clearTimeout(dwellTimerRef.current);
            dwellTimerRef.current = null;
        }
        if (cooldownTimerRef.current) {
            window.clearTimeout(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
        }
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || inCooldown) return;

        // Find if cursor is in any zone
        const currentZone = zones.find(z =>
            e.clientX >= z.bounds.left && e.clientX <= z.bounds.right &&
            e.clientY >= z.bounds.top && e.clientY <= z.bounds.bottom
        );
        const zoneId = currentZone?.id ?? null;

        // If zone changed, reset timer
        if (zoneId !== activeZoneId) {
            clearTimers();
            setActiveZoneId(zoneId);

            if (currentZone) {
                // Start dwell timer for new zone
                dwellTimerRef.current = window.setTimeout(() => {
                    currentZone.onTrigger();

                    // Enter cooldown
                    setInCooldown(true);
                    cooldownTimerRef.current = window.setTimeout(() => {
                        setInCooldown(false);
                    }, cooldownTime);
                }, dwellTime);
            }
        }
    }, [isDragging, inCooldown, activeZoneId, zones, dwellTime, cooldownTime, clearTimers]);

    // Add/remove mousemove listener based on drag state
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                clearTimers();
            };
        }
    }, [isDragging, handleMouseMove, clearTimers]);

    // Reset state when drag ends
    useEffect(() => {
        if (!isDragging) {
            clearTimers();
            setActiveZoneId(null);
            setInCooldown(false);
        }
    }, [isDragging, clearTimers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, [clearTimers]);

    return {
        activeZoneId,
        inCooldown,
    };
}

export default useDragHotZones;
