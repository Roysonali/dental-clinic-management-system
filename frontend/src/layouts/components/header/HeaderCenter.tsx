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
        className="hidden sm:inline-flex w-56 justify-start text-neutral-400 hover:text-neutral-500"
        aria-label="Open search"
        onClick={onOpenCommandPalette}
      >
        <span className="flex w-full items-center justify-between">
          <span>Search</span>
          <kbd className="ml-auto flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption font-medium text-neutral-400 shadow-xs">
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
