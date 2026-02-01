/**
 * Themed Tab Component
 *
 * The single tab component for all dockview panels.
 * Handles workspace binding, panel close via store, dynamic panel IDs,
 * and Tailwind-based styling.
 */

import type { IDockviewPanelHeaderProps } from 'dockview';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { PANEL_DEFINITIONS, isPermanentPanel, type PanelId } from '../../panelRegistry';
import { BUILT_IN_WORKSPACES } from '../../workspacePresets';
import { getWorkspaceColorClasses } from '../../workspaceColors';

function getComponentType(panelId: string): PanelId {
  if (panelId.startsWith('project-panel-')) return 'project-panel';
  return panelId as PanelId;
}

export function ThemedTab({ api }: IDockviewPanelHeaderProps) {
  const closePanel = useWorkspaceStore((s) => s.closePanel);
  const componentType = getComponentType(api.id);
  const def = PANEL_DEFINITIONS[componentType];
  const Icon = def?.icon;

  const isBound = useWorkspaceStore((s) => s.boundPanelIds.has(api.id));
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaceColor = activeWorkspaceId
    ? BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceId)?.color
    : null;
  const colorClasses = getWorkspaceColorClasses(isBound ? workspaceColor : null);
  const boundColorClasses = isBound ? `border-l-2 ${colorClasses.borderL500}` : '';

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closePanel(api.id as PanelId);
  };

  return (
    <div className={`flex items-center gap-2 text-current overflow-hidden w-full group ${boundColorClasses}`}>
      <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
        {Icon && <Icon size={14} strokeWidth={2} className="flex-shrink-0" />}
        <span className="truncate">{def?.title || api.title}</span>
      </div>
      {!isPermanentPanel(componentType) && (
        <div
          onClick={handleClose}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--ws-tab-close-hover-bg)] rounded cursor-pointer transition-opacity"
          role="button"
          aria-label="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
