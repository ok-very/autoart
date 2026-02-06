import { z } from 'zod';

/**
 * Intake Form Block Schemas
 *
 * Forms are composed of ModuleBlocks — custom form elements (text, email, file upload, etc.).
 * Each block can optionally bind to a record definition field via BlockRecordBinding.
 *
 * @see https://github.com/ok-very/autoart/issues/93
 */

// ==================== BLOCK RECORD BINDING ====================

/**
 * Per-block binding to a record definition field.
 * When present, the block's submitted value populates the bound field
 * on a record created (or linked) during submission.
 */
export const BlockRecordBindingSchema = z.object({
    mode: z.enum(['create', 'link']),
    definitionId: z.string().uuid(),
    fieldKey: z.string(),
    /** For 'link' mode: which field on target definition to auto-match against */
    linkMatchField: z.string().optional(),
    /** Blocks sharing a groupKey produce/update a single record */
    groupKey: z.string().optional(),
});

export type BlockRecordBinding = z.infer<typeof BlockRecordBindingSchema>;

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
    /** Optional binding to a record definition field */
    recordBinding: BlockRecordBindingSchema.optional(),
});

export type ModuleBlock = z.infer<typeof ModuleBlockSchema>;

// ==================== FORM BLOCK ====================

/**
 * FormBlock is now just ModuleBlock — RecordBlock has been removed.
 * Kept as a named type for API compatibility.
 */
export const FormBlockSchema = ModuleBlockSchema;

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
 * Record created from block bindings during form submission
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
