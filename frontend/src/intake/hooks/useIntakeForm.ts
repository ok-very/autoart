/**
 * useIntakeForm - React Hook Form + Zod integration for intake forms
 *
 * Builds a dynamic Zod schema based on the form blocks configuration
 * and provides submission handling with validation.
 */

import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, ZodTypeAny } from 'zod';
import { useState, useMemo } from 'react';
import type { FormBlock, ModuleBlock, IntakeFormConfig } from '@autoart/shared';
import type { SubmissionResult } from '../api';

// Re-export from api.ts to maintain single source of truth
export type SubmissionResultData = SubmissionResult;

type UseIntakeFormReturn = {
    rhf: UseFormReturn<Record<string, unknown>>;
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
    isSubmitting: boolean;
    submitError?: string;
    isSubmitted: boolean;
    submissionResult?: SubmissionResultData;
};

/**
 * Build a Zod schema for a single module block based on its type
 */
function buildBlockSchema(block: ModuleBlock): ZodTypeAny {
    let field: ZodTypeAny;

    switch (block.type) {
        case 'short_answer':
        case 'paragraph':
            field = z.string();
            break;
        case 'email':
            field = z.string().email('Invalid email address');
            break;
        case 'phone':
            field = z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number');
            break;
        case 'number':
            field = z.preprocess(
                (val) => (val === '' ? undefined : Number(val)),
                z.number()
            );
            break;
        case 'date':
            field = z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
                message: 'Invalid date',
            });
            break;
        case 'time':
            field = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
                message: 'Invalid time (HH:MM)',
            });
            break;
        case 'file_upload':
            // File uploads store the uploaded URL string
            field = z.string().url('File upload required');
            break;
        case 'multiple_choice':
        case 'dropdown':
            if (block.options && block.options.length > 0) {
                field = z.enum(block.options as [string, ...string[]]);
            } else {
                field = z.string();
            }
            break;
        case 'checkbox':
            if (block.options && block.options.length > 0) {
                field = z.array(z.enum(block.options as [string, ...string[]]));
            } else {
                field = z.array(z.string());
            }
            break;
        case 'section_header':
        case 'description':
        case 'image':
            // Static blocks don't collect input
            return z.any().optional();
        default:
            field = z.string();
    }

    // Optional fields if not required
    if (!block.required) {
        // Make the field optional (allow empty string or undefined)
        if (field instanceof z.ZodString) {
            field = field.optional().or(z.literal(''));
        } else {
            field = field.optional();
        }
    }

    return field;
}

/**
 * Build a complete Zod schema from all form blocks
 */
function buildFormSchema(blocks: FormBlock[]): z.ZodObject<Record<string, ZodTypeAny>> {
    const shape: Record<string, ZodTypeAny> = {};

    for (const block of blocks) {
        if (block.kind === 'module') {
            shape[block.id] = buildBlockSchema(block);
        }
        // Record blocks are read-only - we don't collect input for them
        // Future: If createInstance is true, we might store the definitionId
    }

    return z.object(shape);
}

interface UseIntakeFormOptions {
    config: IntakeFormConfig;
    onSubmitSuccess?: (result: SubmissionResultData, data: Record<string, unknown>) => void;
    submitFn: (data: Record<string, unknown>) => Promise<SubmissionResultData>;
}

export function useIntakeForm({
    config,
    onSubmitSuccess,
    submitFn,
}: UseIntakeFormOptions): UseIntakeFormReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionResult, setSubmissionResult] = useState<SubmissionResultData | undefined>(undefined);

    // Build schema from blocks (memoized)
    const schema = useMemo(() => buildFormSchema(config.blocks), [config.blocks]);

    const rhf = useForm<Record<string, unknown>>({
        resolver: zodResolver(schema),
        mode: 'onBlur',
        defaultValues: {},
    });

    const onSubmit = async (data: Record<string, unknown>) => {
        setIsSubmitting(true);
        setSubmitError(undefined);

        try {
            const result = await submitFn(data);
            setSubmissionResult(result);
            setIsSubmitted(true);
            onSubmitSuccess?.(result, data);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Submission failed';
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return { rhf, onSubmit, isSubmitting, submitError, isSubmitted, submissionResult };
}
