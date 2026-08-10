import type { FC } from 'react';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';

interface MobileBillingHeaderProps {
  /** Page title (e.g. "Invoices" / "Payments") */
  title: string;
  /** Accessible label for the primary add action (e.g. "New invoice"). */
  addLabel: string;
  /** Called when the top-right + button is tapped. */
  onAdd?: () => void;
}

/**
 * MobileBillingHeader — compact page header for the mobile billing list
 * screens (reference screens 47/48).
 *
 * Thin billing-specific wrapper over the shared MobilePageHeader — the
 * hamburger (opens the app's navigation drawer), large bold title and
 * icon-only blue + action all come from the shared implementation.
 */
export const MobileBillingHeader: FC<MobileBillingHeaderProps> = ({
  title,
  addLabel,
  onAdd,
}) => {
  return <MobilePageHeader title={title} addLabel={addLabel} onAdd={onAdd} />;
};
