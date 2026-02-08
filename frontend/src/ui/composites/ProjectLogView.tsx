/**
 * ProjectLogView adapter — delegates to the canonical projectLog version.
 *
 * The original composites version was dead code (always returned empty cards).
 * This thin wrapper exists for backwards compatibility with consumers that
 * import ProjectLogView from composites/ and pass props.
 *
 * The canonical version reads context from stores, so the projectId prop
 * is ignored here.
 */

import { ProjectLogView as CanonicalProjectLogView } from '../projectLog/ProjectLogView';

interface ProjectLogViewProps {
  projectId?: string | null;
  contextType?: string;
  contextId?: string;
}

export function ProjectLogView(_props: ProjectLogViewProps) {
  return <CanonicalProjectLogView />;
}
