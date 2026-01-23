/**
 * Workflow Layout Registry
 *
 * Defines the panel layout for each workflow type.
 * Each workflow specifies which panels appear where and under what conditions.
 */

import type { WorkflowLayoutDefinition } from './types';

export const WORKFLOW_LAYOUTS: Record<string, WorkflowLayoutDefinition> = {
  import: {
    id: 'import',
    name: 'Import Workflow',
    gridTemplate: {
      rows: '1fr',
    },
    slots: [
      {
        panelId: 'import-wizard-content',
        region: 'main',
        size: 1,
      },
      {
        panelId: 'classification',
        region: 'bottom',
        size: 0.33, // 1/3 of container height
        minSize: 200,
        visible: (ctx) => ctx.needsClassification === true,
        animateFrom: 'bottom',
      },
    ],
  },
};

/**
 * Get a workflow layout definition by ID
 */
export function getWorkflowLayout(workflowId: string): WorkflowLayoutDefinition | undefined {
  return WORKFLOW_LAYOUTS[workflowId];
}
