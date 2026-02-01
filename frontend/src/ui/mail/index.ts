/**
 * Mail UI Components
 *
 * Phase 4 of the Narrative Canvas redesign - Mail as Fact Source.
 *
 * Components for integrating mail with the narrative system:
 * - LinkedEntityBadge: Shows linked actions/records on emails
 * - EmailLinkActions: UI for linking emails to entities
 * - EmailFactCard: Email display for narrative stream
 */

// Linked entity display
export {
    LinkedEntityBadge,
    LinkedEntityGroup,
    type LinkedEntity,
    type LinkedEntityType,
    type LinkedEntityBadgeProps,
    type LinkedEntityGroupProps,
} from './LinkedEntityBadge';

// Link creation UI
export {
    EmailLinkActions,
    type EmailLinkActionsProps,
} from './EmailLinkActions';

// Email fact card for narrative
export {
    EmailFactCard,
    type EmailFactCardProps,
} from './EmailFactCard';

// Email actions menu
export {
    EmailActionsMenu,
    type EmailActionsMenuProps,
} from './EmailActionsMenu';
