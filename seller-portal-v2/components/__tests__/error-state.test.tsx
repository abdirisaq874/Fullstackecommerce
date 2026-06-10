/**
 * H7 example test — ErrorState component.
 *
 * Renders the shared `ErrorState` from `components/data/states` and asserts:
 *  1. The "Something went wrong" heading is shown.
 *  2. A custom `message` overrides the default copy.
 *  3. Clicking the Retry button invokes the `onRetry` callback.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/data/states';

describe('ErrorState', () => {
  it('renders the default heading', () => {
    render(<ErrorState />);
    expect(
      screen.getByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it('shows a custom message when provided', () => {
    render(<ErrorState message="Network unavailable" />);
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
  });

  it('calls onRetry when the Retry button is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<ErrorState onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
