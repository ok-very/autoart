/**
 * WorkflowLayout Type Definitions
 *
 * Defines the "Spaces" concept where each workflow owns its panel layout.
 * Similar to Blender's workspace model - workflows define fixed panel regions
 * with CSS-driven layouts and animations.
 */

export type PanelRegion = 'main' | 'bottom' | 'right' | 'left' | 'top';

export interface PanelSlot {
  /** Unique identifier for the panel */
  panelId: string;
  /** Which region this panel occupies */
  region: PanelRegion;
  /** Size as fraction (0.33 = 1/3) or pixels */
  size: number;
  /** Minimum size in pixels */
  minSize?: number;
  /** Function to determine visibility based on workflow context */
  visible?: (context: WorkflowContext) => boolean;
  /** Direction from which the panel animates in */
  animateFrom?: 'bottom' | 'right' | 'left' | 'top';
}

export interface WorkflowLayoutDefinition {
  /** Unique workflow identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Panel slots for this workflow */
  slots: PanelSlot[];
  /** CSS Grid template for the layout */
  gridTemplate: {
    rows?: string;
    columns?: string;
  };
}

export interface WorkflowContext {
  /** Current step in multi-step workflows */
  step?: number;
  /** Session ID for stateful workflows */
  sessionId?: string | null;
  /** Whether classification panel should be shown */
  needsClassification?: boolean;
}

export interface PanelComponentMap {
  [panelId: string]: React.ReactNode;
}
