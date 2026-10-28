#!/usr/bin/env python3
"""Objective rhythm report on a finished film (picture and sound).

    .venv/bin/python tools/rhythm_report.py <film.mp4> [--events scenes/film.json] [--flat 1.0]

Picture
  - motion energy per frame: mean |frame - previous frame| on a 480×270 greyscale decode (0–255 scale);
    reported per 0.5 s and per 1 s; 1-second windows under --flat are listed as flat stretches.
  - cut points: frames whose difference is a spike far above the local median (a hard cut).
Sound
  - onsets (spectral flux peaks) per second, RMS level per 0.5 s (dBFS), silences under -45 dBFS.
Alignment
  - for every visual hit in the scene's events (type in HITS), the distance to the nearest audio onset.
Writes out/rhythm.csv (per 0.5 s) and prints a summary.
"""
import argparse, json, os, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import find_peaks
from scipy.ndimage import median_filter

ap = argparse.ArgumentParser(); ap.add_argument('film'); ap.add_argument('--events'); ap.add_argument('--flat', type=float, default=1.0)
a = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)

# ---------------------------------------------------------------- picture
w, h = 480, 270
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.film, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True)
fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w).astype(np.float32)
fps = 24.0
diff = np.r_[0, np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))]
n = len(diff); dur = n / fps
med = median_filter(diff, size=25)
cuts = [i / fps for i in range(2, n) if diff[i] > 6 * max(med[i], .5) and diff[i] > 8]
def win(x, size):
    k = int(round(size * fps)); return [(i / fps, float(x[i:i + k].mean())) for i in range(0, len(x) - k + 1, k)]
half = win(diff, .5); sec = [(t, float(diff[int(t * fps):int((t + 1) * fps)].mean())) for t in np.arange(0, dur - .999, .25)]
flat = [(t, v) for t, v in sec if v < a.flat]

# ---------------------------------------------------------------- sound
tmp = os.path.join(DEMO, 'out', '_rhythm.wav'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.film, '-ac', '1', '-ar', '24000', tmp], check=True)
x, sr = sf.read(tmp); os.remove(tmp)
hop = 240; nfft = 1024
frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (0, nfft)), nfft)[::hop] * np.hanning(nfft)
S = np.abs(np.fft.rfft(frames, axis=1))
flux = np.r_[0, np.maximum(0, np.diff(np.log1p(S * 10), axis=0)).sum(1)]
flux = flux / (np.percentile(flux, 99) + 1e-9)
thr = median_filter(flux, size=31) + .12
pk, _ = find_peaks(flux, height=thr, distance=int(.07 * sr / hop))
onsets = pk * hop / sr
rms = [(t, 20 * np.log10(np.sqrt(np.mean(x[int(t * sr):int((t + .5) * sr)] ** 2)) + 1e-9)) for t in np.arange(0, len(x) / sr - .499, .5)]
quiet = [(t, v) for t, v in rms if v < -45]

# ---------------------------------------------------------------- alignment
HITS = {'land', 'stamp', 'magnet', 'snap', 'pop', 'strike', 'ruler', 'dimend', 'arrow', 'horn', 'reveal', 'pier'}
evf = a.events or os.path.join(DEMO, 'scenes', 'film.json')
off = []
if os.path.exists(evf):
    for e in json.load(open(evf)).get('ev', []):
        if e['type'] in HITS:
            d = onsets - e['t']; j = np.argmin(np.abs(d)); off.append((e['t'], e['type'], float(d[j] * 1000)))

# ---------------------------------------------------------------- report
with open(os.path.join(DEMO, 'out', 'rhythm.csv'), 'w') as f:
    f.write('t,motion,onsets,rms_db\n')
    for (t, m) in half:
        o = int(((onsets >= t) & (onsets < t + .5)).sum()); r = next((v for tt, v in rms if abs(tt - t) < 1e-6), float('nan'))
        f.write(f'{t:.2f},{m:.3f},{o},{r:.1f}\n')
print(f'film {dur:.2f} s · {n} frames')
print(f'picture: mean motion {diff.mean():.2f}, median {np.median(diff):.2f}; per 0.5 s:')
print('  ' + ' '.join(f'{m:4.1f}' for _, m in half))
print(f'  hard cuts detected: {len(cuts)} {[round(c, 2) for c in cuts]}')
lo = sorted(sec, key=lambda q: q[1])[:5]
print('  flattest 1-s windows: ' + ', '.join(f'{t:.2f}–{t + 1:.2f} s ({v:.2f})' for t, v in lo))
print(f'  windows under {a.flat}: {len(flat)}' + (' ' + ', '.join(f'{t:.2f}' for t, _ in flat[:12]) if flat else ''))
per_s = [int(((onsets >= s) & (onsets < s + 1)).sum()) for s in range(int(np.ceil(len(x) / sr)))]
print(f'sound: {len(onsets)} onsets, per second: {per_s}')
print('  rms per 0.5 s (dBFS): ' + ' '.join(f'{v:.0f}' for _, v in rms))
print(f'  quiet windows (< -45 dBFS): {[round(t, 1) for t, _ in quiet]}')
if off:
    ab = np.abs([o for _, _, o in off])
    print(f'alignment: {len(off)} visual hits, median |offset| {np.median(ab):.0f} ms, within 40 ms: {(ab <= 40).sum()}/{len(ab)}')
    for t, ty, o in off:
        if abs(o) > 40: print(f'  {ty:8s} at {t:6.2f} s → nearest onset {o:+.0f} ms')
