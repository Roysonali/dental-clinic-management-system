/**
 * MobileBottomNav — billing entry point for the shared mobile bottom
 * navigation (reference screens 47/48).
 *
 * Re-exports the shared implementation with the canonical four destinations
 * (Dashboard / Invoices / Payments / Receipts). Kept as a module-local
 * export so existing billing imports and tests are unaffected.
 */
export {
  MobileBottomNav,
  DEFAULT_MOBILE_BOTTOM_NAV_ITEMS,
  type MobileBottomNavItem,
} from '../../../layouts/components/mobile/MobileBottomNav';
