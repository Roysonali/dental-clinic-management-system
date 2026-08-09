import { createContext, useContext, type ReactNode } from 'react';

/**
 * Mobile nav context — lets the compact mobile page header (rendered inside
 * the Workspace) open the application's slide-in navigation drawer, which is
 * owned by the AppShell.
 *
 * On the mobile billing list pages the global header (which normally owns
 * the hamburger) is hidden so the page renders its own compact header; this
 * context is the wiring that keeps the drawer opening behaviour in one
 * place (the AppShell) instead of duplicating drawer state in every page.
 */
export interface MobileNavContextValue {
  /** Open the slide-in navigation drawer (mobile viewports only). */
  openNav: () => void;
  /** Current drawer open state (drives the hamburger's aria-expanded). */
  isOpen?: boolean;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/** Access the mobile nav drawer opener. Must be rendered under the AppShell. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook + provider pair is this file's public API (same pattern as Icon.tsx's exported constant).
export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error('useMobileNav must be used within the AppShell (MobileNavProvider)');
  }
  return ctx;
}

interface MobileNavProviderProps {
  value: MobileNavContextValue;
  children: ReactNode;
}

export const MobileNavProvider = ({ value, children }: MobileNavProviderProps) => (
  <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
);
