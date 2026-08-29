import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CalendarFilters } from './CalendarFilters';
import * as useDoctorsModule from '../../../hooks/doctors/useDoctors';

vi.mock('../../../hooks/doctors/useDoctors', () => ({
  useDoctors: vi.fn(),
}));

const mockUseDoctors = vi.mocked(useDoctorsModule.useDoctors);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('CalendarFilters', () => {
  const defaultProps = {
    dentistId: null,
    onDentistChange: vi.fn(),
    statusFilter: 'all' as const,
    onStatusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDoctors.mockReturnValue({
      data: {
        items: [
          { user_id: 10, user_full_name: 'Dr. Sarah Johnson', doctor_code: 'DOC-001' },
          { user_id: 20, user_full_name: 'Dr. Maria Reyes', doctor_code: 'DOC-002' },
        ],
        total: 2,
        page: 1,
        page_size: 20,
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useDoctorsModule.useDoctors>);
  });

  it('renders dentist filter with All Dentists option', () => {
    render(<CalendarFilters {...defaultProps} />, { wrapper: createWrapper() });
    const dentistSelect = screen.getByRole('combobox', { name: /filter by dentist/i });
    expect(dentistSelect).toBeInTheDocument();
    expect(screen.getByText('All Dentists')).toBeInTheDocument();
  });

  it('renders status filter with All option', () => {
    render(<CalendarFilters {...defaultProps} />, { wrapper: createWrapper() });
    const statusSelect = screen.getByRole('combobox', { name: /filter by status/i });
    expect(statusSelect).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('calls onDentistChange when dentist filter changes', () => {
    const onDentistChange = vi.fn();
    render(<CalendarFilters {...defaultProps} onDentistChange={onDentistChange} />, {
      wrapper: createWrapper(),
    });
    const dentistSelect = screen.getByRole('combobox', { name: /filter by dentist/i });
    fireEvent.change(dentistSelect, { target: { value: '10' } });
    expect(onDentistChange).toHaveBeenCalledWith(10);
  });

  it('calls onStatusChange when status filter changes', () => {
    const onStatusChange = vi.fn();
    render(<CalendarFilters {...defaultProps} onStatusChange={onStatusChange} />, {
      wrapper: createWrapper(),
    });
    const statusSelect = screen.getByRole('combobox', { name: /filter by status/i });
    fireEvent.change(statusSelect, { target: { value: 'Scheduled' } });
    expect(onStatusChange).toHaveBeenCalledWith('Scheduled');
  });

  it('passes null when All Dentists is selected', () => {
    const onDentistChange = vi.fn();
    render(
      <CalendarFilters {...defaultProps} dentistId={10} onDentistChange={onDentistChange} />,
      { wrapper: createWrapper() },
    );
    const dentistSelect = screen.getByRole('combobox', { name: /filter by dentist/i });
    fireEvent.change(dentistSelect, { target: { value: '' } });
    expect(onDentistChange).toHaveBeenCalledWith(null);
  });

  it('disables dentist select while loading', () => {
    mockUseDoctors.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useDoctorsModule.useDoctors>);

    render(<CalendarFilters {...defaultProps} />, { wrapper: createWrapper() });
    const dentistSelect = screen.getByRole('combobox', { name: /filter by dentist/i });
    expect(dentistSelect).toBeDisabled();
  });
});
