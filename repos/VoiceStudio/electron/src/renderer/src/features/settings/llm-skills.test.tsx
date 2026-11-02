import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiJson: mock.api }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./llm-providers', () => ({
  useLlmProviderCatalogue: () => ({ data: { providers: [] } }),
}));
import { LlmSkills } from './llm-skills';
import { queryKeys } from '@/lib/query';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('refreshes consumers when a skill is enabled or disabled', async () => {
  const skill = { id: 'dub_translation', name_key: 'translation', enabled: true, ready: true };
  mock.api.mockImplementation((_path: string, init?: RequestInit) =>
    Promise.resolve({ skills: [{ ...skill, enabled: init?.method !== 'PUT' }] }),
  );
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <LlmSkills />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('switch', { name: 'translation' }));
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'translation' })).not.toBeChecked(),
  );
  for (const key of [['translation-engines'], ['dictation-refinement'], queryKeys.engines]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  }
});
