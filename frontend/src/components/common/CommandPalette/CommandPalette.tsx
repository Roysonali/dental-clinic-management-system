import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search, Command } from 'lucide-react';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

interface CommandGroup {
  /** Group label */
  label: string;
  /** Commands in this group */
  commands: CommandItem[];
}

interface CommandItem {
  /** Display label */
  label: string;
  /** Description text */
  description?: string;
  /** Icon */
  icon?: LucideIcon;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Disabled state */
  disabled?: boolean;
}

interface CommandPaletteProps {
  /** Command groups */
  groups: CommandGroup[];
  /** Search query */
  query?: string;
  /** On query change handler (debounce-ready) */
  onQueryChange?: (query: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional classes */
  className?: string;
}

/**
 * CommandPalette — foundation for a command palette / quick search overlay.
 *
 * This is infrastructure only. Global keyboard listeners (Ctrl+K / Cmd+K)
 * and the overlay trigger are NOT implemented here — they belong to the
 * future Application Shell integration.
 *
 * @example
 * ```tsx
 * <CommandPalette
 *   query={query}
 *   onQueryChange={setQuery}
 *   loading={false}
 *   groups={[
 *     {
 *       label: 'Navigation',
 *       commands: [
 *         { label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
 *         { label: 'Go to Patients', icon: Users, shortcut: 'G P' },
 *       ],
 *     },
 *   ]}
 * />
 * ```
 */
export const CommandPalette: FC<CommandPaletteProps> = ({
  groups,
  query = '',
  onQueryChange,
  loading = false,
  emptyMessage = 'No results found.',
  className = '',
}) => {
  return (
    <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white shadow-xl ${className}`}>
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        {loading ? (
          <Spinner size="sm" variant="neutral" />
        ) : (
          <Icon icon={Search} size="sm" className="text-neutral-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="Type a command or search..."
          className="flex-1 text-body text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none"
          aria-label="Search commands"
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption text-neutral-400 font-mono">
          <Icon icon={Command} size="xs" />K
        </kbd>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto px-2 py-2">
        {loading && groups.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-body-sm text-neutral-400">Loading commands...</p>
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-body-sm text-neutral-400">{emptyMessage}</p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className="mb-2 last:mb-0">
            <p className="px-2 py-1.5 text-caption font-semibold uppercase tracking-wider text-neutral-400">
              {group.label}
            </p>
            {group.commands.map((cmd, ci) => (
              <button
                key={ci}
                type="button"
                disabled={cmd.disabled}
                className={`
                  flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-body-sm
                  transition-colors duration-100
                  hover:bg-neutral-100
                  disabled:cursor-not-allowed disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                `}
              >
                {cmd.icon && (
                  <Icon icon={cmd.icon} size="sm" className="text-neutral-400" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-neutral-800">{cmd.label}</span>
                  {cmd.description && (
                    <span className="ml-2 text-caption text-neutral-400">{cmd.description}</span>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption text-neutral-400 font-mono">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="border-t border-neutral-200 px-4 py-2">
        <p className="text-caption text-neutral-400">
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">↑↓</kbd> Navigate{' '}
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">↵</kbd> Select{' '}
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Esc</kbd> Close
        </p>
      </div>
    </div>
  );
};
