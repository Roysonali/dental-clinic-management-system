import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HeaderBranding } from './HeaderBranding';

describe('HeaderBranding — fixed application branding area', () => {
  it('renders the DensCare logo with the wordmark', () => {
    render(<HeaderBranding />);

    // The shared Logo component renders the "Dens" + "Care" wordmark in the
    // desktop branding block.
    const desktop = screen.getByTestId('header-branding-desktop');
    expect(within(desktop).getByText('Dens')).toBeInTheDocument();
    expect(within(desktop).getByText('Care')).toBeInTheDocument();
  });

  it('renders the brand mark as a decorative image (aria-hidden, not text)', () => {
    render(<HeaderBranding />);

    // Both the desktop (full) and compact (icon-only) variants render in
    // jsdom; every variant draws the tooth icon as aria-hidden SVG art.
    const compact = screen.getByTestId('header-branding-compact');
    expect(compact.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('aligns the desktop branding block with the sidebar width', () => {
    render(<HeaderBranding />);

    const desktopBlock = screen.getByTestId('header-branding-desktop');
    // The desktop block is fixed to the sidebar width token so the branding
    // area aligns exactly with the sidebar below it.
    expect(desktopBlock.className).toContain('w-[var(--sidebar-width)]');
  });
});
