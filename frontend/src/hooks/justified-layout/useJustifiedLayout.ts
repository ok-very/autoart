import { useMemo } from 'react';
import justifiedLayout from 'justified-layout';
import type {
  LayoutInputItem,
  LayoutGeometry,
  LayoutConfiguration,
  UseJustifiedLayoutProps,
} from './types';

/** Default empty layout */
const EMPTY_LAYOUT: LayoutGeometry = {
  containerHeight: 0,
  widowCount: 0,
  boxes: [],
};

/**
 * React hook for Flickr's justified-layout algorithm.
 * Calculates optimal positions for images in a justified grid.
 *
 * @example
 * ```tsx
 * const layout = useJustifiedLayout({
 *   items: images.map(img => ({ width: img.width, height: img.height })),
 *   config: {
 *     containerWidth: 800,
 *     targetRowHeight: 200,
 *     boxSpacing: 10,
 *   },
 * });
 *
 * return (
 *   <div style={{ position: 'relative', height: layout.containerHeight }}>
 *     {layout.boxes.map((box, i) => (
 *       <img
 *         key={i}
 *         style={{
 *           position: 'absolute',
 *           top: box.top,
 *           left: box.left,
 *           width: box.width,
 *           height: box.height,
 *         }}
 *       />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useJustifiedLayout({
  items,
  config,
}: UseJustifiedLayoutProps): LayoutGeometry {
  return useMemo(() => {
    if (!items.length || !config.containerWidth) {
      return EMPTY_LAYOUT;
    }

    // Convert items to the format expected by justified-layout
    const input: LayoutInputItem[] = items.map((item) =>
      typeof item === 'number' ? item : { width: item.width, height: item.height }
    );

    // Call the justified-layout algorithm
    const result = justifiedLayout(input, config as LayoutConfiguration);

    return {
      containerHeight: result.containerHeight,
      widowCount: result.widowCount,
      boxes: result.boxes,
    };
  }, [items, config]);
}
