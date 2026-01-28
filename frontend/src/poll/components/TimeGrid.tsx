import { Fragment, useCallback, useRef, useState } from 'react';
import {
  formatDateHeader as sharedFormatDateHeader,
  formatTime as sharedFormatTime,
  DEFAULT_DATE_CONFIG,
  type DateFormatConfig,
} from '@autoart/shared';

interface TimeGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  granularity: '15min' | '30min' | '60min';
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
  readOnly?: boolean;
  heatmapData?: Map<string, number>;
  maxCount?: number;
  onInteraction?: () => void;
  dateFormatConfig?: DateFormatConfig;
}

function generateSlotKey(date: string, hour: number, minute: number): string {
  return `${date}:${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function getGranularityMinutes(granularity: '15min' | '30min' | '60min'): number {
  switch (granularity) {
    case '15min':
      return 15;
    case '30min':
      return 30;
    case '60min':
      return 60;
  }
}

function generateTimeSlots(
  startHour: number,
  endHour: number,
  granularity: '15min' | '30min' | '60min'
): { hour: number; minute: number }[] {
  const slots: { hour: number; minute: number }[] = [];
  const minuteStep = getGranularityMinutes(granularity);

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += minuteStep) {
      slots.push({ hour, minute });
    }
  }

  return slots;
}

// Design system colors for heatmap
// Moss Green scale: from light (#E8EBE5) to full (#6F7F5C)
function getHeatmapColor(count: number, maxCount: number): string {
  if (maxCount === 0) return 'bg-heatmap-0';
  const ratio = count / maxCount;
  if (ratio === 0) return 'bg-heatmap-0';
  if (ratio <= 0.25) return 'bg-heatmap-25';
  if (ratio <= 0.5) return 'bg-heatmap-50';
  if (ratio <= 0.75) return 'bg-heatmap-75';
  return 'bg-heatmap-100';
}

export function TimeGrid({
  dates,
  startHour,
  endHour,
  granularity,
  selectedSlots,
  onSlotsChange,
  readOnly = false,
  heatmapData,
  maxCount = 0,
  onInteraction,
  dateFormatConfig,
}: TimeGridProps) {
  const config = dateFormatConfig ?? DEFAULT_DATE_CONFIG;
  const timeSlots = generateTimeSlots(startHour, endHour, granularity);
  const isDragging = useRef(false);
  const hasCalledInteraction = useRef(false);
  // Track drag state together - mode and slots
  const [dragState, setDragState] = useState<{
    mode: 'select' | 'deselect';
    slots: Set<string>;
  }>({ mode: 'select', slots: new Set() });

  const handleSlotInteraction = useCallback(
    (slotKey: string, isStart: boolean) => {
      if (readOnly || heatmapData) return;

      // Call onInteraction once on first interaction
      if (!hasCalledInteraction.current && onInteraction) {
        hasCalledInteraction.current = true;
        onInteraction();
      }

      if (isStart) {
        isDragging.current = true;
        const mode = selectedSlots.has(slotKey) ? 'deselect' : 'select';
        setDragState({ mode, slots: new Set([slotKey]) });
      } else if (isDragging.current) {
        setDragState((prev) => ({
          ...prev,
          slots: new Set([...prev.slots, slotKey]),
        }));
      }
    },
    [readOnly, heatmapData, selectedSlots, onInteraction]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const newSlots = new Set(selectedSlots);
    dragState.slots.forEach((slot) => {
      if (dragState.mode === 'select') {
        newSlots.add(slot);
      } else {
        newSlots.delete(slot);
      }
    });

    onSlotsChange(newSlots);
    setDragState({ mode: 'select', slots: new Set() });
  }, [selectedSlots, dragState, onSlotsChange]);

  const getSlotClassName = (slotKey: string): string => {
    const baseClasses = 'h-6 border-r border-b border-ws-border transition-colors';

    if (heatmapData) {
      const count = heatmapData.get(slotKey) ?? 0;
      return `${baseClasses} ${getHeatmapColor(count, maxCount)}`;
    }

    const isSelected = selectedSlots.has(slotKey);
    const isDragTarget = dragState.slots.has(slotKey);

    if (isDragTarget) {
      return `${baseClasses} ${dragState.mode === 'select' ? 'bg-heatmap-75' : 'bg-[#EAE7E2]'}`;
    }

    if (isSelected) {
      return `${baseClasses} bg-heatmap-100`;
    }

    return `${baseClasses} bg-white hover:bg-[#EAE7E2]`;
  };

  return (
    <div
      className="overflow-x-auto select-none"
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchEnd={handleDragEnd}
    >
      <div
        className="grid min-w-fit"
        style={{
          gridTemplateColumns: `auto repeat(${dates.length}, minmax(60px, 1fr))`,
        }}
      >
        {/* Empty corner cell */}
        <div className="sticky left-0 z-20 bg-white border-r border-b border-ws-border" />

        {/* Date headers */}
        {dates.map((date) => (
          <div
            key={date}
            className="sticky top-0 z-10 bg-white border-r border-b border-ws-border px-2 py-1 text-center text-sm font-medium text-ws-fg"
          >
            {sharedFormatDateHeader(date, config)}
          </div>
        ))}

        {/* Time rows */}
        {timeSlots.map(({ hour, minute }) => (
          <Fragment key={`row-${hour}-${minute}`}>
            {/* Time header */}
            <div
              className="sticky left-0 z-10 bg-white border-r border-b border-ws-border px-2 py-0.5 text-xs text-ws-text-secondary whitespace-nowrap"
            >
              {minute === 0 ? sharedFormatTime(hour, minute, config) : ''}
            </div>

            {/* Slot cells */}
            {dates.map((date) => {
              const slotKey = generateSlotKey(date, hour, minute);
              return (
                <div
                  key={slotKey}
                  className={getSlotClassName(slotKey)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSlotInteraction(slotKey, true);
                  }}
                  onMouseEnter={() => handleSlotInteraction(slotKey, false)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleSlotInteraction(slotKey, true);
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const element = document.elementFromPoint(touch.clientX, touch.clientY);
                    const touchSlotKey = element?.getAttribute('data-slot');
                    if (touchSlotKey) {
                      handleSlotInteraction(touchSlotKey, false);
                    }
                  }}
                  data-slot={slotKey}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
