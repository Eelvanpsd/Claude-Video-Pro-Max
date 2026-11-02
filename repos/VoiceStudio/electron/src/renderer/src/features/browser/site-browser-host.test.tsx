import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SiteBrowserHost } from './site-browser-host';

const mocks = vi.hoisted(() => ({
  state: vi.fn(async () => null),
  onState: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('@/components/bridge', () => ({ getBridge: () => ({ browser: mocks }) }));
vi.mock('./site-browser-page', () => ({
  SiteBrowserPage: () => <div data-testid="embedded-browser" />,
}));
afterEach(cleanup);

it('preserves the workspace DOM, draft and keyboard focus when browsing and returning', async () => {
  let update: (value: unknown) => void = () => {};
  mocks.onState.mockImplementation((callback) => {
    update = callback;
    return mocks.unsubscribe;
  });
  const { unmount } = render(
    <SiteBrowserHost>
      <input aria-label="Draft" />
    </SiteBrowserHost>,
  );
  const draft = screen.getByRole('textbox', { name: 'Draft' });
  fireEvent.change(draft, { target: { value: 'My unsaved voice script' } });
  draft.focus();
  await act(async () => update({ url: 'https://voicestudio.sh' }));
  expect(screen.getByTestId('embedded-browser')).toBeVisible();
  expect(draft.parentElement).toHaveAttribute('inert');
  act(() => update(null));
  await waitFor(() => expect(draft).toHaveFocus());
  expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
  expect(draft).toHaveValue('My unsaved voice script');
  expect(draft.parentElement).not.toHaveAttribute('inert');
  expect(screen.queryByTestId('embedded-browser')).not.toBeInTheDocument();
  unmount();
  expect(mocks.unsubscribe).toHaveBeenCalled();
});
