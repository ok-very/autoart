/**
 * ActionDetailsPanel
 *
 * Displays action info and field bindings.
 * Extracted from ActionInspector for use in unified SelectionInspector.
 */

import { useAction } from '../../api/hooks';

interface ActionDetailsPanelProps {
    actionId: string;
}

export function ActionDetailsPanel({ actionId }: ActionDetailsPanelProps) {
    const { data: action, isLoading } = useAction(actionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32 text-ws-muted text-sm">
                Loading action details...
            </div>
        );
    }

    if (!action) {
        return (
            <div className="flex items-center justify-center h-32 text-ws-muted text-sm">
                Action not found
            </div>
        );
    }

    // Extract title from field bindings
    const getTitle = () => {
        const bindings = action.fieldBindings;
        const titleBinding = bindings?.find((b) => b.fieldKey === 'title');
        if (titleBinding?.value && typeof titleBinding.value === 'string') {
            return titleBinding.value;
        }
        return `${action.type} ${action.id.slice(0, 8)}`;
    };

    return (
        <div className="space-y-5">
            {/* Title & Type Header */}
            <div className="pb-4 border-b border-ws-panel-border">
                <h2 className="text-base font-semibold text-ws-fg">{getTitle()}</h2>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded">
                    {action.type}
                </span>
            </div>

            {/* Action Info */}
            <section>
                <h3 className="text-xs font-semibold text-ws-muted uppercase tracking-wider mb-3">
                    Action Info
                </h3>
                <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <dt className="text-ws-text-secondary">Type</dt>
                        <dd className="font-medium text-purple-700">{action.type}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-ws-text-secondary">Context</dt>
                        <dd className="text-ws-text-secondary capitalize">{action.contextType}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-ws-text-secondary">Created</dt>
                        <dd className="text-ws-text-secondary">
                            {new Date(action.createdAt).toLocaleString()}
                        </dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-ws-text-secondary">ID</dt>
                        <dd className="text-ws-text-secondary font-mono text-xs">{action.id.slice(0, 12)}...</dd>
                    </div>
                </dl>
            </section>

            {/* Field Bindings */}
            <section>
                <h3 className="text-xs font-semibold text-ws-muted uppercase tracking-wider mb-3">
                    Field Bindings
                </h3>
                {action.fieldBindings && action.fieldBindings.length > 0 ? (
                    <ul className="space-y-2">
                        {action.fieldBindings.map((binding, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-ws-bg rounded-lg">
                                <span className="font-medium text-ws-text-secondary min-w-[80px]">
                                    {binding.fieldKey}:
                                </span>
                                <span className="text-ws-fg break-words">
                                    {String(binding.value ?? '-')}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-ws-muted italic">No field bindings</p>
                )}
            </section>
        </div>
    );
}

export default ActionDetailsPanel;
