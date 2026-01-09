/**
 * Mantine Theme Configuration
 *
 * Aligns Mantine's design tokens with the existing Tailwind/custom styles.
 * Uses slate color palette to match existing UI.
 */

import { createTheme, MantineColorsTuple } from '@mantine/core';

// Custom slate palette matching Tailwind's slate
const slate: MantineColorsTuple = [
  '#f8fafc', // 0 - slate-50
  '#f1f5f9', // 1 - slate-100
  '#e2e8f0', // 2 - slate-200
  '#cbd5e1', // 3 - slate-300
  '#94a3b8', // 4 - slate-400
  '#64748b', // 5 - slate-500
  '#475569', // 6 - slate-600
  '#334155', // 7 - slate-700
  '#1e293b', // 8 - slate-800
  '#0f172a', // 9 - slate-900
];

export const theme = createTheme({
  // Use Inter as the default font (already in use)
  fontFamily: "'Inter', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', monospace",

  // Slightly smaller default radius to match existing UI
  defaultRadius: 'sm',

  // Add slate to the color palette
  colors: {
    slate,
  },

  // Use slate as primary for a neutral feel
  primaryColor: 'blue',

  // Component-specific overrides
  components: {
    Table: {
      styles: {
        table: {
          fontSize: 'var(--mantine-font-size-sm)',
        },
        th: {
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--mantine-color-slate-5)',
          backgroundColor: 'var(--mantine-color-slate-0)',
        },
        td: {
          color: 'var(--mantine-color-slate-7)',
        },
      },
    },
  },
});
