import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Logo } from './Logo';

describe('Logo — shared DensCare branding (actual assets)', () => {
  it('renders the brand mark + DensCare nameplate (default, navy on light)', () => {
    const { container } = render(<Logo />);

    const nameplate = screen.getByAltText('DensCare');
    expect(nameplate).toHaveAttribute('src', expect.stringContaining('name.png'));
    // The mark is decorative when the nameplate is adjacent (alt="" keeps it
    // out of the accessibility tree — exactly one "DensCare" announcement).
    const mark = container.querySelector('img[alt=""]');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('src')).toContain('logo.png');
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('renders the mark alone with the brand name when compact (showText=false)', () => {
    render(<Logo showText={false} />);

    const mark = screen.getByAltText('DensCare');
    expect(mark).toHaveAttribute('src', expect.stringContaining('logo.png'));
    expect(screen.queryByAltText('DensCare')?.getAttribute('src')).toContain('logo.png');
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('renders the nameplate alone for the header branding block (nameplateOnly)', () => {
    render(<Logo nameplateOnly size={38} />);

    const nameplate = screen.getByAltText('DensCare');
    expect(nameplate).toHaveAttribute('src', expect.stringContaining('name.png'));
    // Only the nameplate renders — no separate mark.
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('renders a white rendition of the actual artwork for dark surfaces (variant=light)', () => {
    render(<Logo variant="light" />);

    // Masked spans carry the accessible brand name; the artwork URL comes
    // from the real assets.
    const named = screen.getByRole('img', { name: 'DensCare' });
    expect(named.style.maskImage).toContain('name.png');
    expect(named.style.backgroundColor).toBe('rgb(255, 255, 255)');
    // The mark is decorative next to the nameplate.
    const hidden = screen.getAllByRole('img', { hidden: true });
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('preserves explicit dimensions to avoid layout shift', () => {
    render(<Logo />);

    const nameplate = screen.getByAltText('DensCare');
    expect(nameplate.getAttribute('width')).toBeTruthy();
    expect(nameplate.getAttribute('height')).toBeTruthy();
  });

  it('keeps the row layout when wrapped with a className', () => {
    const { container } = render(<Logo className="absolute top-10 left-8" />);
    expect(container.firstElementChild?.className).toContain('absolute top-10 left-8');
  });

  it('announces the brand exactly once (decorative mark + informative nameplate)', () => {
    const { container } = render(<Logo />);
    // Exactly one accessible "DensCare" in the tree — the nameplate.
    expect(within(container).getByRole('img', { name: 'DensCare' })).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('never renders empty when nameplateOnly is combined with showText=false', () => {
    const { container } = render(<Logo nameplateOnly showText={false} />);
    // Guard: nameplateOnly always renders the nameplate (no silent no-render).
    const nameplate = screen.getByAltText('DensCare');
    expect(nameplate).toHaveAttribute('src', expect.stringContaining('name.png'));
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
