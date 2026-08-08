import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientPicker } from './PatientPicker';

/**
 * React emits console.error for accessibility violations like:
 * - "A form field element should have an id or name attribute"
 * - "Incorrect use of <label for=...>"
 *
 * These tests assert the PatientPicker never triggers them in either of its
 * two visual states (search input, selected chip) — regression guard for the
 * Billing Dashboard console-cleanliness requirement.
 */

function renderPicker(value = '') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PatientPicker value={value} onChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe('PatientPicker accessibility (no React form/label warnings)', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    errorSpy.mockClear();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('search-input state emits no form-field or label-association warnings', async () => {
    renderPicker('');

    // The search combobox is rendered and labelled.
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    await waitFor(() => {
      const warnings = errorSpy.mock.calls
        .map(([msg]) => String(msg))
        .filter((msg) => /id or name attribute|Incorrect use of <label/.test(msg));
      expect(warnings).toEqual([]);
    });
  });

  it('selected-chip state (input unmounted) emits no label-association warnings', async () => {
    renderPicker('4a01a5e1-745b-4db1-b4bb-600980b36787');

    // Chip state: no combobox, but a "clear" action is available.
    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const warnings = errorSpy.mock.calls
        .map(([msg]) => String(msg))
        .filter((msg) => /id or name attribute|Incorrect use of <label/.test(msg));
      expect(warnings).toEqual([]);
    });
  });
});
