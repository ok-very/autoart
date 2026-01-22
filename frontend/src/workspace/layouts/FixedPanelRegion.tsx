/**
 * FixedPanelRegion
 *
 * Wrapper component that provides animated visibility transitions
 * for fixed panel regions within a workflow layout.
 */

import { useRef, useEffect, useState } from 'react';
import type { PanelRegion } from './types';

interface FixedPanelRegionProps {
  children: React.ReactNode;
  region: PanelRegion;
  isVisible: boolean;
  animateFrom?: 'bottom' | 'right' | 'left' | 'top';
  size: number;
  minSize?: number;
  className?: string;
}

export function FixedPanelRegion({
  children,
  region,
  isVisible,
  animateFrom = 'bottom',
  size,
  minSize,
  className = '',
}: FixedPanelRegionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(isVisible);

  // Handle delayed unmount for exit animation
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      // Wait for exit animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) {
    return null;
  }

  // Calculate size style based on region
  const sizeStyle: React.CSSProperties = {};
  const resolvedSize = size ?? 0;
  const sizeValue = resolvedSize < 1 ? `${resolvedSize * 100}%` : `${resolvedSize}px`;
  const minSizeValue = minSize != null ? `${minSize}px` : undefined;

  if (region === 'bottom' || region === 'top') {
    sizeStyle.height = sizeValue;
    sizeStyle.minHeight = minSizeValue;
  } else {
    sizeStyle.width = sizeValue;
    sizeStyle.minWidth = minSizeValue;
  }

  return (
    <div
      ref={containerRef}
      className={`fixed-panel-region region-${region} animate-from-${animateFrom} ${isVisible ? 'is-visible' : 'is-hidden'} ${className}`}
      style={{
        ...sizeStyle,
        '--panel-size': sizeValue,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

