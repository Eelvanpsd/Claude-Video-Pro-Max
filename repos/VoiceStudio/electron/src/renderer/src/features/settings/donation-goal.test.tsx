import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { DonationGoal } from './donation-goal';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([false, true])(
  'keeps offline data or renders a completed snapshot (%s)',
  async (success) => {
    const fetcher = vi.fn().mockImplementation(() =>
      success
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ raised: 250, goal: 200, currency: 'USD', sponsorCount: 2 }),
          })
        : Promise.reject(new Error('offline')),
    );
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DonationGoal />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
    await client.invalidateQueries({ queryKey: ['donation-progress'] });
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        success ? '100' : '5',
      ),
    );
    expect(fetcher).toHaveBeenCalled();
    if (success) expect(screen.getByText('donate.goal.met')).toBeInTheDocument();
  },
);
