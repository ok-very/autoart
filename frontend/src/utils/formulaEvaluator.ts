/**
 * Formula Evaluator
 *
 * Evaluates simple mathematical expressions with #reference support.
 *
 * Supported operations: + - * / ( )
 * Reference syntax: #fieldKey or #{field.path}
 *
 * Example formulas:
 * - "100 + 50"                    → 150
 * - "#project_budget * 0.15"      → evaluates project_budget * 0.15
 * - "(#phase1 + #phase2) / 2"     → average of two phases
 */

/**
 * Token types for the formula lexer
 */
type TokenType = 'number' | 'reference' | 'operator' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string | number;
  raw: string;
}

/**
 * Reference resolver function type
 * Given a field key, returns its numeric value or null if not found
 */
export type ReferenceResolver = (fieldKey: string) => number | null;

/**
 * Formula value - stores both the expression and resolved references
 */
export interface FormulaValue {
  expression: string;
  resolvedValue: number | null;
  references: string[];
  error?: string;
}

/**
 * Parse a formula string into tokens
 */
function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    // Skip whitespace
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
      i++; // consume #
      let refKey = '';

      if (formula[i] === '{') {
        // Braced reference: #{field.path}
        i++; // consume {
        while (i < formula.length && formula[i] !== '}') {
          refKey += formula[i];
          i++;
        }
        if (formula[i] !== '}') {
          throw new Error('Unclosed reference: missing }');
        }
        i++; // consume }
      } else {
        // Simple reference: #fieldKey (alphanumeric and underscore)
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

    // Operators
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char, raw: char });
      i++;
      continue;
    }

    // Parentheses
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

/**
 * Simple recursive descent parser for arithmetic expressions
 * Grammar:
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → NUMBER | REFERENCE | '(' expr ')'
 */
class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private resolver: ReferenceResolver;
  private references: Set<string> = new Set();

  constructor(tokens: Token[], resolver: ReferenceResolver) {
    this.tokens = tokens;
    this.resolver = resolver;
  }

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

    while (this.peek()?.type === 'operator' &&
           (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.consume().value as string;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  private term(): number {
    let left = this.factor();

    while (this.peek()?.type === 'operator' &&
           (this.peek()?.value === '*' || this.peek()?.value === '/')) {
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

    // Handle unary minus
    if (token.type === 'operator' && token.value === '-') {
      this.consume();
      return -this.factor();
    }

    // Handle unary plus
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

/**
 * Evaluate a formula expression
 *
 * @param expression - The formula string (e.g., "#budget * 0.15 + 100")
 * @param resolver - Function to resolve #reference values to numbers
 * @returns FormulaValue with expression, resolved value, references, and any error
 */
export function evaluateFormula(
  expression: string,
  resolver: ReferenceResolver
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
 * Extract all references from a formula without evaluating
 * Useful for dependency tracking
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
 * Check if a string contains formula syntax
 */
export function isFormula(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('#') || /[+\-*/()]/.test(value);
}

/**
 * Format a formula value for display
 * Shows the computed value, or the expression if not resolved
 */
export function formatFormulaDisplay(formulaValue: FormulaValue): string {
  if (formulaValue.error) {
    return `Error: ${formulaValue.error}`;
  }
  if (formulaValue.resolvedValue !== null) {
    // Format number with reasonable precision
    const num = formulaValue.resolvedValue;
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return formulaValue.expression || '';
}

/**
 * Create a simple resolver from a record data object
 * Looks up field values in the data, supporting nested paths with dot notation
 */
export function createRecordResolver(
  data: Record<string, unknown>
): ReferenceResolver {
  return (fieldKey: string): number | null => {
    // Support dot notation for nested paths
    const parts = fieldKey.split('.');
    let value: unknown = data;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'object') return null;
      value = (value as Record<string, unknown>)[part];
    }

    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  };
}
