/**
 * ImportWorkflowLayout
 *
 * Workflow-specific layout for the import process.
 * Renders the main import wizard content with the ClassificationPanel
 * appearing as a fixed bottom 1/3 region when classification is needed.
 */

import { useMemo } from 'react';

import { useImportContext } from '../../../surfaces/import/ImportContextProvider';
import { ClassificationPanel } from '../../../surfaces/import/ClassificationPanel';
import { WorkflowLayoutContainer } from '../WorkflowLayoutContainer';
import type { WorkflowContext, PanelComponentMap } from '../types';

interface ImportWorkflowLayoutProps {
  children: React.ReactNode;
}

export function ImportWorkflowLayout({ children }: ImportWorkflowLayoutProps) {
  const importContext = useImportContext();

  // Determine if classification is needed:
  // - Session status is 'needs_review', OR
  // - Plan has unresolved AMBIGUOUS/UNCLASSIFIED items
  const needsClassification = useMemo(() => {
    if (importContext.session?.status === 'needs_review') {
      return true;
    }

    // Check if plan has items needing classification
    if (importContext.plan?.classifications) {
      const hasUnresolved = importContext.plan.classifications.some(
        (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
      );
      return hasUnresolved;
    }

    return false;
  }, [importContext.session?.status, importContext.plan?.classifications]);

  // Build workflow context
  const workflowContext = useMemo<WorkflowContext>(
    () => ({
      sessionId: importContext.session?.id ?? null,
      needsClassification,
    }),
    [importContext.session?.id, needsClassification]
  );

  // Build panel component map
  const panelComponents = useMemo<PanelComponentMap>(
    () => ({
      'import-wizard-content': children,
      classification: needsClassification ? (
        <ClassificationPanel
          sessionId={importContext.session?.id ?? null}
          plan={importContext.plan}
          onResolutionsSaved={importContext.updatePlan}
        />
      ) : null,
    }),
    [children, importContext.session?.id, importContext.plan, importContext.updatePlan, needsClassification]
  );

  return (
    <WorkflowLayoutContainer
      workflowId="import"
      context={workflowContext}
      panelComponents={panelComponents}
    />
  );
}

    />
  );
}

