import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AudioLinesIcon } from 'lucide-react';
import { EngineRow, compactEngineName } from './engine-row';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, ...props }: { to: string; params: { family: string } }) => (
    <a href={to.replace('$family', params.family)} {...props} />
  ),
}));
afterEach(cleanup);
const row = {
  family: 'tts',
  Icon: AudioLinesIcon,
  title: 'KittenTTS (English, 8 voices)',
  detail: 'kitten/default',
  runtime: 'cpu',
  state: 'engineRuntime.ready',
};

it('keeps models compact and shows full diagnostics only when explicitly expanded', () => {
  const toggle = vi.fn();
  const view = render(
    <EngineRow
      row={row}
      level="details"
      online
      dotClass="bg-success"
      open={false}
      onToggle={toggle}
    />,
  );
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('kitten/default')).toBeNull();
  fireEvent.click(button);
  expect(toggle).toHaveBeenCalledOnce();
  view.rerender(
    <EngineRow row={row} level="details" online dotClass="bg-success" open onToggle={toggle} />,
  );
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('kitten/default')).toBeVisible();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/settings/models/tts');
});
it('shows loading text and busy semantics while preserving offline override', () => {
  const view = render(
    <EngineRow
      row={{ ...row, state: 'preferences.loading' }}
      level="models"
      online
      dotClass=""
      open={false}
      onToggle={() => {}}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('preferences.loading');
  view.rerender(
    <EngineRow
      row={{ ...row, state: 'preferences.loading' }}
      level="models"
      online={false}
      dotClass=""
      open={false}
      onToggle={() => {}}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('modelMaintenance.offline');
});
it('shortens capability descriptions without damaging model variants', () => {
  expect(compactEngineName('KittenTTS (English, 8 voices)')).toBe('KittenTTS');
  expect(compactEngineName('Whisper large-v3')).toBe('Whisper large-v3');
});
