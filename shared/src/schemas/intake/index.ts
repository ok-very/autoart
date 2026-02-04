/**
 * Intake Schemas - Zod schemas for form generator and public forms
 *
 * @see https://github.com/ok-very/autoart/issues/95
 */

import { z } from 'zod';
import { FormBlockSchema, RecordMappingSchema } from '../../intake/schemas.js';

export {
  ModuleBlockTypeSchema,
  ModuleBlockSchema,
  RecordBlockSchema,
  FormBlockSchema,
  IntakeFormConfigSchema,
  RecordMappingSchema,
  FieldMappingSchema,
  type ModuleBlockType,
  type ModuleBlock,
  type RecordBlock,
  type FormBlock,
  type IntakeFormConfig,
  type RecordMapping,
  type FieldMapping,
} from '../../intake/schemas.js';

// ==================== ENUMS ====================

export const IntakeFormStatusSchema = z.enum(['active', 'disabled']);
export type IntakeFormStatus = z.infer<typeof IntakeFormStatusSchema>;

// ==================== PAGE CONFIG ====================

/**
 * Page settings - optional configuration for a form page.
 * Includes both page-level settings and form-level settings.
 */
export const IntakePageSettingsSchema = z.object({
  /** Page title shown at top of page */
  pageTitle: z.string().optional(),
  /** Show progress bar */
  showProgress: z.boolean().optional(),
  /** Confirmation message after submit */
  confirmationMessage: z.string().optional(),
  /** Redirect URL after submit */
  redirectUrl: z.string().url().optional(),
});
export type IntakePageSettings = z.infer<typeof IntakePageSettingsSchema>;

/**
 * Form settings - subset of page settings used in settings panel.
 */
export interface FormSettings {
  showProgress: boolean;
  confirmationMessage?: string;
  redirectUrl?: string;
}

/**
 * Page config - the content structure for a form page.
 * Contains an array of FormBlocks (ModuleBlock | RecordBlock).
 */
export const IntakePageConfigSchema = z.object({
  blocks: z.array(FormBlockSchema),
  /** Record mappings: connect form blocks to record fields */
  recordMappings: z.array(RecordMappingSchema).optional(),
  settings: IntakePageSettingsSchema.optional(),
});
export type IntakePageConfig = z.infer<typeof IntakePageConfigSchema>;

// ==================== FORM DTOs ====================

/**
 * Intake form - the parent entity for a multi-page form.
 */
export const IntakeFormSchema = z.object({
  id: z.string().uuid(),
  unique_id: z.string().min(1),
  title: z.string().min(1),
  status: IntakeFormStatusSchema,
  sharepoint_request_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
});
export type IntakeForm = z.infer<typeof IntakeFormSchema>;

/**
 * Form page - a single page within a multi-page form.
 */
export const IntakeFormPageSchema = z.object({
  id: z.string().uuid(),
  form_id: z.string().uuid(),
  page_index: z.number().int().min(0),
  blocks_config: IntakePageConfigSchema,
});
export type IntakeFormPage = z.infer<typeof IntakeFormPageSchema>;

/**
 * Form with pages - full form with all pages included.
 */
export const IntakeFormWithPagesSchema = IntakeFormSchema.extend({
  pages: z.array(IntakeFormPageSchema),
});
export type IntakeFormWithPages = z.infer<typeof IntakeFormWithPagesSchema>;

// ==================== SUBMISSION DTOs ====================

/**
 * Submission metadata - flexible JSONB structure for form data.
 */
export const SubmissionMetadataSchema = z.record(z.string(), z.unknown());
export type SubmissionMetadata = z.infer<typeof SubmissionMetadataSchema>;

/**
 * Intake submission - a user's form submission.
 */
export const IntakeSubmissionSchema = z.object({
  id: z.string().uuid(),
  form_id: z.string().uuid(),
  upload_code: z.string().min(1),
  metadata: SubmissionMetadataSchema,
  created_at: z.string().datetime(),
});
export type IntakeSubmission = z.infer<typeof IntakeSubmissionSchema>;

// ==================== API INPUT SCHEMAS ====================

/**
 * Create form input
 */
export const CreateIntakeFormInputSchema = z.object({
  title: z.string().min(1).max(200),
  sharepoint_request_url: z.string().url().optional(),
});
export type CreateIntakeFormInput = z.infer<typeof CreateIntakeFormInputSchema>;

/**
 * Update form input
 */
export const UpdateIntakeFormInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: IntakeFormStatusSchema.optional(),
  sharepoint_request_url: z.string().url().nullable().optional(),
});
export type UpdateIntakeFormInput = z.infer<typeof UpdateIntakeFormInputSchema>;

/**
 * Create/update page input
 */
export const UpsertIntakeFormPageInputSchema = z.object({
  page_index: z.number().int().min(0),
  blocks_config: IntakePageConfigSchema,
});
export type UpsertIntakeFormPageInput = z.infer<typeof UpsertIntakeFormPageInputSchema>;

/**
 * Create submission input (public API)
 */
export const CreateIntakeSubmissionInputSchema = z.object({
  metadata: SubmissionMetadataSchema,
});
export type CreateIntakeSubmissionInput = z.infer<typeof CreateIntakeSubmissionInputSchema>;

// ==================== API RESPONSE SCHEMAS ====================

export const IntakeFormResponseSchema = z.object({
  form: IntakeFormSchema,
});
export type IntakeFormResponse = z.infer<typeof IntakeFormResponseSchema>;

export const IntakeFormsResponseSchema = z.object({
  forms: z.array(IntakeFormSchema),
});
export type IntakeFormsResponse = z.infer<typeof IntakeFormsResponseSchema>;

export const IntakeFormWithPagesResponseSchema = z.object({
  form: IntakeFormWithPagesSchema,
});
export type IntakeFormWithPagesResponse = z.infer<typeof IntakeFormWithPagesResponseSchema>;

export const IntakeSubmissionResponseSchema = z.object({
  submission: IntakeSubmissionSchema,
});
export type IntakeSubmissionResponse = z.infer<typeof IntakeSubmissionResponseSchema>;

export const IntakeSubmissionsResponseSchema = z.object({
  submissions: z.array(IntakeSubmissionSchema),
});
export type IntakeSubmissionsResponse = z.infer<typeof IntakeSubmissionsResponseSchema>;
