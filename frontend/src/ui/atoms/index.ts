/**
 * Atoms - Smallest UI building blocks
 * 
 * Rules:
 * - Zero domain knowledge (no imports from @autoart/shared/domain)
 * - Pure presentational components
 * - Receive all data via props
 * - No API calls, no global state access
 * 
 * Quarantined atoms (break rules, legacy):
 * - EmojiPicker - uses internal state, external library
 * - PortalMenu - uses portal/global DOM
 * - UserChip - uses PortalMenu internally
 */

// Core atoms
export { Badge } from './Badge';
export { Button } from './Button';
export { Card } from './Card';
export { Checkbox } from './Checkbox';
export { Inline } from './Inline';
export { ProgressBar, type ProgressSegment } from './ProgressBar';
export { ResizeHandle } from './ResizeHandle';
export { Select } from './Select';
export { Spinner } from './Spinner';
export { Stack } from './Stack';
export { Text } from './Text';
export { TextInput } from './TextInput';
export { RadioGroup } from './RadioGroup';
export { Alert } from './Alert';
export { ErrorBoundary } from './ErrorBoundary';

// New atoms
export { Label } from './Label';
export { ValueDisplay } from './ValueDisplay';
export { InlineError } from './InlineError';
export { IconButton } from './IconButton';

// Quarantined atoms (legacy, rule-breaking)
export { EmojiPicker } from './EmojiPicker';
export { PortalMenu } from './PortalMenu';
export { UserChip } from './UserChip';

