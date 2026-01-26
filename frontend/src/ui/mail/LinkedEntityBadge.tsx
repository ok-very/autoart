/**
 * LinkedEntityBadge
 *
 * Shows linked actions/records on emails in the mailbox view.
 * Provides visual indication of which entities are connected to an email.
 */

import { clsx } from 'clsx';
import { Target, FileText, Link2, ExternalLink } from 'lucide-react';

export type LinkedEntityType = 'action' | 'record';

export interface LinkedEntity {
    id: string;
    type: LinkedEntityType;
    title: string;
}

export interface LinkedEntityBadgeProps {
    /** The linked entity to display */
    entity: LinkedEntity;
    /** Size variant */
    size?: 'xs' | 'sm';
    /** Click handler to navigate to entity */
    onClick?: () => void;
    /** Additional className */
    className?: string;
}

/**
 * Entity type configuration
 */
const entityConfig: Record<LinkedEntityType, {
    icon: typeof Target;
    colorClass: string;
    bgClass: string;
}> = {
    action: {
        icon: Target,
        colorClass: 'text-green-700',
        bgClass: 'bg-green-50 hover:bg-green-100',
    },
    record: {
        icon: FileText,
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50 hover:bg-blue-100',
    },
};

/**
 * LinkedEntityBadge Component
 */
export function LinkedEntityBadge({
    entity,
    size = 'xs',
    onClick,
    className,
}: LinkedEntityBadgeProps) {
    const config = entityConfig[entity.type];
    const Icon = config.icon;

    const iconSize = size === 'xs' ? 10 : 12;
    const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={clsx(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
                config.bgClass,
                config.colorClass,
                textSize,
                onClick && 'cursor-pointer',
                className
            )}
            title={`View ${entity.type}: ${entity.title}`}
        >
            <Icon size={iconSize} />
            <span className="truncate max-w-[80px]">{entity.title}</span>
            {onClick && <ExternalLink size={iconSize - 2} className="opacity-50" />}
        </button>
    );
}

/**
 * Group of linked entity badges
 */
export interface LinkedEntityGroupProps {
    /** Linked entities to display */
    entities: LinkedEntity[];
    /** Maximum entities to show before collapsing */
    maxVisible?: number;
    /** Size variant */
    size?: 'xs' | 'sm';
    /** Click handler for entity */
    onEntityClick?: (entity: LinkedEntity) => void;
    /** Additional className */
    className?: string;
}

export function LinkedEntityGroup({
    entities,
    maxVisible = 2,
    size = 'xs',
    onEntityClick,
    className,
}: LinkedEntityGroupProps) {
    if (entities.length === 0) {
        return null;
    }

    const visible = entities.slice(0, maxVisible);
    const remaining = entities.length - maxVisible;

    return (
        <div className={clsx('flex items-center gap-1 flex-wrap', className)}>
            <Link2 size={10} className="text-slate-400" />
            {visible.map((entity) => (
                <LinkedEntityBadge
                    key={`${entity.type}-${entity.id}`}
                    entity={entity}
                    size={size}
                    onClick={onEntityClick ? () => onEntityClick(entity) : undefined}
                />
            ))}
            {remaining > 0 && (
                <span className="text-[10px] text-slate-400">
                    +{remaining} more
                </span>
            )}
        </div>
    );
}

export default LinkedEntityBadge;
