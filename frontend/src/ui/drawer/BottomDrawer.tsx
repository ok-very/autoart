/**
 * BottomDrawer
 *
 * Collapsible drawer positioned at the bottom of the workspace.
 * Uses bespoke components for consistent styling.
 */

import { clsx } from 'clsx';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { useCallback } from 'react';

import { DrawerRegistry } from './DrawerRegistry';
import { useUIStore } from '../../stores/uiStore';
import { IconButton } from '../atoms/IconButton';
import { Inline } from '../atoms/Inline';
import { Text } from '../atoms/Text';
import { ResizeHandle } from '../common/ResizeHandle';

export function BottomDrawer() {
  const { activeDrawer, drawerHeight, drawerCollapsed, setDrawerHeight, toggleDrawer, closeDrawer } = useUIStore();

  const handleResize = useCallback(
    (delta: number) => {
      setDrawerHeight(drawerHeight - delta);
    },
    [drawerHeight, setDrawerHeight]
  );

  if (!activeDrawer) return null;

  const effectiveHeight = drawerCollapsed ? 40 : drawerHeight;

  return (
    <div
      className="bg-white shadow-md border-t border-slate-200 flex flex-col shrink-0 relative z-40 transition-all duration-200"
      style={{ height: effectiveHeight }}
    >
      {!drawerCollapsed && <ResizeHandle direction="top" onResize={handleResize} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
        <Text size="xs" weight="bold" color="default" className="uppercase tracking-wide">
          {activeDrawer.type.replace(/-/g, ' ')}
        </Text>
        <Inline gap="xs">
          <IconButton
            icon={drawerCollapsed ? Maximize2 : Minimize2}
            variant="ghost"
            size="sm"
            onClick={toggleDrawer}
            label={drawerCollapsed ? 'Expand drawer' : 'Collapse drawer'}
          />
          <IconButton
            icon={X}
            variant="ghost"
            size="sm"
            onClick={closeDrawer}
            label="Close drawer"
          />
        </Inline>
      </div>

      {/* Content */}
      <div
        className={clsx(
          'flex-1 overflow-auto p-4 custom-scroll transition-all duration-200',
          drawerCollapsed && 'hidden'
        )}
        style={{ height: drawerHeight - 40 }}
      >
        <DrawerRegistry type={activeDrawer.type} context={activeDrawer.props} onClose={closeDrawer} />
      </div>
    </div>
  );
}
