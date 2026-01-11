/**
 * Backfeeding Service
 *
 * Analyzes existing Google Docs to match projects already exported.
 * Provides context for avoiding duplicates and maintaining continuity.
 * 
 * Architecture:
 * - Connector returns raw DocumentAnalysis (parsed headers from doc)
 * - This service transforms it into domain BackfeedAnalysis (with DB matches)
 */

import { GoogleDocsConnector, type ParsedProjectHeader } from './connectors/google-docs-connector.js';
import type { BackfeedAnalysis, BackfeedMatch } from './types.js';
import { db } from '../../db/client.js';
import { getGoogleToken } from '../imports/connections.service.js';

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Simple fuzzy string match score (0-100).
 * Uses Levenshtein distance normalized to percentage.
 */
function fuzzyMatch(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    // Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return Math.round((1 - distance / maxLen) * 100);
}

// ============================================================================
// INTERNAL: MATCH HEADERS TO DB
// ============================================================================

/**
 * Match parsed headers against database projects.
 */
async function matchHeadersToProjects(
    headers: ParsedProjectHeader[]
): Promise<BackfeedMatch[]> {
    const results: BackfeedMatch[] = [];

    // Get all projects from database
    const projects = await db
        .selectFrom('hierarchy_nodes')
        .select(['id', 'title', 'metadata'])
        .where('type', '=', 'project')
        .execute();

    // Match each header against database projects
    for (const [index, header] of headers.entries()) {
        let bestMatch: BackfeedMatch = {
            docProjectIndex: index,
            matchedProjectId: null,
            matchScore: 0,
            clientName: header.clientName,
            projectName: header.projectName,
        };

        for (const project of projects) {
            let score = 0;
            let matchCount = 0;

            // Match project name
            if (header.projectName && project.title) {
                const nameScore = fuzzyMatch(header.projectName, project.title);
                score += nameScore;
                matchCount++;
            }

            // Match client name from metadata
            if (header.clientName && project.metadata && typeof project.metadata === 'object') {
                const meta = project.metadata as Record<string, unknown>;
                if (meta.clientName && typeof meta.clientName === 'string') {
                    const clientScore = fuzzyMatch(header.clientName, meta.clientName);
                    score += clientScore;
                    matchCount++;
                }
            }

            // Match location
            if (header.location && project.metadata && typeof project.metadata === 'object') {
                const meta = project.metadata as Record<string, unknown>;
                if (meta.location && typeof meta.location === 'string') {
                    const locationScore = fuzzyMatch(header.location, meta.location);
                    score += locationScore * 0.5; // Lower weight
                    matchCount += 0.5;
                }
            }

            const avgScore = matchCount > 0 ? Math.round(score / matchCount) : 0;

            if (avgScore > bestMatch.matchScore) {
                bestMatch = {
                    docProjectIndex: index,
                    matchedProjectId: project.id,
                    matchScore: avgScore,
                    clientName: header.clientName,
                    projectName: header.projectName,
                };
            }
        }

        results.push(bestMatch);
    }

    return results;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze an existing Google Doc for backfeeding.
 * 
 * Fetches doc via connector, matches headers to DB projects,
 * and returns domain BackfeedAnalysis.
 */
export async function analyzeExistingDoc(
    docId: string,
    userId?: string
): Promise<BackfeedAnalysis> {
    const token = await getGoogleToken(userId);
    const connector = new GoogleDocsConnector({ accessToken: token });

    // Get raw document analysis from connector
    const docAnalysis = await connector.analyzeDocument(docId);

    // Match parsed headers to database projects
    const matches = await matchHeadersToProjects(docAnalysis.projectHeaders);

    // Build domain BackfeedAnalysis
    const highConfidenceIds = matches
        .filter(m => m.matchScore >= 70 && m.matchedProjectId)
        .map(m => m.matchedProjectId!)
        .filter(Boolean);

    const orderedIds = matches
        .filter(m => m.matchedProjectId)
        .map(m => m.matchedProjectId!)
        .filter(Boolean);

    return {
        docId: docAnalysis.docId,
        matches,
        existingProjectIds: highConfidenceIds,
        suggestedOrder: orderedIds,
    };
}

/**
 * Get projects already in doc (filtered by high match scores).
 */
export async function getExistingProjectIds(
    matches: BackfeedMatch[],
    threshold: number = 70
): Promise<string[]> {
    return matches
        .filter(m => m.matchScore >= threshold && m.matchedProjectId)
        .map(m => m.matchedProjectId!)
        .filter(Boolean);
}

/**
 * Get suggested project ordering based on doc structure.
 */
export async function getSuggestedOrdering(
    matches: BackfeedMatch[]
): Promise<string[]> {
    return matches
        .filter(m => m.matchedProjectId)
        .map(m => m.matchedProjectId!)
        .filter(Boolean);
}
