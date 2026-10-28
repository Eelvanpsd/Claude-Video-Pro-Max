"""Sub-bass share of a film's soundtrack: energy in 20-60 Hz (and 60-120 Hz) relative to the whole band, in dB.
usage: python -I tools/lowcheck.py film.mp4 [film2.mp4 ...]"""
import sys, subprocess
import numpy as np
for f in sys.argv[1:]:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    F = np.fft.rfftfreq(len(x), 1 / 48000); P = np.abs(np.fft.rfft(x)) ** 2
    tot = P[(F >= 20) & (F < 20000)].sum()
    b = lambda a, c: 10 * np.log10(P[(F >= a) & (F < c)].sum() / tot)
    print(f'{f.split("/")[-1]:32s} 20-60 Hz {b(20, 60):6.1f} dB   60-120 Hz {b(60, 120):6.1f} dB   120-500 Hz {b(120, 500):6.1f} dB')
