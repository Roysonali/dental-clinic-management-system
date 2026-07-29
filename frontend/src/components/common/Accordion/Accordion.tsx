import { useState, type FC, type ReactNode, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────── */

type AccordionType = 'single' | 'multiple';

interface AccordionProps {
  /** Allow multiple items open simultaneously */
  type?: AccordionType;
  /** Default open value(s) */
  defaultValue?: string | string[];
  /** Allow all items to close (only applies when type='single') */
  collapsible?: boolean;
  /** Children */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

interface AccordionItemProps {
  /** Unique value for this item */
  value: string;
  /** Trigger/header content */
  trigger: ReactNode;
  /** Panel content */
  children?: ReactNode;
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

/* ── Context ────────────────────────────────────────────────────────── */

import { createContext, useContext } from 'react';

interface AccordionContextValue {
  openValues: string[];
  toggle: (value: string) => void;
  type: AccordionType;
  collapsible: boolean;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion sub-components must be used within <Accordion>.');
  return ctx;
}

/* ── Accordion Container ─────────────────────────────────────────────── */

export const Accordion: FC<AccordionProps> & {
  Item: FC<AccordionItemProps>;
} = ({
  type = 'single',
  defaultValue,
  collapsible = false,
  children,
  className = '',
}) => {
  const initial = defaultValue
    ? Array.isArray(defaultValue)
      ? defaultValue
      : [defaultValue]
    : [];

  const [openValues, setOpenValues] = useState<string[]>(initial);

  const toggle = useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const isOpen = prev.includes(value);
        if (isOpen) {
          if (type === 'single' && !collapsible) return prev;
          return prev.filter((v) => v !== value);
        }
        if (type === 'single') return [value];
        return [...prev, value];
      });
    },
    [type, collapsible],
  );

  return (
    <AccordionContext.Provider value={{ openValues, toggle, type, collapsible }}>
      <div className={`divide-y divide-neutral-200 border-y border-neutral-200 ${className}`}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

/* ── Accordion Item ────────────────────────────────────────────────── */

const AccordionItem: FC<AccordionItemProps> = ({
  value,
  trigger,
  children,
  disabled = false,
  className = '',
}) => {
  const { openValues, toggle } = useAccordionContext();
  const isOpen = openValues.includes(value);

  const itemId = `accordion-item-${value}`;
  const panelId = `accordion-panel-${value}`;

  return (
    <div className={className}>
      <h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggle(value)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          id={itemId}
          className={`
            flex w-full items-center justify-between gap-4 py-3.5 text-left text-body-sm font-medium text-neutral-900
            transition-colors duration-150
            disabled:cursor-not-allowed disabled:opacity-50
            hover:text-neutral-700
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset
          `}
        >
          <span>{trigger}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={itemId}
        hidden={!isOpen}
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'pb-3.5' : 'max-h-0 pb-0'}`}
      >
        {children}
      </div>
    </div>
  );
};

Accordion.Item = AccordionItem;
