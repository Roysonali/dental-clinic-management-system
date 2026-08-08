import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type FC,
} from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { Spinner } from '../Spinner/Spinner';
import { EmptyState } from '../EmptyState/EmptyState';
import { PaletteResultRow } from './PaletteResultRow';
import {
  RECENT_SEARCHES,
  filterResults,
  groupResults,
} from './commandPaletteData';

/* ── Props ──────────────────────────────────────────────────────────── */

interface CommandPaletteOverlayProps {
  /** Whether the palette is open */
  open: boolean;
  /** Called when the palette should close */
  onClose: () => void;
  /** Loading state (for future API integration) */
  loading?: boolean;
}

/* ── Keyboard navigation helpers ─────────────────────────────────────── */

type ItemId = `group-${number}-${number}`;

function getItemId(groupIndex: number, itemIndex: number): ItemId {
  return `group-${groupIndex}-${itemIndex}`;
}

function parseItemId(id: ItemId): [number, number] {
  const parts = id.split('-');
  return [Number(parts[1]), Number(parts[2])];
}

/* ── Focus trap helper ──────────────────────────────────────────────── */

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'textarea:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
}

/* ── Build option id for aria-activedescendant ──────────────────────── */

function optionId(groupIndex: number, itemIndex: number): string {
  return `cmd-opt-${groupIndex}-${itemIndex}`;
}

/* ── Main Component ─────────────────────────────────────────────────── */

export const CommandPaletteOverlay: FC<CommandPaletteOverlayProps> = ({
  open,
  onClose,
  loading = false,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Save and restore focus, auto-focus input on open
  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset the palette state every time it opens
    setQuery('');
    setActiveIndex(0);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    // ESC close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  // Filter and group results
  const results = query.trim() ? filterResults(query) : [];
  const grouped = groupResults(results);
  const groupEntries = Array.from(grouped.entries());

  // Build flat list of item IDs for keyboard navigation
  const flatIds: ItemId[] = useMemo(() => {
    const ids: ItemId[] = [];
    groupEntries.forEach(([, items], gi) => {
      items.forEach((_, ii) => {
        ids.push(getItemId(gi, ii));
      });
    });
    return ids;
  }, [groupEntries]);

  // Compute active option ID for aria-activedescendant
  const activeOptionId =
    flatIds.length > 0
      ? (() => {
          const [gi, ii] = parseItemId(flatIds[activeIndex]);
          return optionId(gi, ii);
        })()
      : undefined;

  // Scroll active item into view
  useEffect(() => {
    if (!listboxRef.current || !activeOptionId) return;
    const activeEl = listboxRef.current.querySelector<HTMLElement>(
      `#${activeOptionId}`,
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, activeOptionId]);

  // Tab focus trap
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  // Arrow key + Enter navigation
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatIds.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(flatIds.length - 1);
      } else if (e.key === 'Enter' && flatIds.length > 0) {
        e.preventDefault();
        const [gi, ii] = parseItemId(flatIds[activeIndex]);
        const item = groupEntries[gi]?.[1][ii];
        if (item && !item.disabled) {
          onClose();
        }
      }
    },
    [flatIds, activeIndex, groupEntries, onClose],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  if (!open) return null;

  const showRecent = !query.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-overlay"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Dialog panel ────────────────────────────── */}
      <div
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
        className={`
          absolute flex flex-col bg-white shadow-2xl
          sm:rounded-xl sm:border sm:border-neutral-200
          sm:left-1/2 sm:top-[12vh] sm:-translate-x-1/2 sm:max-w-2xl sm:w-[calc(100%-2rem)]
          inset-x-0 bottom-0 top-auto rounded-t-2xl border-t border-neutral-200
          max-h-[85vh]
          focus-visible:outline-none
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
      >
        {/* ── Search Input ───────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 shrink-0">
          {loading ? (
            <Spinner size="sm" variant="neutral" />
          ) : (
            <Icon icon={Search} size="sm" className="shrink-0 text-neutral-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search patients, appointments, invoices..."
            className="flex-1 text-body text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none"
            aria-label="Search commands"
            aria-controls="cmd-palette-listbox"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
          />
          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Clear search"
            >
              <Icon icon={X} size="sm" />
            </button>
          )}
          {/* ESC badge (desktop only) */}
          {!query && (
            <kbd className="hidden shrink-0 items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption text-neutral-400 font-mono sm:inline-flex">
              Esc
            </kbd>
          )}
        </div>

        {/* ── Results ────────────────────────────────── */}
        <div
          id="cmd-palette-listbox"
          ref={listboxRef}
          className="flex-1 overflow-y-auto px-2 py-2"
          role="listbox"
          aria-label="Search results"
        >
          {/* Recent Searches (visible when query is empty) */}
          {showRecent && (
            <div className="mb-2">
              <p className="px-2 py-1.5 text-caption font-semibold uppercase tracking-wider text-neutral-400">
                Recent Searches
              </p>
              {RECENT_SEARCHES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    setActiveIndex(0);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-body-sm text-neutral-600 hover:bg-neutral-100 transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <Icon icon={Clock} size="sm" className="shrink-0 text-neutral-400" />
                  <span>{item}</span>
                  <Icon icon={ArrowRight} size="xs" className="ml-auto shrink-0 text-neutral-300" />
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" variant="primary" />
            </div>
          )}

          {/* Empty state */}
          {!showRecent && !loading && results.length === 0 && (
            <EmptyState
              title="No results found"
              description="Try a different search term."
            />
          )}

          {/* Grouped results */}
          {!loading && groupEntries.map(([category, items], gi) => (
            <div key={category} className="mb-2 last:mb-0">
              <p className="flex items-center gap-2 px-2 py-1.5 text-caption font-semibold uppercase tracking-wider text-neutral-400">
                {category}
                <Badge variant="neutral" size="xs">{items.length}</Badge>
              </p>
              {items.map((result, ii) => {
                const id = getItemId(gi, ii);
                const isActive = flatIds[activeIndex] === id;
                const optId = optionId(gi, ii);
                return (
                  <PaletteResultRow
                    key={result.id}
                    id={optId}
                    icon={result.icon}
                    label={result.label}
                    subtitle={result.subtitle}
                    shortcut={result.shortcut}
                    active={isActive}
                    disabled={result.disabled}
                    onClick={() => { if (!result.disabled) onClose(); }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Footer Hint ────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 shrink-0">
          <p className="text-caption text-neutral-400">
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">↑↓</kbd>
            {' '}Navigate{' '}
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">↵</kbd>
            {' '}Select{' '}
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Esc</kbd>
            {' '}Close
          </p>
          <span className="text-caption text-neutral-300">Powered by DensCare</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
