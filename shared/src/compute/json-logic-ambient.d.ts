/**
 * Ambient module declaration for json-logic-js.
 * This file has no top-level exports so it acts as a global declaration.
 */

declare module 'json-logic-js' {
  const jsonLogic: {
    apply(rule: unknown, data?: Record<string, unknown>): unknown;
  };
  export default jsonLogic;
}
