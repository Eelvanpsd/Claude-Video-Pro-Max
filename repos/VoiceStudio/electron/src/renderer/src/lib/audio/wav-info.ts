export interface WavInfo {
  sampleRate: number;
  channels: number;
  bits: number;
  encoding: 'PCM' | 'float';
}

/** Inspect a bounded WAV header without decoding or changing its samples. */
export function readWavInfo(buffer: ArrayBuffer): WavInfo | null {
  const view = new DataView(buffer);
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (view.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    if (tag(offset) === 'fmt ') {
      if (size < 16 || offset + 8 + size > view.byteLength) return null;
      let format = view.getUint16(offset + 8, true);
      if (format === 0xfffe && size >= 40) format = view.getUint16(offset + 32, true);
      const channels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      const bits = view.getUint16(offset + 22, true);
      if (![1, 3].includes(format) || !channels || !sampleRate || !bits) return null;
      return { channels, sampleRate, bits, encoding: format === 3 ? 'float' : 'PCM' };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}
