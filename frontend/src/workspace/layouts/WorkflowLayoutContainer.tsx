/**
 * WorkflowLayoutContainer
 *
 * Orchestrates rendering of a workflow's panel layout.
 * Takes a workflow ID, context, and panel components, then renders
 * them according to the workflow's layout definition.
 */

import { useMemo } from 'react';

import { FixedPanelRegion } from './FixedPanelRegion';
import { getWorkflowLayout } from './workflowRegistry';
import type { WorkflowContext, PanelComponentMap, PanelSlot } from './types';

interface WorkflowLayoutContainerProps {
  workflowId: string;
  context: WorkflowContext;
  panelComponents: PanelComponentMap;
  className?: string;
}

export function WorkflowLayoutContainer({
  workflowId,
  context,
  panelComponents,
  className = '',
}: WorkflowLayoutContainerProps) {
  const layout = getWorkflowLayout(workflowId);

  // Compute visibility for each slot
  const slotVisibility = useMemo(() => {
    if (!layout) return {};

    const visibility: Record<string, boolean> = {};
    for (const slot of layout.slots) {
      visibility[slot.panelId] = slot.visible ? slot.visible(context) : true;
    }
    return visibility;
  }, [layout, context]);

  if (!layout) {
    console.warn(`WorkflowLayoutContainer: Unknown workflow "${workflowId}"`);
    return <>{panelComponents['import-wizard-content'] || null}</>;
  }

  // Separate slots by region
  const mainSlot = layout.slots.find((s) => s.region === 'main');
  const bottomSlots = layout.slots.filter((s) => s.region === 'bottom');
  const rightSlots = layout.slots.filter((s) => s.region === 'right');
  const leftSlots = layout.slots.filter((s) => s.region === 'left');

  // Calculate grid template based on visible panels
  const hasVisibleBottom = bottomSlots.some((s) => slotVisibility[s.panelId]);
  const hasVisibleRight = rightSlots.some((s) => slotVisibility[s.panelId]);
  const hasVisibleLeft = leftSlots.some((s) => slotVisibility[s.panelId]);

  // Dynamic grid template
  const gridTemplateRows = hasVisibleBottom ? '1fr auto' : '1fr';
  const gridTemplateColumns = [
    hasVisibleLeft ? 'auto' : '',
    '1fr',
    hasVisibleRight ? 'auto' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderSlot = (slot: PanelSlot) => {
    const isVisible = slotVisibility[slot.panelId];
    const component = panelComponents[slot.panelId];

    if (!component && !isVisible) return null;

    return (
      <FixedPanelRegion
        key={slot.panelId}
        region={slot.region}
        isVisible={isVisible}
        animateFrom={slot.animateFrom}
        size={slot.size}
        minSize={slot.minSize}
      >
        {component}
      </FixedPanelRegion>
    );
  };

  return (
    <div
      className={`workflow-layout-container workflow-${workflowId} ${className}`}
      style={{
        display: 'grid',
        gridTemplateRows,
        gridTemplateColumns,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left panels */}
      {leftSlots.map(renderSlot)}

      {/* Main content area */}
      {mainSlot && (
        <div className="workflow-main-region" style={{ overflow: 'auto', minHeight: 0 }}>
          {panelComponents[mainSlot.panelId]}
        </div>
      )}

      {/* Right panels */}
      {rightSlots.map(renderSlot)}

      {/* Bottom panels - span full width */}
      {bottomSlots.length > 0 && (
        <div
          className="workflow-bottom-region"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {bottomSlots.map(renderSlot)}
        </div>
      )}
    </div>
  );
}
