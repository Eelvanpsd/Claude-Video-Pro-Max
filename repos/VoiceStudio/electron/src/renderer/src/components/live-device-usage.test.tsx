import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveDeviceUsage } from './live-device-usage';

const mocks = vi.hoisted(() => ({ usage: vi.fn(), retry: vi.fn(), stage: 'ready' }));
vi.mock('@/hooks/use-device-usage', () => ({ useDeviceUsage: mocks.usage }));
vi.mock('@/hooks/use-backend-status', () => ({ useBackendStatus: () => ({ stage: mocks.stage }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
afterEach(() => {
  cleanup();
  mocks.stage = 'ready';
});
const data = { cpu: 24, gpu_utilization: 61, ram: 18.5, total_ram: 63, vram: 9.2, total_vram: 24 };

it('shows live load and used/capacity memory independently', () => {
  mocks.usage.mockReturnValue({ data, isError: false });
  render(<LiveDeviceUsage open />);
  expect(screen.getByText('24%')).toBeVisible();
  expect(screen.getByText('61%')).toBeVisible();
  expect(screen.getByText('18.5 / 63 GB')).toBeVisible();
  expect(screen.getByText('9.2 / 24 GB')).toBeVisible();
  expect(mocks.usage).toHaveBeenLastCalledWith(true);
});
it('keeps genuine zero utilization distinct from unsupported GPU readings', () => {
  mocks.usage.mockReturnValue({
    data: { ...data, cpu: 0, gpu_utilization: null, total_vram: 0 },
    isError: false,
  });
  render(<LiveDeviceUsage open />);
  expect(screen.getByText('0%')).toBeVisible();
  expect(screen.getAllByText('modelSettings.unavailable')).toHaveLength(2);
});
it('hides stale readings on errors and offers retry', () => {
  mocks.usage.mockReturnValue({ data, isError: true, refetch: mocks.retry });
  render(<LiveDeviceUsage open />);
  expect(screen.queryByText('24%')).toBeNull();
  expect(screen.getAllByText('modelSettings.unavailable')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
  expect(mocks.retry).toHaveBeenCalledOnce();
});
it('identifies process-only VRAM when whole-device telemetry is unavailable', () => {
  mocks.usage.mockReturnValue({ data: { ...data, gpu_utilization: null }, isError: false });
  render(<LiveDeviceUsage open />);
  expect(screen.getByText('performanceHardware.appVram')).toBeVisible();
  expect(screen.getByText('9.2 / 24 GB')).toBeVisible();
});
it('does not present cached readings as live while the backend is offline', () => {
  mocks.stage = 'failed';
  mocks.usage.mockReturnValue({ data, isError: false });
  render(<LiveDeviceUsage open={false} />);
  expect(screen.queryByText('24%')).toBeNull();
  expect(screen.queryByText('performanceHardware.everyTwoSeconds')).toBeNull();
  expect(mocks.usage).toHaveBeenLastCalledWith(false);
});
