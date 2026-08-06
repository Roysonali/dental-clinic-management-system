import type { FC } from 'react';
import { Search } from 'lucide-react';
import { Icon } from '../../../components/common/Icon/Icon';
import { Button } from '../../../components/common/Button/Button';
import { IconButton } from '../../../components/common/Button/IconButton';

/**
 * HeaderCenter — center section of the application header.
 *
 * Contains global search trigger buttons wired to the CommandPalette overlay.
 * Desktop shows an expanded button with ⌘K shortcut; mobile shows an icon.
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
    <div className="flex items-center justify-center">
      {/* Desktop: expanded search trigger */}
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Icon icon={Search} size="sm" />}
        className="hidden h-9 w-64 justify-start rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-400 shadow-sm transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-500 sm:inline-flex"
        aria-label="Open search"
        onClick={onOpenCommandPalette}
      >
        <span className="flex w-full items-center justify-between">
          <span>Search</span>
          <kbd className="ml-auto flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-caption font-medium text-neutral-500">
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
