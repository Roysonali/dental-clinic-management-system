import { useState, useCallback, useEffect, type FC, type ReactNode, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../Badge';

/* ── Types ────────────────────────────────────────────────────────── */

export type TabsVariant = 'default' | 'underline' | 'pills';
export type TabsOrientation = 'horizontal' | 'vertical';

interface TabsProps {
  /** Controlled active tab value */
  value?: string;
  /** Default active tab (uncontrolled) */
  defaultValue?: string;
  /** Callback on tab change */
  onValueChange?: (value: string) => void;
  /** Visual variant */
  variant?: TabsVariant;
  /** Orientation */
  orientation?: TabsOrientation;
  /** Children (Tabs.List + Tabs.Content) */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

interface TabsListProps {
  children?: ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  /** Tab value (must match Tabs.Content value prop) */
  value: string;
  /** Label text */
  label?: string;
  /** Optional icon */
  icon?: LucideIcon;
  /** Badge count/text */
  badge?: string | number;
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

interface TabsContentProps {
  /** Tab value (must match TabsTrigger value) */
  value: string;
  /** Content rendered when active */
  children?: ReactNode;
  /** Lazy render (only render when tab is active) */
  lazy?: boolean;
  className?: string;
}

/* ── Context ────────────────────────────────────────────────────────── */

import { createContext, useContext } from 'react';

interface TabsContextValue {
  activeValue: string;
  onSelect: (value: string) => void;
  variant: TabsVariant;
  orientation: TabsOrientation;
  values: string[];
  onRegister: (value: string) => void;
  onUnregister: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs sub-components must be used within <Tabs>.');
  return ctx;
}

/* ── Variant maps ────────────────────────────────────────────────────── */

const listVariantMap: Record<TabsVariant, string> = {
  default: 'border-b border-neutral-200 gap-0',
  underline: 'border-b border-neutral-200 gap-0',
  pills: 'gap-1',
};

const triggerVariantMap: Record<TabsVariant, string> = {
  default:
    'border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 data-[active=true]:text-primary-600 data-[active=true]:border-primary-500 rounded-t-lg',
  underline:
    'border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 data-[active=true]:text-primary-600 data-[active=true]:border-primary-500',
  pills:
    'rounded-lg text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 data-[active=true]:bg-primary-50 data-[active=true]:text-primary-700',
};

/* ── Tabs Container ─────────────────────────────────────────────────── */

export const Tabs: FC<TabsProps> & {
  List: FC<TabsListProps>;
  Trigger: FC<TabsTriggerProps>;
  Content: FC<TabsContentProps>;
} = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  variant = 'default',
  orientation = 'horizontal',
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const [values, setValues] = useState<string[]>([]);

  const onSelect = useCallback(
    (val: string) => {
      if (!isControlled) setInternalValue(val);
      onValueChange?.(val);
    },
    [isControlled, onValueChange],
  );

  const onRegister = useCallback((value: string) => {
    setValues((prev) => (prev.includes(value) ? prev : [...prev, value]));
  }, []);

  const onUnregister = useCallback((value: string) => {
    setValues((prev) => prev.filter((v) => v !== value));
  }, []);

  return (
    <TabsContext.Provider value={{ activeValue, onSelect, variant, orientation, values, onRegister, onUnregister }}>
      <div className={`${orientation === 'vertical' ? 'flex flex-row gap-6' : 'flex flex-col'} ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

/* ── Tabs List ──────────────────────────────────────────────────────── */

const TabsList: FC<TabsListProps> = ({ children, className = '' }) => {
  const { orientation, variant } = useTabsContext();

  return (
    <div
      className={`flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'} ${listVariantMap[variant]} ${className}`}
      role="tablist"
      aria-orientation={orientation}
    >
      {children}
    </div>
  );
};

/* ── Tabs Trigger ────────────────────────────────────────────────────── */

const TabsTrigger: FC<TabsTriggerProps> = ({
  value,
  label,
  icon: IconComponent,
  badge,
  disabled = false,
  className = '',
}) => {
  const { activeValue, onSelect, variant, values, onRegister, orientation } = useTabsContext();
  const isActive = activeValue === value;

  // Register/unregister this tab value
  useEffect(() => {
    onRegister(value);
    return () => onUnregister(value);
  }, [value, onRegister, onUnregister]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) onSelect(value);
      return;
    }

    // Arrow key navigation between tabs
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    if (e.key !== nextKey && e.key !== prevKey) return;
    e.preventDefault();

    const currentIndex = values.indexOf(value);
    if (currentIndex === -1) return;

    const nextIndex = e.key === nextKey
      ? (currentIndex + 1) % values.length
      : (currentIndex - 1 + values.length) % values.length;

    const nextValue = values[nextIndex];
    if (nextValue) {
      onSelect(nextValue);
      // Focus the next tab button
      const buttons = (e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') ?? []) as NodeListOf<HTMLButtonElement>;
      buttons[nextIndex]?.focus();
    }
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled || undefined}
      data-active={isActive || undefined}
      disabled={disabled}
      onClick={() => { if (!disabled) onSelect(value); }}
      onKeyDown={handleKeyDown}
      className={`
        inline-flex items-center gap-2 px-3 py-2.5 text-body-sm font-medium
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
        disabled:cursor-not-allowed disabled:opacity-50
        ${triggerVariantMap[variant]}
        ${className}
      `}
    >
      {IconComponent && <IconComponent size={14} aria-hidden="true" />}
      {label}
      {badge != null && (
        <Badge variant="neutral" size="xs">{badge}</Badge>
      )}
    </button>
  );
};

/* ── Tabs Content ────────────────────────────────────────────────────── */

const TabsContent: FC<TabsContentProps> = ({
  value,
  children,
  lazy = false,
  className = '',
}) => {
  const { activeValue } = useTabsContext();
  const isActive = activeValue === value;

  if (lazy && !isActive) return null;

  return (
    <div
      role="tabpanel"
      aria-hidden={!isActive}
      className={isActive ? className : `hidden ${className}`}
    >
      {children}
    </div>
  );
};

/* ── Attach sub-components ───────────────────────────────────────────── */

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;
