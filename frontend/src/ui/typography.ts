/**
 * Typography Tokens
 *
 * Centralized type-scale tokens using workspace CSS variables.
 * Sizes and weights per docs/DESIGN.md.
 *
 * Usage:
 *   import { type, uiType, monoType } from '../ui/typography';
 *   <h1 className={type.h1}>Page Title</h1>
 *   <span className={uiType.label}>Button</span>
 */

/** Content typography — Source Serif 4 */
export const type = {
  h1: 'text-[20px] font-semibold leading-[1.45] tracking-serif text-ws-fg font-serif',
  h2: 'text-[16px] font-semibold leading-[1.45] tracking-serif text-ws-fg font-serif',
  body: 'text-[14px] font-normal leading-[1.5] tracking-serif text-ws-fg font-serif',
  bodySecondary: 'text-[14px] font-normal leading-[1.5] tracking-serif text-ws-text-secondary font-serif',
  metadata: 'text-[12px] font-normal leading-[1.5] tracking-serif text-ws-text-disabled font-serif',
  microcopy: 'text-[11px] font-normal leading-[1.5] tracking-serif text-ws-text-disabled font-serif',
} as const;

/** UI chrome typography — Source Sans 3 */
export const uiType = {
  label: 'text-[14px] font-normal leading-[1.5] tracking-sans text-ws-fg font-sans',
  labelSecondary: 'text-[14px] font-normal leading-[1.5] tracking-sans text-ws-text-secondary font-sans',
  small: 'text-[12px] font-normal leading-[1.5] tracking-sans text-ws-text-secondary font-sans',
  micro: 'text-[11px] font-normal leading-[1.5] tracking-sans text-ws-text-disabled font-sans',
} as const;

/** Console typography — IBM Plex Mono */
export const monoType = {
  console: 'text-[13px] font-normal leading-[1.4] tracking-mono text-ws-muted font-mono',
} as const;
