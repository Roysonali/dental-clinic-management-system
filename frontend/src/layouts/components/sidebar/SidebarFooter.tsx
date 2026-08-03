import type { FC } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '../../../components/common/Button/Button';
import { IconButton } from '../../../components/common/Button/IconButton';
import { Divider } from '../../../components/common/Divider/Divider';
import { Tooltip } from '../../../components/common/Tooltip/Tooltip';

interface SidebarFooterProps {
  /** Whether sidebar is collapsed */
  collapsed: boolean;
  /** Toggle collapse state */
  onToggleCollapse: () => void;
}

/**
 * SidebarFooter — bottom section of the sidebar.
 *
 * Contains the collapse/expand toggle button and version information.
 * Reserved space for future user section.
 */
export const SidebarFooter: FC<SidebarFooterProps> = ({
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <>
      <Divider variant="default" />

      <div className="shrink-0 p-3">
        {/* Collapse toggle */}
        {collapsed ? (
          <div className="flex justify-center">
            <Tooltip content="Expand sidebar" position="right" showDelay={200} hideDelay={0}>
              <IconButton
                icon={<PanelLeftOpen size={16} />}
                aria-label="Expand sidebar"
                variant="ghost"
                size="md"
                onClick={onToggleCollapse}
              />
            </Tooltip>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<PanelLeftClose size={16} />}
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="w-full justify-start"
          >
            Collapse
          </Button>
        )}

        {/* Version (visible only in expanded mode) */}
        {!collapsed && (
          <div className="mt-3 px-3">
            <span className="text-caption text-neutral-400">v1.0.0</span>
          </div>
        )}
      </div>
    </>
  );
};
