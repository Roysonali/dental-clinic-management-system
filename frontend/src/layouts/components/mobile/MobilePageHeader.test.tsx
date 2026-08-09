import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { MobilePageHeader } from './MobilePageHeader';
import { MobileNavProvider } from './MobileNavContext';

function renderHeader(props: { onAdd?: () => void } = {}) {
  const openNav = vi.fn();
  render(
    <MobileNavProvider value={{ openNav }}>
      <MobilePageHeader title="Patients" addLabel="Register patient" onAdd={props.onAdd} />
    </MobileNavProvider>,
  );
  return { openNav };
}

describe('MobilePageHeader', () => {
  it('renders the title and an accessible hamburger that opens the nav drawer', () => {
    const { openNav } = renderHeader();
    expect(screen.getByRole('heading', { name: 'Patients' })).toBeInTheDocument();

    const hamburger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(hamburger);
    expect(openNav).toHaveBeenCalledTimes(1);
  });

  it('renders the add action with its accessible label and fires onAdd', () => {
    const onAdd = vi.fn();
    renderHeader({ onAdd });
    fireEvent.click(screen.getByRole('button', { name: 'Register patient' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('does not render an add button when onAdd is omitted', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Register patient' })).not.toBeInTheDocument();
  });
});
