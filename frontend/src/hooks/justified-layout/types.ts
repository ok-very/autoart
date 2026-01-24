/**
 * Types for the justified-layout hook
 * Based on Flickr's justified-layout algorithm
 */

/** Input item - either aspect ratio or dimensions */
export type LayoutInputItem = number | { width: number; height: number };

/** A positioned box in the layout */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  aspectRatio: number;
}

/** Result from the layout calculation */
export interface LayoutGeometry {
  containerHeight: number;
  widowCount: number;
  boxes: Box[];
}

/** Padding configuration - number or per-side object */
export type PaddingConfig =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };

/** Spacing configuration - number or horizontal/vertical object */
export type SpacingConfig = number | { horizontal?: number; vertical?: number };

/** Configuration options for the layout */
export interface LayoutConfiguration {
  /** Width of the container (required for calculation) */
  containerWidth: number;
  /** Padding around the container */
  containerPadding?: PaddingConfig;
  /** Spacing between boxes */
  boxSpacing?: SpacingConfig;
  /** Ideal row height */
  targetRowHeight?: number;
  /** How much row height can vary (0-1) */
  targetRowHeightTolerance?: number;
  /** Maximum number of rows to render */
  maxNumRows?: number;
  /** Force all items to this aspect ratio */
  forceAspectRatio?: number | false;
  /** Show incomplete last row */
  showWidows?: boolean;
  /** Alignment of incomplete last row: 'left' | 'center' | 'justify' */
  widowLayoutStyle?: 'left' | 'center' | 'justify';
  /** Insert full-width row every N rows */
  fullWidthBreakoutRowCadence?: number | false;
}

/** Props for the useJustifiedLayout hook */
export interface UseJustifiedLayoutProps {
  /** Array of items to layout - aspect ratios or {width, height} objects */
  items: LayoutInputItem[];
  /** Layout configuration */
  config: LayoutConfiguration;
}
