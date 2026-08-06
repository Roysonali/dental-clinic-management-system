import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorToolbar } from './DoctorToolbar';
import type { SpecializationResponse } from '../../types/doctor';

const specializations: SpecializationResponse[] = [
  { id: 1, name: 'Orthodontics', code: 'ORTHO', description: null, is_active: true },
  { id: 2, name: 'Endodontics', code: 'ENDO', description: null, is_active: true },
];

describe('DoctorToolbar', () => {
  it('renders search with the backend-accurate placeholder (code or name only)', () => {
    renderWithProviders(
      <DoctorToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        status="all"
        onStatusChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        specializations={specializations}
        specializationId={null}
        onSpecializationChange={vi.fn()}
        onRegister={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('searchbox', { name: 'Search by doctor code or name…' }),
    ).toBeInTheDocument();
  });

  it('renders the status and availability filter groups', () => {
    renderWithProviders(
      <DoctorToolbar
        status="all"
        onStatusChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        specializations={specializations}
        specializationId={null}
        onSpecializationChange={vi.fn()}
        onRegister={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by availability' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Available' })).toBeInTheDocument();
  });

  it('renders specialization options from the backend master data', () => {
    renderWithProviders(
      <DoctorToolbar
        status="all"
        onStatusChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        specializations={specializations}
        specializationId={null}
        onSpecializationChange={vi.fn()}
        onRegister={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: 'All specializations' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Orthodontics' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Endodontics' })).toBeInTheDocument();
  });

  it('fires filter callbacks with mapped values', () => {
    const onStatusChange = vi.fn();
    const onAvailabilityChange = vi.fn();
    const onSpecializationChange = vi.fn();
    renderWithProviders(
      <DoctorToolbar
        status="all"
        onStatusChange={onStatusChange}
        availability="all"
        onAvailabilityChange={onAvailabilityChange}
        specializations={specializations}
        specializationId={null}
        onSpecializationChange={onSpecializationChange}
        onRegister={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));
    expect(onStatusChange).toHaveBeenCalledWith('inactive');

    fireEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
    expect(onAvailabilityChange).toHaveBeenCalledWith('unavailable');

    fireEvent.change(screen.getByLabelText('Filter by specialization'), {
      target: { value: '2' },
    });
    expect(onSpecializationChange).toHaveBeenCalledWith(2);
  });

  it('renders the Register Doctor CTA and fires onRegister', () => {
    const onRegister = vi.fn();
    renderWithProviders(
      <DoctorToolbar
        status="all"
        onStatusChange={vi.fn()}
        availability="all"
        onAvailabilityChange={vi.fn()}
        specializations={specializations}
        specializationId={null}
        onSpecializationChange={vi.fn()}
        onRegister={onRegister}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Register Doctor' }));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });
});
