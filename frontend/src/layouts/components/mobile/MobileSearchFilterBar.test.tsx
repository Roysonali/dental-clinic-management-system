import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { MobileSearchFilterBar } from './MobileSearchFilterBar';

describe('MobileSearchFilterBar', () => {
  it('renders the search input bound to the search value', () => {
    render(
      <MobileSearchFilterBar
        searchValue="marcus"
        onSearchChange={() => undefined}
        onOpenFilters={() => undefined}
        searchPlaceholder="Search patients"
      />,
    );
    expect(screen.getByPlaceholderText('Search patients')).toHaveValue('marcus');
  });

  it('forwards search changes to the handler', () => {
    const onSearchChange = vi.fn();
    render(
      <MobileSearchFilterBar
        searchValue=""
        onSearchChange={onSearchChange}
        onOpenFilters={() => undefined}
        searchPlaceholder="Search patients"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Search patients'), { target: { value: 'amy' } });
    expect(onSearchChange).toHaveBeenCalledWith('amy');
  });

  it('opens filters from the filter button', () => {
    const onOpenFilters = vi.fn();
    render(
      <MobileSearchFilterBar
        searchValue=""
        onSearchChange={() => undefined}
        onOpenFilters={onOpenFilters}
        searchPlaceholder="Search patients"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});
