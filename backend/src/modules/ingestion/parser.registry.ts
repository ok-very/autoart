import type { ParserModule, ParserSummary } from './parser.types.js';
import { mondayParser } from './parsers/monday.parser.js';
import { airtableParser } from './parsers/airtable.parser.js';

/**
 * Registry of available parser modules.
 */
const parsers = new Map<string, ParserModule>();

/**
 * Register a parser module.
 */
export function registerParser(parser: ParserModule): void {
  parsers.set(parser.name, parser);
}

/**
 * Get a parser by name.
 */
export function getParser(name: string): ParserModule | undefined {
  return parsers.get(name);
}

/**
 * List all available parsers (summary only, for API response).
 */
export function listParsers(): ParserSummary[] {
  return Array.from(parsers.values()).map(p => ({
    name: p.name,
    version: p.version,
    description: p.description,
    configFields: p.configFields,
  }));
}

/**
 * Get all parser names.
 */
export function getParserNames(): string[] {
  return Array.from(parsers.keys());
}

// Register built-in parsers
registerParser(mondayParser);
registerParser(airtableParser);
