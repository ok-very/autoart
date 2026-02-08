/**
 * Type declarations for JsonLogic rules.
 * No @types/json-logic-js package exists; ambient module declaration
 * is in json-logic-ambient.d.ts.
 */

/** A JsonLogic rule — recursive JSON structure */
export type JsonLogicRule =
  | { [operator: string]: JsonLogicRule | JsonLogicRule[] | string | number | boolean | null }
  | string
  | number
  | boolean
  | null;
