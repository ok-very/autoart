/**
 * FactKindReviewPanel
 *
 * Lightweight Definition Review UI for managing fact kind definitions.
 * Shows fact kinds that need review with approve/deprecate actions.
 */

import { useState } from 'react';
import {
    useFactKindDefinitions,
    useFactKindStats,
    useApproveFactKind,
    useDeprecateFactKind,
    type FactKindDefinition,
} from '../../api/hooks';
import './FactKindReviewPanel.css';

interface FactKindReviewPanelProps {
    /** Show only items needing review */
    showOnlyNeedsReview?: boolean;
}

export function FactKindReviewPanel({
    showOnlyNeedsReview = false,
}: FactKindReviewPanelProps) {
    const [filter, setFilter] = useState<'all' | 'review' | 'known'>('review');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data: stats } = useFactKindStats();
    const { data: factKinds, isLoading, error } = useFactKindDefinitions(
        filter === 'review'
            ? { needsReview: true }
            : filter === 'known'
                ? { needsReview: false }
                : undefined
    );

    const approveMutation = useApproveFactKind();
    const deprecateMutation = useDeprecateFactKind();

    const handleApprove = async (factKind: string) => {
        await approveMutation.mutateAsync({ factKind });
    };

    const handleDeprecate = async (factKind: string) => {
        await deprecateMutation.mutateAsync({ factKind });
    };

    if (isLoading) {
        return (
            <div className="fact-kind-review-panel">
                <div className="fkrp-loading">Loading fact kinds...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fact-kind-review-panel">
                <div className="fkrp-error">Failed to load fact kinds</div>
            </div>
        );
    }

    return (
        <div className="fact-kind-review-panel">
            <header className="fkrp-header">
                <h2>Fact Kind Definitions</h2>
                {stats && (
                    <div className="fkrp-stats">
                        <span className="stat total">{stats.total} total</span>
                        <span className="stat review">{stats.needsReview} needs review</span>
                        <span className="stat known">{stats.known} known</span>
                    </div>
                )}
            </header>

            {!showOnlyNeedsReview && (
                <nav className="fkrp-filters">
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={filter === 'review' ? 'active' : ''}
                        onClick={() => setFilter('review')}
                    >
                        Needs Review
                    </button>
                    <button
                        className={filter === 'known' ? 'active' : ''}
                        onClick={() => setFilter('known')}
                    >
                        Known
                    </button>
                </nav>
            )}

            <ul className="fkrp-list">
                {factKinds?.map((fk) => (
                    <FactKindRow
                        key={fk.id}
                        factKind={fk}
                        isSelected={selectedId === fk.id}
                        onSelect={() => setSelectedId(fk.id === selectedId ? null : fk.id)}
                        onApprove={() => handleApprove(fk.fact_kind)}
                        onDeprecate={() => handleDeprecate(fk.fact_kind)}
                        isApproving={
                            approveMutation.isPending &&
                            approveMutation.variables?.factKind === fk.fact_kind
                        }
                        isDeprecating={
                            deprecateMutation.isPending &&
                            deprecateMutation.variables?.factKind === fk.fact_kind
                        }
                    />
                ))}

                {factKinds?.length === 0 && (
                    <li className="fkrp-empty">
                        {filter === 'review'
                            ? 'No fact kinds need review'
                            : 'No fact kinds found'}
                    </li>
                )}
            </ul>
        </div>
    );
}

interface FactKindRowProps {
    factKind: FactKindDefinition;
    isSelected: boolean;
    onSelect: () => void;
    onApprove: () => void;
    onDeprecate: () => void;
    isApproving: boolean;
    isDeprecating: boolean;
}

function FactKindRow({
    factKind,
    isSelected,
    onSelect,
    onApprove,
    onDeprecate,
    isApproving,
    isDeprecating,
}: FactKindRowProps) {
    const confidenceClass = `confidence-${factKind.confidence}`;
    const statusClass = factKind.needs_review
        ? 'needs-review'
        : factKind.is_known
            ? 'known'
            : 'deprecated';

    return (
        <li className={`fkrp-row ${statusClass} ${isSelected ? 'selected' : ''}`}>
            <div className="fkrp-row-main" onClick={onSelect}>
                <div className="fkrp-row-header">
                    <span className="display-name">{factKind.display_name}</span>
                    <span className={`confidence ${confidenceClass}`}>
                        {factKind.confidence}
                    </span>
                    <span className="source">{factKind.source}</span>
                </div>
                <div className="fkrp-row-meta">
                    <code className="fact-kind">{factKind.fact_kind}</code>
                    <span className="first-seen">
                        First seen: {new Date(factKind.first_seen_at).toLocaleDateString()}
                    </span>
                </div>
            </div>

            {isSelected && (
                <div className="fkrp-row-details">
                    {factKind.description && (
                        <p className="description">{factKind.description}</p>
                    )}
                    {factKind.example_payload != null && (
                        <pre className="example-payload">
                            {typeof factKind.example_payload === 'string'
                                ? factKind.example_payload
                                : JSON.stringify(factKind.example_payload, null, 2)}
                        </pre>
                    )}
                    {factKind.needs_review && (
                        <div className="fkrp-actions">
                            <button
                                className="approve"
                                onClick={onApprove}
                                disabled={isApproving || isDeprecating}
                            >
                                {isApproving ? 'Approving...' : '✓ Approve'}
                            </button>
                            <button
                                className="deprecate"
                                onClick={onDeprecate}
                                disabled={isApproving || isDeprecating}
                            >
                                {isDeprecating ? 'Deprecating...' : '✗ Deprecate'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

export default FactKindReviewPanel;
