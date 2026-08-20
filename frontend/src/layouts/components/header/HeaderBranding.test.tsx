import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HeaderBranding } from './HeaderBranding';

describe('HeaderBranding — fixed application branding area', () => {
  it('renders the actual DensCare nameplate asset in the desktop block', () => {
    render(<HeaderBranding />);

    // Desktop: the complete name.png nameplate (alt "DensCare") only.
    const desktop = screen.getByTestId('header-branding-desktop');
    const nameplate = within(desktop).getByAltText('DensCare');
    expect(nameplate.tagName.toLowerCase()).toBe('img');
    expect(nameplate).toHaveAttribute('src', expect.stringContaining('name.png'));
  });

  it('renders the actual brand mark asset in the compact block (no wordmark)', () => {
    render(<HeaderBranding />);

    // Tablet/mobile: the square logo.png mark, carrying the brand name.
    const compact = screen.getByTestId('header-branding-compact');
    const mark = within(compact).getByAltText('DensCare');
    expect(mark.tagName.toLowerCase()).toBe('img');
    expect(mark).toHaveAttribute('src', expect.stringContaining('logo.png'));
  });

  it('aligns the desktop branding block with the sidebar width', () => {
    render(<HeaderBranding />);

    const desktopBlock = screen.getByTestId('header-branding-desktop');
    // The desktop block is fixed to the sidebar width token so the branding
    // area aligns exactly with the sidebar below it.
    expect(desktopBlock.className).toContain('w-[var(--sidebar-width)]');
  });
});
