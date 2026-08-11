import type { FC } from 'react';
import { Search } from 'lucide-react';
import { Icon } from '../../../components/common/Icon/Icon';
import { Button } from '../../../components/common/Button/Button';
import { IconButton } from '../../../components/common/Button/IconButton';

/**
 * HeaderCenter — global search control for the application header.
 *
 * Reuses the existing CommandPalette global-search infrastructure: the
 * control is a search-shaped trigger that opens the CommandPalette overlay
 * (also reachable via the Ctrl/Cmd + K shortcut handled by AppShell). No
 * second search implementation is introduced.
 *
 * Reference appearance:
 * - Desktop: ~250–300px input-style control, search icon left, "Search"
 *   placeholder and a ⌘K shortcut keycap on the right
 * - Tablet: narrower width to avoid horizontal overflow
 * - Mobile: icon-only trigger
 *
 * @example
 * ```tsx
 * <HeaderCenter onOpenCommandPalette={openPalette} />
 * ```
 */
export interface HeaderCenterProps {
  /** Command palette open callback */
  onOpenCommandPalette?: () => void;
}

export const HeaderCenter: FC<HeaderCenterProps> = ({ onOpenCommandPalette }) => {
  return (
    <div className="flex items-center">
      {/* Desktop / tablet: expanded search-shaped trigger */}
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Icon icon={Search} size="sm" />}
        className="hidden h-10 w-48 justify-start rounded-lg border border-neutral-200 bg-white pr-1.5 text-neutral-500 shadow-sm transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 md:w-56 lg:w-64 sm:inline-flex"
        aria-label="Open search"
        onClick={onOpenCommandPalette}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span>Search</span>
          <kbd className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption font-medium text-neutral-500">
            <span className="text-caption">⌘</span>
            <span>K</span>
          </kbd>
        </span>
      </Button>

      {/* Mobile: compact search icon */}
      <IconButton
        icon={<Icon icon={Search} size="md" />}
        variant="ghost"
        size="sm"
        aria-label="Open search"
        className="sm:hidden"
        onClick={onOpenCommandPalette}
      />
    </div>
  );
};
