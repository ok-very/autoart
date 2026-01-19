/**
 * Generate module API client.
 */

import { autohelperApi } from './autohelperClient';

// Types matches backend schemas
export interface IntakeManifestRequest {
    context_id: string;
    intake_folder: string;
    options?: Record<string, unknown>;
}

export interface ReportRequest {
    context_id: string;
    template: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
}

export interface ArtifactResponse {
    ref_id: string;
    path: string;
    artifact_type: string;
}

export const generateIntakeManifest = async (req: IntakeManifestRequest): Promise<ArtifactResponse> => {
    return autohelperApi.post<ArtifactResponse>('/generate/intake-manifest', req);
};

export const generateReport = async (req: ReportRequest): Promise<ArtifactResponse> => {
    return autohelperApi.post<ArtifactResponse>('/generate/report', req);
};
