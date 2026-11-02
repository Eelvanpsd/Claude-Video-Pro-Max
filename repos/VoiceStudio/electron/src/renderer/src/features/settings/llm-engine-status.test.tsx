import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ engines: vi.fn(), api: vi.fn() }));
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiJson: mock.api,
}));
vi.mock('@/hooks/use-engines', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-engines')>()),
  useEngines: mock.engines,
}));
vi.mock('./model-catalogue-query', () => ({ useModelCatalogue: () => ({}) }));
vi.mock('./llm-providers', () => ({
  LlmProviders: () => <h3 id="llm-provider">Provider settings</h3>,
}));
vi.mock('./llm-skills', () => ({ LlmSkills: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ModelSettings } from './model-settings';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(active: string, available = false, client = new QueryClient()) {
  mock.engines.mockReturnValue({
    data: {
      llm: {
        active,
        backends: [
          { id: 'off', display_name: 'Off (no LLM)', available: true, effective_device: 'network' },
          {
            id: 'openai-compat',
            display_name: 'OpenAI-compatible',
            available,
            effective_device: 'network',
            reason: 'Selected provider needs an API key.',
            install_hint: 'Set TRANSLATE_BASE_URL',
            hint: available ? 'Ollama · local-model' : null,
          },
        ],
      },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <ModelSettings family="llm" />
    </QueryClientProvider>,
  );
}

it.each(['off', 'openai-compat'])(
  'uses provider setup instead of the duplicate engine matrix for %s',
  (active) => {
    show(active);
    expect(screen.getByText('Provider settings')).toBeVisible();
    expect(screen.queryByText('Off (no LLM)')).not.toBeInTheDocument();
    expect(screen.queryByText('modelSettings.unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('network')).not.toBeInTheDocument();
  },
);
