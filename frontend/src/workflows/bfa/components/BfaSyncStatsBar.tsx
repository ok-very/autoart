/**
 * BfaSyncStatsBar
 *
 * Horizontal row of stat badges summarizing a BFA sync diff report.
 */

import type { BfaSyncDiffReport } from '@autoart/shared';

import { Badge, Inline } from '@autoart/ui';

interface BfaSyncStatsBarProps {
    stats: BfaSyncDiffReport['stats'];
}

export function BfaSyncStatsBar({ stats }: BfaSyncStatsBarProps) {
    return (
        <Inline gap="sm" className="flex-wrap">
            <Badge variant="neutral" size="md">
                {stats.totalChanges} changes
            </Badge>
            <Badge variant="neutral" size="md">
                {stats.projectsAffected} projects
            </Badge>
            <Badge variant="success" size="md">
                {stats.autoAccepted} auto-accepted
            </Badge>
            <Badge variant="warning" size="md">
                {stats.pendingReview} pending review
            </Badge>
            {stats.warnings > 0 && (
                <Badge variant="error" size="md">
                    {stats.warnings} warnings
                </Badge>
            )}
        </Inline>
    );
}
