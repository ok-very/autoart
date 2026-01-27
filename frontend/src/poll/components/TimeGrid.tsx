import { Fragment, useCallback, useRef, useState } from 'react';

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
}

function generateSlotKey(date: string, hour: number, minute: number): string {
  return `${date}:${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.getMonth() + 1;
  const dayNum = date.getDate();
  return `${day} ${month}/${dayNum}`;
}

function formatTimeHeader(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
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

function getHeatmapColor(count: number, maxCount: number): string {
  if (maxCount === 0) return 'bg-slate-100';
  const ratio = count / maxCount;
  if (ratio === 0) return 'bg-slate-100';
  if (ratio <= 0.25) return 'bg-emerald-200';
  if (ratio <= 0.5) return 'bg-emerald-300';
  if (ratio <= 0.75) return 'bg-emerald-400';
  return 'bg-emerald-500';
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
}: TimeGridProps) {
  const timeSlots = generateTimeSlots(startHour, endHour, granularity);
  const isDragging = useRef(false);
  const dragMode = useRef<'select' | 'deselect'>('select');
  const [draggedSlots, setDraggedSlots] = useState<Set<string>>(new Set());

  const handleSlotInteraction = useCallback(
    (slotKey: string, isStart: boolean) => {
      if (readOnly || heatmapData) return;

      if (isStart) {
        isDragging.current = true;
        dragMode.current = selectedSlots.has(slotKey) ? 'deselect' : 'select';
        setDraggedSlots(new Set([slotKey]));
      } else if (isDragging.current) {
        setDraggedSlots((prev) => new Set([...prev, slotKey]));
      }
    },
    [readOnly, heatmapData, selectedSlots]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const newSlots = new Set(selectedSlots);
    draggedSlots.forEach((slot) => {
      if (dragMode.current === 'select') {
        newSlots.add(slot);
      } else {
        newSlots.delete(slot);
      }
    });

    onSlotsChange(newSlots);
    setDraggedSlots(new Set());
  }, [selectedSlots, draggedSlots, onSlotsChange]);

  const getSlotClassName = (slotKey: string): string => {
    const baseClasses = 'h-6 border-r border-b border-slate-300 transition-colors';

    if (heatmapData) {
      const count = heatmapData.get(slotKey) ?? 0;
      return `${baseClasses} ${getHeatmapColor(count, maxCount)}`;
    }

    const isSelected = selectedSlots.has(slotKey);
    const isDragTarget = draggedSlots.has(slotKey);

    if (isDragTarget) {
      return `${baseClasses} ${dragMode.current === 'select' ? 'bg-emerald-400' : 'bg-slate-200'}`;
    }

    if (isSelected) {
      return `${baseClasses} bg-emerald-500`;
    }

    return `${baseClasses} bg-white hover:bg-slate-100`;
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
        <div className="sticky left-0 z-20 bg-white border-r border-b border-slate-300" />

        {/* Date headers */}
        {dates.map((date) => (
          <div
            key={date}
            className="sticky top-0 z-10 bg-white border-r border-b border-slate-300 px-2 py-1 text-center text-sm font-medium text-slate-700"
          >
            {formatDateHeader(date)}
          </div>
        ))}

        {/* Time rows */}
        {timeSlots.map(({ hour, minute }) => (
          <Fragment key={`row-${hour}-${minute}`}>
            {/* Time header */}
            <div
              className="sticky left-0 z-10 bg-white border-r border-b border-slate-300 px-2 py-0.5 text-xs text-slate-600 whitespace-nowrap"
            >
              {minute === 0 ? formatTimeHeader(hour, minute) : ''}
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
