import { useEffect } from 'react';

/**
 * useGlobalShortcut — registers a global keyboard shortcut.
 *
 * Ignores the shortcut when the user is typing inside:
 * - input
 * - textarea
 * - select
 * - contentEditable elements
 *
 * @example
 * ```tsx
 * useGlobalShortcut((e) => {
 *   if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 *     e.preventDefault();
 *     openCommandPalette();
 *   }
 * });
 * ```
 */
export function useGlobalShortcut(handler: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in form elements
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      ) {
        return;
      }
      handler(e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handler]);
}
