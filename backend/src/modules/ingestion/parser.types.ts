import type { NodeType } from '../../db/schema.js';

/**
 * A parsed node before it's inserted into the database.
 * Uses temporary IDs for parent linking.
 */
export interface ParsedNode {
  /** Temporary ID for linking children */
  tempId: string;
  /** Parent's temp ID (null for root) */
  parentTempId: string | null;
  /** Node type in hierarchy */
  type: NodeType;
  /** Display title */
  title: string;
  /** Rich text description (TipTap JSON format) */
  description?: unknown;
  /** Flexible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of parsing input data.
 */
export interface ParsedData {
  /** Title for the root project */
  projectTitle: string;
  /** Project-level metadata extracted from input */
  projectMeta: Record<string, unknown>;
  /** All parsed nodes in hierarchical order */
  nodes: ParsedNode[];
}

/**
 * Configuration options passed to a parser.
 */
export interface ParserConfig {
  [key: string]: string | number | boolean | undefined;
}

/**
 * A parser module that can interpret raw data into structured hierarchy.
 */
export interface ParserModule {
  /** Unique identifier for the parser */
  name: string;
  /** Version string */
  version: string;
  /** Human-readable description */
  description: string;
  /** Configuration field definitions for the UI */
  configFields: ParserConfigField[];
  /** Parse raw input into structured data */
  parse(input: string, config: ParserConfig): ParsedData;
}

/**
 * Definition of a configuration field for parser UI.
 */
export interface ParserConfigField {
  key: string;
  label: string;
  type: 'text' | 'regex' | 'number' | 'boolean';
  defaultValue: string | number | boolean;
  description?: string;
}

/**
 * Summary of available parsers for the frontend.
 */
export interface ParserSummary {
  name: string;
  version: string;
  description: string;
  configFields: ParserConfigField[];
}
