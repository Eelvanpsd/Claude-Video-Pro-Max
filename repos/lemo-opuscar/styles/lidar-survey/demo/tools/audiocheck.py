"""Momentary loudness (400 ms, K-weighting approximation) of the mix: the loudest moments, the level of the two
designed impacts against the program, and the depth of the near silence before the turn.
usage: python -I tools/audiocheck.py <demo_dir>"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
D = sys.argv[1]
x, sr = sf.read(os.path.join(D, 'out/mix.wav')); x = x.mean(1)
T = json.load(open(os.path.join(D, 'timeline.json')))['T']
k = sosfilt(butter(2, 60, 'high', fs=sr, output='sos'), x); k = k + 0.6 * sosfilt(butter(2, 2000, 'high', fs=sr, output='sos'), k)
hop, win = int(.05 * sr), int(.4 * sr)
m = np.array([10 * np.log10(np.mean(k[i:i + win] ** 2) + 1e-12) for i in range(0, len(k) - win, hop)]); tt = np.arange(len(m)) * .05 + .2
at = lambda t0, t1: m[(tt >= t0) & (tt < t1)]
order = np.argsort(-m); picks = []
for i in order:
    if all(abs(tt[i] - p) > .6 for p in picks): picks.append(tt[i])
    if len(picks) == 6: break
print('loudest moments:', ', '.join(f'{p:.2f}s {m[int((p - .2) / .05)] - m.max():+.1f} dB' for p in sorted(picks)))
for name, t0 in (('turn impact', T['turn']), ('section cut', T['sec'])):
    print(f'{name:12s} {t0:6.2f}s  {at(t0, t0 + .3).max() - m.max():+5.1f} dB rel. max, just before {at(t0 - .45, t0 - .05).mean() - at(t0, t0 + .3).max():+5.1f} dB')
prog = np.median(m[(tt > 1) & (tt < T['dur'] - 1)])
print(f"near silence {T['sil']:.2f}-{T['turn'] - .9:.2f}s: {at(T['sil'] + .3, T['turn'] - .9).mean() - prog:+.1f} dB vs median program")
