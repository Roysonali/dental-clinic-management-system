import type { FC, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Drawer } from '../../../components/common/Drawer/Drawer';
import { IconButton } from '../../../components/common/Button/IconButton';
import { Icon } from '../../../components/common/Icon/Icon';
import { Button } from '../../../components/common/Button/Button';

interface MobileFilterSheetProps {
  /** Open state. */
  open: boolean;
  /** Close handler (backdrop, Escape, close button, Done). */
  onClose: () => void;
  /** Accessible + visible sheet title, e.g. "Filter patients". */
  title: string;
  /** Filter fields — map 1:1 onto the same server-side query params as desktop. */
  children: ReactNode;
  /** Whether any filter is active (enables "Clear filters"). */
  hasActiveFilters: boolean;
  /** Clears all filters. */
  onClearFilters: () => void;
}

/**
 * MobileFilterSheet — shared mobile filter sheet shell.
 *
 * A full-width right Drawer (reference screen 47's filter interaction):
 * backdrop dims the page, header with title + close, scrollable body of
 * filter controls, and a pinned footer with Clear filters / Done. Every
 * module composes this shell with its own filter fields — the sheet
 * behavior (focus trap, Escape, body scroll lock, no horizontal overflow)
 * is implemented exactly once here.
 */
export const MobileFilterSheet: FC<MobileFilterSheetProps> = ({
  open,
  onClose,
  title,
  children,
  hasActiveFilters,
  onClearFilters,
}) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="full"
      ariaLabel={title}
      className="!max-w-full"
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">{title}</h2>
          <IconButton
            icon={<Icon icon={X} size="sm" />}
            aria-label="Close filters"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body>
        <div className="flex flex-col gap-4">{children}</div>
      </Drawer.Body>

      <Drawer.Footer className="!bg-white">
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              onClearFilters();
              onClose();
            }}
            disabled={!hasActiveFilters}
          >
            Clear filters
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Drawer.Footer>
    </Drawer>
  );
};
