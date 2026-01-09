/**
 * BottomDrawer
 *
 * Collapsible drawer positioned at the bottom of the workspace.
 * Uses Mantine Paper + ActionIcon for consistent styling.
 */

import { useCallback } from 'react';
import { Paper, ActionIcon, Group, Text, Collapse } from '@mantine/core';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { DrawerRegistry } from './DrawerRegistry';

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
    <Paper
      shadow="md"
      radius={0}
      className="border-t border-slate-200 flex flex-col shrink-0 relative z-40 transition-all duration-200"
      style={{ height: effectiveHeight }}
    >
      {!drawerCollapsed && <ResizeHandle direction="top" onResize={handleResize} />}

      {/* Header */}
      <Group
        justify="space-between"
        px="md"
        py="xs"
        className="border-b border-slate-100 bg-slate-50 shrink-0"
      >
        <Text size="xs" fw={700} c="slate.7" tt="uppercase" className="tracking-wide">
          {activeDrawer.type.replace(/-/g, ' ')}
        </Text>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={toggleDrawer}
            title={drawerCollapsed ? 'Expand drawer' : 'Collapse drawer'}
          >
            {drawerCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={closeDrawer}
            title="Close drawer"
          >
            <X size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Content */}
      <Collapse in={!drawerCollapsed}>
        <div className="flex-1 overflow-auto p-4 custom-scroll" style={{ height: drawerHeight - 40 }}>
          <DrawerRegistry type={activeDrawer.type} context={activeDrawer.props} onClose={closeDrawer} />
        </div>
      </Collapse>
    </Paper>
  );
}
