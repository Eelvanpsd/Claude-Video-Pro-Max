"""Where are the loudest moments? Momentary loudness (400 ms, K-weighted approximation) of the mix, the top peaks,
and the level of the three designed impacts against the program. Also the music stem's spectral fullness per section.
usage: python -I tools/impactcheck.py <demo_dir>"""
import sys, os, json
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
D = sys.argv[1]
x, sr = sf.read(os.path.join(D, 'out/mix.wav')); x = x.mean(1)
T = json.load(open(os.path.join(D, 'timeline.json')))['T']
# K-weighting approximation: high shelf + high pass
k = sosfilt(butter(2, 60, 'high', fs=sr, output='sos'), x)
k = k + 0.6 * sosfilt(butter(2, 2000, 'high', fs=sr, output='sos'), k)
hop = int(.05 * sr); win = int(.4 * sr)
m = np.array([10 * np.log10(np.mean(k[i:i + win] ** 2) + 1e-12) for i in range(0, len(k) - win, hop)])
tt = np.arange(len(m)) * .05 + .2
order = np.argsort(-m); picks = []
for i in order:
    if all(abs(tt[i] - p) > .6 for p in picks): picks.append(tt[i])
    if len(picks) == 8: break
print('loudest moments (momentary, dB rel. max):', ', '.join(f'{p:.2f}s {m[int((p - .2) / .05)] - m.max():+.1f}' for p in sorted(picks)))
for name, t0 in (('map torn away', T['touch']), ('hard stop', T['y2025']), ('dam closes', T['dam'])):
    i = int((t0 + .05 - .2) / .05); j = int((t0 - .3 - .2) / .05)
    print(f'{name:14s} {t0:6.2f}s  momentary {m[i:i + 4].max() - m.max():+5.1f} dB rel. max,  rank {int((m > m[i:i + 4].max()).sum() * .05 * 10) / 10:.1f} s louder,  just before {m[j] - m[i:i + 4].max():+5.1f} dB')
mu = sf.read(os.path.join(D, 'out/stems/music.wav'))[0].mean(1) + sf.read(os.path.join(D, 'out/stems/pulse.wav'))[0].mean(1)
def bands(seg_):
    F = np.fft.rfftfreq(len(seg_), 1 / sr); P = np.abs(np.fft.rfft(seg_ * np.hanning(len(seg_)))) ** 2
    edges = [30, 80, 160, 320, 640, 1280, 2560, 5120, 10240]
    e = [P[(F >= a) & (F < b)].sum() for a, b in zip(edges[:-1], edges[1:])]
    e = 10 * np.log10(np.array(e) / max(e) + 1e-12)
    return ' '.join(f'{v:5.0f}' for v in e), int((e > -24).sum())
print('music + pulse stems: band energy (dB rel. strongest) 30-80-160-320-640-1k3-2k6-5k-10k, octaves within 24 dB')
for name, a, b in (('orbit/dive', 0, T['touch']), ('rings', T['y1977'], T['y2025']), ('muynak', T['push0'], T['sil2']), ('north', T['dam'], T['pull']), ('climb', T['pull'], T['end'])):
    s_, n = bands(mu[int(a * sr):int(b * sr)])
    print(f'  {name:11s} {s_}   {n}/8')
