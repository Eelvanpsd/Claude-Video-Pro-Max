import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiJson: mock.api,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { LlmProviders } from './llm-providers';
import { ApiError } from '@/lib/api/client';

const ollama = {
  configured: true,
  id: 'ollama',
  display_name: 'Ollama (local)',
  local: true,
  needs_account: false,
  base_url: 'http://localhost:11434/v1',
  model: 'llama3.1',
  signup_url: 'https://ollama.com',
  notes: 'Local provider',
  has_key: true,
  has_api_key: false,
  key_from_env: false,
  base_url_from_env: false,
  model_from_env: false,
  active_from_env: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each([
  [400, 'settings.llmp_err_config'],
  [409, 'settings.llmp_active_env_pin'],
])('explains activation rejection %s without reporting success', async (status, message) => {
  mock.api.mockImplementation((path: string) =>
    path === '/api/settings/llm-providers'
      ? Promise.resolve({ active: null, providers: [ollama] })
      : Promise.reject(new ApiError(status as number, 'private diagnostics')),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'settings.llmp_connect' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByText('private diagnostics')).not.toBeInTheDocument();
});

it('allows activating the pinned provider but disables an environment-blocked engine', async () => {
  let blocked = false;
  mock.api.mockImplementation(() =>
    Promise.resolve({
      active: 'ollama',
      providers: [{ ...ollama, active_from_env: true, activation_blocked: blocked }],
    }),
  );
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'settings.llmp_connect' })).toBeEnabled();
  blocked = true;
  await client.invalidateQueries({ queryKey: ['llm-providers'] });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'settings.llmp_connect' })).toBeDisabled(),
  );
});

it('opens on the local provider and activates the matching LLM engine in one action', async () => {
  mock.api.mockImplementation((path: string) => {
    if (path === '/api/settings/llm-providers')
      return Promise.resolve({ active: null, providers: [ollama] });
    if (path.endsWith('/connect'))
      return Promise.resolve({ ok: true, model: 'llama3.1', latency_ms: 5 });
    if (path === '/api/settings/llm-providers/ollama')
      return Promise.resolve({ active: 'ollama', providers: [ollama] });
    return Promise.resolve({});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LlmProviders />
    </QueryClientProvider>,
  );

  expect(await screen.findByDisplayValue('http://localhost:11434/v1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'settings.llmp_connect' }));

  await waitFor(() =>
    expect(mock.api).toHaveBeenCalledWith(
      '/api/settings/llm-providers/ollama',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          base_url: ollama.base_url,
          model: ollama.model,
          make_active: false,
          activate_if_unset: false,
        }),
      }),
    ),
  );
  await screen.findByText('settings.llmp_test_ok');
  expect(mock.api.mock.calls.some(([path]) => path.endsWith('/connect'))).toBe(true);
  expect(mock.api.mock.calls.some(([path]) => path === '/engines/select')).toBe(false);
});

it('supports authenticated local servers and saves credentials before testing without activating', async () => {
  mock.api.mockImplementation((path: string) => {
    if (path === '/api/settings/llm-providers')
      return Promise.resolve({ active: null, providers: [ollama] });
    if (path.endsWith('/test'))
      return Promise.resolve({ ok: true, model: 'llama3.1', latency_ms: 5 });
    return Promise.resolve({});
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText('settings.llmp_optional_key'));
  const key = await screen.findByLabelText('settings.llmp_api_key', { selector: 'input' });
  expect(key).toHaveAttribute('placeholder', 'settings.llmp_key_paste');
  fireEvent.change(key, { target: { value: 'local-auth-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'settings.llmp_test' }));
  await screen.findByText('settings.llmp_test_ok');
  const calls = mock.api.mock.calls.filter(
    ([, init]) => init?.method === 'PUT' || init?.method === 'POST',
  );
  expect(calls.map(([path]) => path)).toEqual([
    '/api/settings/llm-providers/ollama',
    '/api/settings/llm-providers/ollama/test',
  ]);
  expect(JSON.parse(calls[0][1].body)).toMatchObject({
    api_key: 'local-auth-token',
    make_active: false,
    activate_if_unset: false,
  });
  expect(key).toHaveValue('');
});

it('shows a successful empty model listing and never sends a probe after save failure', async () => {
  let failSave = false;
  mock.api.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/api/settings/llm-providers')
      return Promise.resolve({ active: null, providers: [ollama] });
    if (init?.method === 'PUT' && failSave) return Promise.reject(new Error('save failed'));
    if (path.endsWith('/models'))
      return Promise.resolve({ ok: true, models: [], truncated: false });
    return Promise.resolve({});
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'settings.llmp_fetch_models' }));
  await screen.findByText('settings.llmp_models_loaded');
  failSave = true;
  fireEvent.click(screen.getByRole('button', { name: 'settings.llmp_test' }));
  await screen.findByRole('alert');
  expect(mock.api.mock.calls.some(([path]) => path.endsWith('/test'))).toBe(false);
});

it('shows connection failure without claiming the provider is active', async () => {
  mock.api.mockImplementation((path: string) => {
    if (path === '/api/settings/llm-providers')
      return Promise.resolve({ active: null, engine_active: 'off', providers: [ollama] });
    if (path.endsWith('/connect')) return Promise.resolve({ ok: false, kind: 'network' });
    return Promise.resolve({});
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'settings.llmp_connect' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('settings.llmp_err_network');
  expect(screen.getByText('settings.llmp_setup_hint')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'settings.llmp_disable' })).not.toBeInTheDocument();
});

it('turns the active LLM off without erasing provider credentials', async () => {
  let enabled = true;
  mock.api.mockImplementation((path: string) => {
    if (path === '/engines/select') {
      enabled = false;
      return Promise.resolve({ active: 'off' });
    }
    return Promise.resolve({
      active: 'ollama',
      engine_active: enabled ? 'openai-compat' : 'off',
      providers: [ollama],
    });
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LlmProviders />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'settings.llmp_disable' }));
  await screen.findByText('settings.llmp_setup_hint');
  expect(mock.api).toHaveBeenCalledWith(
    '/engines/select',
    expect.objectContaining({ body: JSON.stringify({ family: 'llm', backend_id: 'off' }) }),
  );
  expect(mock.api.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});
