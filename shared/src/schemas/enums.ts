import { z } from 'zod';

/**
 * Node type enum - defines the 5-level hierarchy
 */
export const NodeTypeSchema = z.enum(['project', 'process', 'stage', 'subprocess', 'task']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/**
 * Reference mode enum - static vs dynamic references
 */
export const RefModeSchema = z.enum(['static', 'dynamic']);
export type RefMode = z.infer<typeof RefModeSchema>;

/**
 * Field type enum - supported field types in record definitions
 */
export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'email',
  'url',
  'textarea',
  'select',
  'date',
  'checkbox',
  'link',
  'status',
  'percent',
  'user',
  'tags',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;
