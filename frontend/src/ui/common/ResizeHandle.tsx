import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';

interface ResizeHandleProps {
  direction: 'left' | 'right' | 'top' | 'bottom';
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);

  const isVertical = direction === 'top' || direction === 'bottom';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos(isVertical ? e.clientY : e.clientX);
  }, [isVertical]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = isVertical ? e.clientY : e.clientX;
      const delta = currentPos - startPos;
      
      // For left handles, positive movement (right) shrinks the panel (negative delta)
      // For right handles, positive movement (right) expands the panel (positive delta)
      // For top/bottom, we pass the raw delta (down is positive, up is negative)
      // Consumers (like BottomDrawer) handle the math (e.g. height - delta for top handle)
      const adjustedDelta = direction === 'left' ? -delta : delta;
      
      onResize(adjustedDelta);
      setStartPos(currentPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, startPos, direction, onResize, isVertical]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={clsx(
        'transition-colors group flex items-center justify-center',
        isVertical ? 'h-1 cursor-row-resize w-full' : 'w-1 cursor-col-resize h-full',
        isDragging ? 'bg-blue-400' : 'bg-transparent hover:bg-blue-300',
        className
      )}
    >
      {/* Visual indicator */}
      <div
        className={clsx(
          'rounded-full transition-colors',
          isVertical ? 'h-0.5 w-8' : 'w-0.5 h-8',
          isDragging ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400'
        )}
      />
    </div>
  );
}
