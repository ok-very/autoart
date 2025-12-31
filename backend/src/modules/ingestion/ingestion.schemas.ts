import { z } from 'zod';

export const previewIngestionSchema = z.object({
  parserName: z.string().min(1, 'Parser name is required'),
  rawData: z.string().min(1, 'Raw data is required'),
  config: z.record(z.unknown()).optional(),
});

export const runIngestionSchema = z.object({
  parserName: z.string().min(1, 'Parser name is required'),
  rawData: z.string().min(1, 'Raw data is required'),
  config: z.record(z.unknown()).optional(),
  targetProjectId: z.string().uuid().optional().nullable(),
});

export type PreviewIngestionInput = z.infer<typeof previewIngestionSchema>;
export type RunIngestionInput = z.infer<typeof runIngestionSchema>;
