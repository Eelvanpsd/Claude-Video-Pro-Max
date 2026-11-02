import { expect, it } from 'vitest';
import { readWavInfo } from './wav-info';

function wav(format: number, bits: number, extended = false) {
  const buffer = new ArrayBuffer(extended ? 60 : 36);
  const view = new DataView(buffer);
  const tag = (offset: number, text: string) =>
    [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  tag(0, 'RIFF');
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, extended ? 40 : 16, true);
  view.setUint16(20, extended ? 0xfffe : format, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 48000, true);
  view.setUint16(34, bits, true);
  if (extended) view.setUint16(44, format, true);
  return buffer;
}

it.each([
  [1, 16, 'PCM'],
  [1, 24, 'PCM'],
  [3, 32, 'float'],
] as const)('reads the actual WAV precision (%s, %s)', (format, bits, encoding) => {
  expect(readWavInfo(wav(format, bits))).toEqual({
    channels: 2,
    sampleRate: 48000,
    bits,
    encoding,
  });
  expect(readWavInfo(wav(format, bits, true))?.encoding).toBe(encoding);
});

it('rejects truncated, non-WAV and unsupported formats without throwing', () => {
  expect(readWavInfo(new ArrayBuffer(3))).toBeNull();
  expect(readWavInfo(new ArrayBuffer(60))).toBeNull();
  expect(readWavInfo(wav(3, 32).slice(0, 30))).toBeNull();
  expect(readWavInfo(wav(6, 8))).toBeNull();
});
