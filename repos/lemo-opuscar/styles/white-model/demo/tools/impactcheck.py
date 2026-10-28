"""Loudness map of the mix: momentary loudness (400 ms, K-weighting approximation) every 0.5 s, the loudest moments,
the two designed weights (the date, the sun) against the program, and the two silences.
usage: python -I tools/impactcheck.py <demo_dir>"""
import sys, os, json
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
D = sys.argv[1]
x, sr = sf.read(os.path.join(D, 'out/mix.wav')); x = x.mean(1)
T = json.load(open(os.path.join(D, 'timeline.json')))['T']
k = sosfilt(butter(2, 60, 'high', fs=sr, output='sos'), x); k = k + .6 * sosfilt(butter(2, 2000, 'high', fs=sr, output='sos'), k)
hop, win = int(.05 * sr), int(.4 * sr)
m = np.array([10 * np.log10(np.mean(k[i:i + win] ** 2) + 1e-12) for i in range(0, len(k) - win, hop)]); tt = np.arange(len(m)) * .05 + .2
M = m.max()
print('momentary loudness, dB rel. max, every 0.5 s:')
row = [f'{t:4.1f}:{m[int((t - .2) / .05)] - M:+5.1f}' for t in np.arange(.5, tt[-1], .5)]
for i in range(0, len(row), 8): print('  '.join(row[i:i + 8]))
order = np.argsort(-m); picks = []
for i in order:
    if all(abs(tt[i] - p) > .6 for p in picks): picks.append(tt[i])
    if len(picks) == 6: break
print('loudest moments:', ', '.join(f'{p:.2f}s' for p in sorted(picks)))
for name, t0 in (('the date', T['date']), ('the sun', T['sun']), ('line lands', T['lineEnd'])):
    i = int((t0 + .05 - .2) / .05); j = int((t0 - .3 - .2) / .05)
    print(f'{name:10s} {t0:6.2f}s  {m[i:i + 5].max() - M:+5.1f} dB rel. max   just before {m[j] - m[i:i + 5].max():+5.1f} dB')
for name, a, b in (('silence', T['dark'] + .4, T['sun'] - .1),):
    i, j = int((a - .2) / .05), int((b - .2) / .05)
    print(f'{name:10s} {a:.2f}-{b:.2f}s  {m[i:j].mean() - np.median(m):+5.1f} dB rel. median program')
