import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DoctorRegisterForm } from './DoctorRegisterForm';

/**
 * F-04 REGRESSION TESTS — Premature auto-submit on Step 4.
 *
 * Contract under test:
 * - Steps 1→2→3 Continue buttons must NEVER trigger submission (0 mutation calls).
 * - Entering Step 4 (review) must trigger 0 mutation calls.
 * - Back from Step 4 and returning to Step 4 must trigger 0 mutation calls.
 * - Pressing Enter inside any input must trigger 0 mutation calls.
 * - Only clicking "Submit Application" calls onSubmit exactly once.
 * - Double-clicking Submit cannot issue a duplicate request.
 * - Invalid final data (failing Step 1 validation) prevents submit.
 */

describe('DoctorRegisterForm — F-04 no-auto-submit regression', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── Helpers ─────────────────────────────────────────────── */

  /** Fill Step 1 (Account) fields validly. */
  const fillStep1 = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/^Full name/), 'Dr. Juan Dela Cruz');
    await user.type(screen.getByLabelText(/^Email address/), 'juan@denscare.clinic');
    // Labels render a required marker ("Password *"), so anchor loosely.
    await user.type(screen.getByLabelText(/^Password/), 'Secret@1');
    await user.type(screen.getByLabelText(/^Confirm password/), 'Secret@1');
    await user.click(screen.getByRole('checkbox'));
  };

  /** Navigate to Step 4 (Review) through steps 2 and 3. */
  const navigateToReview = async (user: ReturnType<typeof userEvent.setup>) => {
    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Step 2 (Professional — all optional)
    await screen.findByText('Professional Details');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Step 3 (Personal — all optional)
    await screen.findByText('Personal Details');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Step 4 (Review)
    await screen.findByText('Review Your Application');
  };

  /* ── Steps 1–3: Continue must never submit ───────────────── */

  it('Step 1 Continue does not submit (mutation call count = 0)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Professional Details')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Step 2 Continue does not submit (mutation call count = 0)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Personal Details');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Professional Details');

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Personal Details')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Step 3 Continue does not submit (mutation call count = 0)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Personal Details');

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Review Your Application')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('entering Step 4 renders review state with 0 mutation calls', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);

    expect(screen.getByText('Review Your Application')).toBeInTheDocument();
    expect(screen.getByText('Dr. Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('juan@denscare.clinic')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Back from Step 4 does not submit (mutation call count = 0)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Personal Details')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('returning to Step 4 does not submit (mutation call count = 0)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Personal Details');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Review Your Application')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter key inside inputs on Steps 1–3 does not submit', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await fillStep1(user);
    await user.type(screen.getByLabelText(/^Full name/), '{enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Account Information')).toBeInTheDocument();
  });

  /* ── Final submit: exactly one call ───────────────────────── */

  it('Submit Application calls onSubmit exactly once with form values', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Submit Application' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Dr. Juan Dela Cruz',
        email: 'juan@denscare.clinic',
      }),
    );
  });

  it('double-click Submit Application cannot issue duplicate request', async () => {
    let resolveSubmit!: () => void;
    onSubmit.mockImplementation(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; }),
    );

    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    expect(onSubmit).not.toHaveBeenCalled();

    const submitBtn = screen.getByRole('button', { name: 'Submit Application' });
    await user.click(submitBtn);
    await user.click(submitBtn);
    await user.click(submitBtn);

    resolveSubmit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('failed submit remains recoverable (error shown, retry succeeds)', async () => {
    onSubmit.mockRejectedValueOnce(new Error('Registration number is already in use'));

    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await navigateToReview(user);
    await user.click(screen.getByRole('button', { name: 'Submit Application' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Registration number is already in use',
    );
    expect(screen.getByText('Review Your Application')).toBeInTheDocument();

    onSubmit.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Submit Application' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it('invalid Step 1 data prevents submission entirely', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Full name/), 'J');
    await user.type(screen.getByLabelText(/^Email address/), 'not-an-email');
    await user.type(screen.getByLabelText(/^Password/), 'short');
    await user.type(screen.getByLabelText(/^Confirm password/), 'different');

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Submit Application' }),
    ).not.toBeInTheDocument();
  });

  it('stepper marks the active step with aria-current="step" (P2 a11y)', async () => {
    const user = userEvent.setup();
    render(<DoctorRegisterForm onSubmit={onSubmit} />);

    // Step 1 active
    expect(screen.getByLabelText('Step 1: Account')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Step 2: Professional')).not.toHaveAttribute(
      'aria-current',
    );

    // Move to Step 2 → aria-current follows
    await user.type(screen.getByLabelText(/^Full name/), 'Dr. Juan Dela Cruz');
    await user.type(screen.getByLabelText(/^Email address/), 'juan@denscare.clinic');
    await user.type(screen.getByLabelText(/^Password/), 'Secret@1');
    await user.type(screen.getByLabelText(/^Confirm password/), 'Secret@1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Professional Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2: Professional')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Step 1: Account')).not.toHaveAttribute(
      'aria-current',
    );
  });
});
