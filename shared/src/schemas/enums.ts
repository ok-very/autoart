import { z } from 'zod';

/**
 * Node type enum - defines the 5-level hierarchy
 */
export const NodeTypeSchema = z.enum(['project', 'process', 'stage', 'subprocess', 'task']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

/**
 * Reference mode enum - static vs dynamic references
 * Used for input when creating/updating references
 */
export const RefModeSchema = z.enum(['static', 'dynamic']);
export type RefMode = z.infer<typeof RefModeSchema>;

/**
 * Reference status enum - the 4 possible states of a resolved reference
 * - unresolved: Target record/field not set
 * - dynamic: Live value from source
 * - static: Fixed snapshot value
 * - broken: Target record/field no longer exists
 */
export const ReferenceStatusSchema = z.enum(['unresolved', 'dynamic', 'static', 'broken']);
export type ReferenceStatus = z.infer<typeof ReferenceStatusSchema>;

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
