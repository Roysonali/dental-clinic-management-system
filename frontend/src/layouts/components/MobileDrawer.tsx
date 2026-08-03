import type { FC } from 'react';
import { Drawer } from '../../components/common/Drawer/Drawer';
import { Sidebar } from './sidebar/Sidebar';

/**
 * MobileDrawer — slide-in navigation drawer for mobile viewports.
 *
 * Renders the existing Sidebar component inside the Design System Drawer.
 * No duplicate navigation — same Sidebar, different container.
 *
 * Uses `forceVisible` on Sidebar instead of fragile CSS descendant selectors.
 * Uses `ariaLabel` on Drawer for accessible dialog naming.
 *
 * @example
 * ```tsx
 * <MobileDrawer open={isOpen} onClose={handleClose} />
 * ```
 */
interface MobileDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer should close (backdrop click, ESC) */
  onClose: () => void;
}

export const MobileDrawer: FC<MobileDrawerProps> = ({ open, onClose }) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="left"
      size="md"
      ariaLabel="Navigation drawer"
      className="!max-w-[var(--sidebar-width)]"
    >
      <div className="flex h-full flex-col">
        <Sidebar forceVisible />
      </div>
    </Drawer>
  );
};
