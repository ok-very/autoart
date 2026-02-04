import { z } from 'zod';

/**
 * Intake Form Block Schemas
 *
 * Forms are composed of blocks:
 * - ModuleBlock: Custom form elements (text, email, file upload, etc.)
 * - RecordBlock: Existing RecordDefinition loaded as a styled, read-only segment.
 *
 * @see https://github.com/ok-very/autoart/issues/93
 */

// ==================== MODULE BLOCK ====================

export const ModuleBlockTypeSchema = z.enum([
    'short_answer',
    'paragraph',
    'email',
    'phone',
    'number',
    'date',
    'time',
    'file_upload',
    'multiple_choice',
    'checkbox',
    'dropdown',
    'section_header',
    'description',
    'image',
]);

export type ModuleBlockType = z.infer<typeof ModuleBlockTypeSchema>;

export const ModuleBlockSchema = z.object({
    id: z.string().uuid(),
    kind: z.literal('module'),
    type: ModuleBlockTypeSchema,
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().default(false),
    /** For multiple_choice, checkbox, dropdown */
    options: z.array(z.string()).optional(),
    /** Placeholder text for inputs */
    placeholder: z.string().optional(),
    /** For file_upload: accepted MIME types */
    acceptedFileTypes: z.array(z.string()).optional(),
    /** For file_upload: custom endpoint override */
    uploadEndpoint: z.string().url().optional(),
});

export type ModuleBlock = z.infer<typeof ModuleBlockSchema>;

// ==================== RECORD BLOCK ====================

export const RecordBlockSchema = z.object({
    id: z.string().uuid(),
    kind: z.literal('record'),
    /** Links to an existing RecordDefinition.id */
    definitionId: z.string().uuid(),
    /** Optional label override (defaults to definition name) */
    label: z.string().optional(),
    /** If true, submission creates a new record instance */
    createInstance: z.boolean().default(true),
});

export type RecordBlock = z.infer<typeof RecordBlockSchema>;

// ==================== FORM BLOCK UNION ====================

export const FormBlockSchema = z.discriminatedUnion('kind', [
    ModuleBlockSchema,
    RecordBlockSchema,
]);

export type FormBlock = z.infer<typeof FormBlockSchema>;

// ==================== INTAKE FORM CONFIG ====================

export const IntakeFormConfigSchema = z.object({
    /** Ordered list of blocks */
    blocks: z.array(FormBlockSchema),
    /** Form-level settings */
    settings: z.object({
        /** Show progress bar */
        showProgress: z.boolean().default(false),
        /** Confirmation message after submit */
        confirmationMessage: z.string().optional(),
        /** Redirect URL after submit */
        redirectUrl: z.string().url().optional(),
    }).optional(),
});

export type IntakeFormConfig = z.infer<typeof IntakeFormConfigSchema>;

// ==================== SUBMISSION RESULT ====================

/**
 * Record created from a RecordBlock during form submission
 */
export const CreatedRecordSchema = z.object({
    definitionId: z.string().uuid(),
    recordId: z.string().uuid(),
    uniqueName: z.string(),
});

export type CreatedRecord = z.infer<typeof CreatedRecordSchema>;

/**
 * Result returned after successful form submission
 */
export const IntakeSubmissionResultSchema = z.object({
    id: z.string().uuid(),
    upload_code: z.string(),
    created_at: z.string().datetime(),
    created_records: z.array(CreatedRecordSchema).optional(),
});

export type IntakeSubmissionResult = z.infer<typeof IntakeSubmissionResultSchema>;
