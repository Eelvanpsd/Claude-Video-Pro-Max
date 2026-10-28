"""Motion per frame (mean absolute difference of consecutive frames, 0-255 on a 240x135 grey copy).
Flags any stretch longer than 1 s where the picture barely changes, and lists scene-change-like jumps.
usage: python -I tools/motioncheck.py <video.mp4> [flat_threshold=0.6]"""
import sys, subprocess
import numpy as np
v = sys.argv[1]; thr = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
W, H = 240, 135
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(f, axis=0)).mean((1, 2))
fps = 24
print(f'frames {len(f)}  mean motion {d.mean():.2f}  median {np.median(d):.2f}')
sec = len(d) // fps
print('per second (mean / min of 0.25 s windows):')
line = []
for s in range(sec + 1):
    seg_ = d[s * fps:(s + 1) * fps]
    if len(seg_) == 0: continue
    q = [seg_[i:i + 6].mean() for i in range(0, len(seg_), 6)]
    line.append(f'{s:2d}:{seg_.mean():5.2f}/{min(q):4.2f}')
for i in range(0, len(line), 6): print('  '.join(line[i:i + 6]))
flat = d < thr
run = 0; start = 0; bad = []
for i, x in enumerate(np.append(flat, False)):
    if x:
        if run == 0: start = i
        run += 1
    else:
        if run > fps: bad.append((start / fps, (start + run) / fps))
        run = 0
print('flat stretches > 1 s (motion <', thr, '):', [(round(a, 2), round(b, 2)) for a, b in bad] or 'none')
jumps = [(round((i + 1) / fps, 2), round(float(x), 1)) for i, x in enumerate(d) if x > max(12, 6 * np.median(d))]
print('big jumps (cut-like):', jumps[:40])
