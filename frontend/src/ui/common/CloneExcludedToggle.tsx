import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

import { useToggleCloneExcluded } from '../../api/hooks';
import type { RecordDefinition } from '../../types';

interface CloneExcludedToggleProps {
  definition: RecordDefinition;
  /** 'default' shows text label, 'compact' shows icon only */
  variant?: 'default' | 'compact';
  /** Visual style context */
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Toggle button for including/excluding a record definition from project clones.
 *
 * When excluded (clone_excluded = true), the definition will NOT be copied
 * when a project is cloned. This is an opt-out model where all definitions
 * are included by default.
 */
export function CloneExcludedToggle({
  definition,
  variant = 'default',
  theme = 'light',
  className,
}: CloneExcludedToggleProps) {
  const toggleCloneExcluded = useToggleCloneExcluded();
  const isExcluded = definition.clone_excluded ?? false;

  const handleToggle = async () => {
    await toggleCloneExcluded.mutateAsync({
      definitionId: definition.id,
      excluded: !isExcluded,
    });
  };

  const isCompact = variant === 'compact';
  const isDark = theme === 'dark';

  const baseStyles = clsx(
    'flex items-center gap-1 rounded transition-colors disabled:opacity-50',
    isCompact ? 'p-1.5' : 'px-2 py-1 text-xs',
    isDark
      ? isExcluded
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      : isExcluded
        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300'
        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
  );

  const iconSize = isCompact ? 14 : 12;

  return (
    <button
      onClick={handleToggle}
      disabled={toggleCloneExcluded.isPending}
      className={clsx(baseStyles, className)}
      title={isExcluded ? 'Include in project clones' : 'Exclude from project clones'}
    >
      {isExcluded ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
      {!isCompact && (isExcluded ? 'Excluded' : 'Included')}
    </button>
  );
}
