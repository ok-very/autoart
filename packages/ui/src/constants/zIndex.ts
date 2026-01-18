/**
 * Centralized z-index constants for consistent layering across the application.
 * Higher values appear above lower values.
 */
export const Z_INDEX = {
  /** Standard dropdowns (select menus, etc.) */
  DROPDOWN: 100,
  /** Modal dialogs */
  MODAL: 200,
  /** Drawer panels */
  DRAWER: 300,
  /** Search comboboxes (RecordSearchCombobox) */
  COMBOBOX: 400,
  /** Context menus (MentionChip menu, right-click menus) */
  CONTEXT_MENU: 500,
  /** Tooltips (highest priority) */
  TOOLTIP: 600,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
