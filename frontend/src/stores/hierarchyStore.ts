import { create } from 'zustand';

import type { HierarchyNode } from '../types';

interface HierarchyState {
  nodes: Record<string, HierarchyNode>;
  expandedIds: Set<string>;
  selectedProjectId: string | null;

  // Actions
  setNodes: (nodes: HierarchyNode[]) => void;
  updateNode: (node: HierarchyNode) => void;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  selectProject: (id: string | null) => void;

  // Computed helpers
  getNode: (id: string) => HierarchyNode | undefined;
  getChildren: (parentId: string | null) => HierarchyNode[];
  getAncestors: (id: string) => HierarchyNode[];
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  nodes: {},
  expandedIds: new Set(),
  selectedProjectId: null,

  setNodes: (nodeList) => {
    const nodes: Record<string, HierarchyNode> = {};
    nodeList.forEach(node => {
      nodes[node.id] = node;
    });
    set({ nodes });
  },

  updateNode: (node) => set((state) => ({
    nodes: { ...state.nodes, [node.id]: node },
  })),

  toggleExpand: (id) => set((state) => {
    const newExpanded = new Set(state.expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    return { expandedIds: newExpanded };
  }),

  expandAll: () => set((state) => ({
    expandedIds: new Set(Object.keys(state.nodes)),
  })),

  collapseAll: () => set({ expandedIds: new Set() }),

  selectProject: (id) => set({ selectedProjectId: id }),

  getNode: (id) => get().nodes[id],

  getChildren: (parentId) => {
    const nodes = get().nodes;
    return Object.values(nodes)
      .filter(node => node.parent_id === parentId)
      .sort((a, b) => a.position - b.position);
  },

  getAncestors: (id) => {
    const nodes = get().nodes;
    const ancestors: HierarchyNode[] = [];
    let current = nodes[id];
    while (current?.parent_id) {
      const parent = nodes[current.parent_id];
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  },
}));
