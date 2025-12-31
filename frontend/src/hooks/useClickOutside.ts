import { useEffect, useCallback, RefObject } from 'react';

interface UseClickOutsideOptions {
  /** Whether the hook is active. Default: true */
  enabled?: boolean;
}

/**
 * Hook to detect clicks outside of specified elements.
 * Supports multiple refs for cases like anchor + portal content.
 * Uses requestAnimationFrame to avoid race conditions with blur events.
 *
 * @param refs - Array of refs to elements that should NOT trigger the handler
 * @param handler - Callback to execute when clicking outside all refs
 * @param options - Configuration options
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  handler: () => void,
  options: UseClickOutsideOptions = {}
): void {
  const { enabled = true } = options;

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      // Use requestAnimationFrame to let other events (like blur) settle first
      requestAnimationFrame(() => {
        const target = event.target as Node;

        // Check if click was inside any of the refs
        const isInsideAnyRef = refs.some((ref) => {
          return ref.current && ref.current.contains(target);
        });

        if (!isInsideAnyRef) {
          handler();
        }
      });
    },
    [refs, handler]
  );

  useEffect(() => {
    if (!enabled) return;

    // Use mousedown for immediate response (before blur fires)
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [enabled, handleClickOutside]);
}
