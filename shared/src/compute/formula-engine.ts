/**
 * Formula Engine — Shared compute module
 *
 * Evaluates mathematical expressions with #reference support.
 * Currency-aware: all currency arithmetic uses integer minor units (cents).
 * Includes cycle detection for computed field dependency graphs.
 *
 * Supported operations: + - * / ( )
 * Reference syntax: #fieldKey or #{field.path}
 *
 * Example formulas:
 * - "100 + 50"                    → 150
 * - "#qty * #unit_price"          → qty × unit_price (integer cents)
 * - "(#phase1 + #phase2) / 2"    → average of two phases
 */

// ============================================================================
// TYPES
// ============================================================================

type TokenType = 'number' | 'reference' | 'operator' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string | number;
  raw: string;
}

/**
 * Reference resolver function type.
 * Given a field key, returns its numeric value or null if not found.
 */
export type ReferenceResolver = (fieldKey: string) => number | null;

/**
 * Formula evaluation result.
 */
export interface FormulaValue {
  expression: string;
  resolvedValue: number | null;
  references: string[];
  error?: string;
}

// ============================================================================
// TOKENIZER
// ============================================================================

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        numStr += formula[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'number', value: num, raw: numStr });
      continue;
    }

    // Reference: #fieldKey or #{field.path}
    if (char === '#') {
      i++;
      let refKey = '';

      if (formula[i] === '{') {
        i++;
        while (i < formula.length && formula[i] !== '}') {
          refKey += formula[i];
          i++;
        }
        if (formula[i] !== '}') {
          throw new Error('Unclosed reference: missing }');
        }
        i++;
      } else {
        while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
          refKey += formula[i];
          i++;
        }
      }

      if (!refKey) {
        throw new Error('Empty reference');
      }

      tokens.push({ type: 'reference', value: refKey, raw: `#${refKey}` });
      continue;
    }

    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char, raw: char });
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', value: '(', raw: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: ')', raw: ')' });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  return tokens;
}

// ============================================================================
// PARSER (recursive descent)
// ============================================================================

/**
 * Grammar:
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → NUMBER | REFERENCE | '(' expr ')' | ('-' | '+') factor
 */
class Parser {
  private pos = 0;
  private references = new Set<string>();

  constructor(
    private tokens: Token[],
    private resolver: ReferenceResolver,
  ) {}

  parse(): { value: number; references: string[] } {
    const value = this.expr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.tokens[this.pos].raw}`);
    }
    return { value, references: Array.from(this.references) };
  }

  private peek(): Token | null {
    return this.tokens[this.pos] || null;
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expr(): number {
    let left = this.term();

    while (
      this.peek()?.type === 'operator' &&
      (this.peek()?.value === '+' || this.peek()?.value === '-')
    ) {
      const op = this.consume().value as string;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  private term(): number {
    let left = this.factor();

    while (
      this.peek()?.type === 'operator' &&
      (this.peek()?.value === '*' || this.peek()?.value === '/')
    ) {
      const op = this.consume().value as string;
      const right = this.factor();
      if (op === '/' && right === 0) {
        throw new Error('Division by zero');
      }
      left = op === '*' ? left * right : left / right;
    }

    return left;
  }

  private factor(): number {
    const token = this.peek();

    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    // Unary minus
    if (token.type === 'operator' && token.value === '-') {
      this.consume();
      return -this.factor();
    }

    // Unary plus
    if (token.type === 'operator' && token.value === '+') {
      this.consume();
      return this.factor();
    }

    if (token.type === 'number') {
      this.consume();
      return token.value as number;
    }

    if (token.type === 'reference') {
      this.consume();
      const refKey = token.value as string;
      this.references.add(refKey);
      const resolved = this.resolver(refKey);
      if (resolved === null) {
        throw new Error(`Unresolved reference: #${refKey}`);
      }
      return resolved;
    }

    if (token.type === 'lparen') {
      this.consume();
      const value = this.expr();
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error('Missing closing parenthesis');
      }
      this.consume();
      return value;
    }

    throw new Error(`Unexpected token: ${token.raw}`);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Evaluate a formula expression.
 *
 * @param expression - Formula string (e.g., "#qty * #unit_price")
 * @param resolver - Function to resolve #reference values to numbers
 */
export function evaluateFormula(
  expression: string,
  resolver: ReferenceResolver,
): FormulaValue {
  const result: FormulaValue = {
    expression,
    resolvedValue: null,
    references: [],
  };

  if (!expression || !expression.trim()) {
    return result;
  }

  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return result;
    }

    const parser = new Parser(tokens, resolver);
    const { value, references } = parser.parse();

    result.resolvedValue = value;
    result.references = references;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Evaluation error';
  }

  return result;
}

/**
 * Extract all references from a formula without evaluating.
 * Useful for dependency tracking and cycle detection.
 */
export function extractReferences(expression: string): string[] {
  if (!expression) return [];

  const refs: string[] = [];
  const regex = /#\{([^}]+)\}|#([a-zA-Z0-9_]+)/g;
  let match;

  while ((match = regex.exec(expression)) !== null) {
    refs.push(match[1] || match[2]);
  }

  return refs;
}

/**
 * Check if a string contains formula syntax.
 */
export function isFormula(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('#') || /\d\s*[+\-*/]\s*\d/.test(value);
}

/**
 * Format a computed numeric value for display.
 */
export function formatFormulaDisplay(formulaValue: FormulaValue): string {
  if (formulaValue.error) {
    return `Error: ${formulaValue.error}`;
  }
  if (formulaValue.resolvedValue !== null) {
    const num = formulaValue.resolvedValue;
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return formulaValue.expression || '';
}

/**
 * Create a resolver from a record data object.
 * Supports dot notation for nested paths.
 */
export function createRecordResolver(
  data: Record<string, unknown>,
): ReferenceResolver {
  return (fieldKey: string): number | null => {
    const parts = fieldKey.split('.');
    let value: unknown = data;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'object') return null;
      value = (value as Record<string, unknown>)[part];
    }

    // Currency field: extract amount from { amount, currency } structure
    if (typeof value === 'object' && value !== null && 'amount' in value) {
      const amt = (value as { amount: unknown }).amount;
      if (typeof amt === 'number') return amt;
      if (typeof amt === 'string') { const n = Number(amt); return isNaN(n) ? null : n; }
      return null;
    }

    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  };
}

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

/**
 * Currency value stored as integer minor units (cents).
 * Avoids IEEE 754 float issues. Same approach as Stripe.
 */
export interface CurrencyValue {
  /** Amount in minor units (cents). 15000 = $150.00 */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
}

/**
 * Format a currency value for display.
 * Converts integer cents to formatted string.
 */
export function formatCurrency(value: CurrencyValue, locale?: string): string {
  const major = value.amount / 100;
  return new Intl.NumberFormat(locale ?? 'en-CA', {
    style: 'currency',
    currency: value.currency,
  }).format(major);
}

/**
 * Parse a display string into minor units.
 * "150.00" → 15000, "1,234.56" → 123456
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ============================================================================
// CYCLE DETECTION
// ============================================================================

/**
 * Detect circular dependencies in a set of computed field formulas.
 * Returns the set of field keys involved in cycles (empty if none).
 *
 * @param fieldFormulas - Map of field key → formula expression
 */
export function detectCycles(fieldFormulas: Map<string, string>): Set<string> {
  const graph = new Map<string, string[]>();

  for (const [key, formula] of fieldFormulas) {
    graph.set(key, extractReferences(formula));
  }

  const cycleNodes = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      cycleNodes.add(node);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (dfs(dep)) {
        cycleNodes.add(node);
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const key of graph.keys()) {
    dfs(key);
  }

  return cycleNodes;
}
