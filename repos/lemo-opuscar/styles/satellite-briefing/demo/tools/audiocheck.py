"""Objective look at the mix: per-stem RMS per second, onsets per second, silences.
usage: python -I tools/audiocheck.py <demo_dir>"""
import sys, os, json
import numpy as np, soundfile as sf
D = sys.argv[1]
NAMES = ('voice', 'music', 'pulse', 'hits', 'fx', 'beds')
st = {n: sf.read(os.path.join(D, 'out/stems', n + '.wav'))[0].mean(1) for n in NAMES}
mix, sr = sf.read(os.path.join(D, 'out/mix.wav')); mix = mix.mean(1)
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
n = len(mix) // sr
print('sec  mix   voice music pulse hits  fx    beds  onsets')
# onsets: spectral flux peaks
hop = 512; win = 1024
frames = np.lib.stride_tricks.sliding_window_view(mix, win)[::hop] * np.hanning(win)
S = np.abs(np.fft.rfft(frames, axis=1))
flux = np.maximum(0, np.diff(np.log1p(S * 50), axis=0)).sum(1)
# librosa-style peak picking: a local maximum (+-3 frames) that clears the local mean (+-0.5 s) by a margin
from scipy.ndimage import maximum_filter1d, uniform_filter1d
fl = flux / (np.percentile(flux, 99) + 1e-9)
loc_max = maximum_filter1d(fl, 7); loc_mean = uniform_filter1d(fl, int(1.0 * sr / hop))
cand = np.where((fl == loc_max) & (fl > loc_mean + 0.12))[0]
peaks = []
for i in cand:
    if not peaks or i - peaks[-1] > int(.05 * sr / hop): peaks.append(int(i))
pt = (np.array(peaks) * hop + win) / sr   # flux at frame i reflects the window ending at i*hop+win
for s in range(n):
    a, b = s * sr, (s + 1) * sr
    row = [db(mix[a:b])] + [db(st[k][a:b]) for k in NAMES]
    print(f'{s:3d}  ' + '  '.join(f'{v:5.1f}' for v in row) + f'  {int(((pt >= s) & (pt < s + 1)).sum())}')
print('total onsets', len(pt), 'per s', round(len(pt) / n, 2))
# picture action -> nearest audio onset (every key event should have a transient within ~60 ms)
EVJ = json.load(open(os.path.join(D, 'events.json')))['ev']
keys = [e for e in EVJ if e['type'] in ('lock', 'map_on', 'touch', 'rewind', 'ring', 'stop', 'label', 'mark', 'range_end', 'whip', 'dam', 'nring', 'pin', 'end')]
print('event        t      nearest onset (ms)')
far = 0
for e in keys:
    dd = (pt - e['t']) * 1000; k = int(np.argmin(np.abs(dd))) if len(dd) else 0
    m = dd[k] if len(dd) else 1e9
    far += abs(m) > 60
    print(f"{e['type']:10s} {e['t']:6.2f}  {m:+7.0f}{'  <-- no transient' if abs(m) > 60 else ''}")
print(f'{len(keys) - far}/{len(keys)} key actions have an audio onset within 60 ms')
