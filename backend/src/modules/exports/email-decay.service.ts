/**
 * Email Decay Detection Service
 *
 * Detects projects with unanswered emails or stale communication.
 * Suggests follow-up actions based on email activity.
 */

import type { EmailDecayInfo } from './types.js';
import { db } from '../../db/client.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Detect email decay for a project.
 * Checks for sent emails without replies and suggests follow-ups.
 * 
 * @param projectId - Project ID to analyze
 * @returns Email decay information with suggestions
 */
export async function detectEmailDecay(
    projectId: string
): Promise<EmailDecayInfo> {
    const decayThresholdDays = 7;

    // Query INFORMATION_SENT events (email tracking)
    const sentEvents = await db
        .selectFrom('events')
        .select(['id', 'occurred_at', 'payload'])
        .where('context_id', '=', projectId)
        .where('type', '=', 'FACT_RECORDED')
        .execute();

    // Filter to emails only
    const emailEvents = sentEvents.filter(e => {
        try {
            const payload = typeof e.payload === 'string'
                ? JSON.parse(e.payload)
                : e.payload;
            return payload?.factKind === 'INFORMATION_SENT' ||
                payload?.kind === 'INFORMATION_SENT';
        } catch {
            return false;
        }
    });

    if (emailEvents.length === 0) {
        return {
            projectId,
            lastEmailDate: undefined,
            hasReply: false,
            daysSinceEmail: undefined,
            suggestFollowup: false,
        };
    }

    // Get most recent outbound email
    const latestEmail = emailEvents.reduce((latest, current) =>
        current.occurred_at > latest.occurred_at ? current : latest
    );

    const lastEmailDate = latestEmail.occurred_at;
    const now = new Date();
    const daysSinceEmail = Math.floor(
        (now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check for reply events within window
    const replyEvents = await db
        .selectFrom('events')
        .select(['occurred_at'])
        .where('context_id', '=', projectId)
        .where('occurred_at', '>', lastEmailDate)
        .where('type', '=', 'FACT_RECORDED')
        .execute();

    // Simple heuristic: any event after email = potential reply
    const hasReply = replyEvents.length > 0;

    // Suggest follow-up if no reply and past threshold
    const suggestFollowup = !hasReply && daysSinceEmail > decayThresholdDays;

    // Generate suggested action
    let suggestedAction: string | undefined;
    if (suggestFollowup) {
        if (daysSinceEmail > 14) {
            suggestedAction = `Email sent ${daysSinceEmail} days ago with no reply. Consider escalating or checking in.`;
        } else if (daysSinceEmail > 7) {
            suggestedAction = `Follow up on email sent ${daysSinceEmail} days ago.`;
        } else {
            suggestedAction = `Email sent recently (${daysSinceEmail} days), monitor for reply.`;
        }
    }

    return {
        projectId,
        lastEmailDate,
        hasReply,
        daysSinceEmail,
        suggestFollowup,
        suggestedAction,
    };
}

/**
 * Detect email decay for multiple projects.
 */
export async function detectEmailDecayBatch(
    projectIds: string[]
): Promise<EmailDecayInfo[]> {
    const results: EmailDecayInfo[] = [];

    for (const projectId of projectIds) {
        const info = await detectEmailDecay(projectId);
        results.push(info);
    }

    return results;
}

/**
 * Get projects needing follow-up (convenience filter).
 */
export async function getProjectsNeedingFollowup(
    projectIds: string[]
): Promise<EmailDecayInfo[]> {
    const all = await detectEmailDecayBatch(projectIds);
    return all.filter(p => p.suggestFollowup);
}

/**
 * Get email activity summary.
 */
export async function getEmailActivitySummary(
    projectIds: string[]
): Promise<{
    total: number;
    withEmails: number;
    needingFollowup: number;
    averageDaysSinceEmail: number;
}> {
    const all = await detectEmailDecayBatch(projectIds);
    const withEmails = all.filter(p => p.lastEmailDate);
    const needingFollowup = all.filter(p => p.suggestFollowup);

    const avgDays = withEmails.length > 0
        ? Math.round(
            withEmails.reduce((sum, p) => sum + (p.daysSinceEmail ?? 0), 0) / withEmails.length
        )
        : 0;

    return {
        total: all.length,
        withEmails: withEmails.length,
        needingFollowup: needingFollowup.length,
        averageDaysSinceEmail: avgDays,
    };
}
