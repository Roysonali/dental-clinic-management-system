import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { MobileCardList } from './MobileCardList';

const renderList = (props: Partial<Parameters<typeof MobileCardList<string>>[0]> = {}) =>
  render(
    <MobileCardList<string>
      items={['a', 'b']}
      loading={false}
      emptyTitle="Nothing here"
      emptyDescription="Nothing yet."
      renderCard={(item) => <div key={item}>card:{item}</div>}
      {...props}
    />,
  );

describe('MobileCardList', () => {
  it('renders the injected cards for the items', () => {
    renderList();
    expect(screen.getByText('card:a')).toBeInTheDocument();
    expect(screen.getByText('card:b')).toBeInTheDocument();
  });

  it('renders card-shaped skeletons while loading', () => {
    renderList({ loading: true, loadingLabel: 'Loading rows' });
    expect(screen.getByLabelText('Loading rows')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the shared error state with a retry action', () => {
    const onRetry = vi.fn();
    renderList({ error: 'Something failed', onRetry });
    expect(screen.getByText('Something failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers Clear filters from the empty state when filters are active', () => {
    const onClearFilters = vi.fn();
    renderList({ items: [], hasActiveFilters: true, onClearFilters });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('uses the plain empty title when no filters are active', () => {
    renderList({ items: [] });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
